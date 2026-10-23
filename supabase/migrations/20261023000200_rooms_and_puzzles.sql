-- =============================================================================
-- Escape rooms, reference photos, versioned puzzle definitions, secret solutions
-- =============================================================================
-- Design:
--   rooms               : lifecycle + ownership (relational)
--   room_photos         : uploaded reference photos, ordered (relational)
--   puzzle_versions     : immutable, versioned PUBLIC puzzle graph (validated JSONB)
--                         hotspots, objects, items, puzzles, dependencies, exit
--   private.puzzle_solutions : answers, rewards, combinations (never exposed)
--
-- The client can read rooms/photos/published versions it is entitled to, but
-- cannot read solutions and cannot write gameplay state directly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------
create table public.rooms (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid references auth.users (id) on delete cascade,  -- null only for system tutorial rooms
  kind                text not null default 'custom' check (kind in ('custom', 'tutorial')),
  title               text not null default 'Untitled room' check (char_length(title) between 1 and 80),
  description         text check (description is null or char_length(description) <= 500),
  status              text not null default 'draft'
                        check (status in ('draft', 'queued', 'generating', 'ready', 'failed')),
  current_version_id  uuid,  -- FK added below (circular with puzzle_versions)
  metadata            jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  last_activity_at    timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint rooms_owner_matches_kind check (
    (kind = 'custom'   and owner_id is not null) or
    (kind = 'tutorial' and owner_id is null)
  ),
  constraint rooms_ready_has_version check (status <> 'ready' or current_version_id is not null)
);

create index rooms_owner_created_idx on public.rooms (owner_id, created_at desc) where owner_id is not null;
create index rooms_tutorial_idx on public.rooms (kind) where kind = 'tutorial';
create index rooms_status_activity_idx on public.rooms (status, last_activity_at);

create trigger rooms_updated_at before update on public.rooms
  for each row execute function private.set_updated_at();

alter table public.rooms enable row level security;

revoke all on table public.rooms from anon, authenticated;
grant select on table public.rooms to authenticated;
grant update (title, description) on table public.rooms to authenticated;
grant delete on table public.rooms to authenticated;
-- INSERT happens only through public.create_room() so status/kind cannot be forged.

create policy "rooms: read own or published tutorial"
  on public.rooms for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (kind = 'tutorial' and status = 'ready')
  );

create policy "rooms: rename own"
  on public.rooms for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "rooms: delete own"
  on public.rooms for delete to authenticated
  using (owner_id = (select auth.uid()) and kind = 'custom');

-- ---------------------------------------------------------------------------
-- Reference photos
-- Storage path convention: room-photos/{owner_id}/{room_id}/{photo_id}.{ext}
-- ---------------------------------------------------------------------------
create table public.room_photos (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms (id) on delete cascade,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  bucket_id     text not null default 'room-photos' check (bucket_id = 'room-photos'),
  storage_path  text not null unique,
  position      smallint not null check (position between 0 and 11),
  mime_type     text not null check (mime_type in ('image/jpeg', 'image/png', 'image/heic', 'image/webp')),
  byte_size     integer check (byte_size is null or byte_size between 1 and 15728640),
  width         integer check (width  is null or width  between 1 and 12000),
  height        integer check (height is null or height between 1 and 12000),
  created_at    timestamptz not null default now(),
  unique (room_id, position),
  constraint room_photos_path_matches_owner check (
    storage_path like owner_id::text || '/' || room_id::text || '/%'
  )
);

create index room_photos_owner_idx on public.room_photos (owner_id);

alter table public.room_photos enable row level security;

revoke all on table public.room_photos from anon, authenticated;
grant select, delete on table public.room_photos to authenticated;
-- INSERT happens only through public.register_room_photo() after the upload is verified.

create policy "room_photos: read own"
  on public.room_photos for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "room_photos: delete own while editable"
  on public.room_photos for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and room_id in (
      select r.id from public.rooms r
      where r.owner_id = (select auth.uid()) and r.status in ('draft', 'failed')
    )
  );

-- ---------------------------------------------------------------------------
-- Storage cleanup queue. Deleting photo rows (directly, via room deletion, or
-- via account deletion cascades) enqueues the file; the storage-janitor Edge
-- Function removes it through the Storage API.
-- ---------------------------------------------------------------------------
create table private.storage_deletion_queue (
  id            bigint generated always as identity primary key,
  bucket_id     text not null,
  object_path   text not null,
  enqueued_at   timestamptz not null default now(),
  attempts      integer not null default 0,
  last_error    text,
  processed_at  timestamptz,
  unique (bucket_id, object_path)
);

create index storage_deletion_queue_pending_idx
  on private.storage_deletion_queue (enqueued_at) where processed_at is null;

create or replace function private.enqueue_photo_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.storage_deletion_queue (bucket_id, object_path)
  values (old.bucket_id, old.storage_path)
  on conflict (bucket_id, object_path)
    do update set processed_at = null, attempts = 0, last_error = null;
  return old;
end;
$$;

create trigger room_photos_enqueue_deletion
  after delete on public.room_photos
  for each row execute function private.enqueue_photo_deletion();

-- ---------------------------------------------------------------------------
-- Versioned puzzle definitions (public / playable part only)
-- ---------------------------------------------------------------------------
create table public.puzzle_versions (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid not null references public.rooms (id) on delete cascade,
  owner_id           uuid references auth.users (id) on delete cascade,  -- denormalized for cheap RLS; null for tutorial
  version            integer not null check (version >= 1),
  schema_version     smallint not null default 1 check (schema_version = 1),
  status             text not null default 'published' check (status in ('published', 'superseded')),
  public_definition  jsonb not null,
  content_hash       text not null,
  generation_job_id  uuid,  -- FK added in the generation pipeline migration
  created_at         timestamptz not null default now(),
  unique (room_id, version),
  constraint puzzle_versions_definition_shape check (
    jsonb_typeof(public_definition) = 'object'
    and public_definition -> 'schema_version' = to_jsonb(schema_version)
    and jsonb_typeof(public_definition -> 'hotspots') = 'array'
    and jsonb_typeof(public_definition -> 'puzzles') = 'array'
    and octet_length(public_definition::text) <= 262144
  )
);

create index puzzle_versions_owner_idx on public.puzzle_versions (owner_id) where owner_id is not null;
create unique index puzzle_versions_one_published_per_room
  on public.puzzle_versions (room_id) where status = 'published';

alter table public.rooms
  add constraint rooms_current_version_fk
  foreign key (current_version_id) references public.puzzle_versions (id) on delete set null
  deferrable initially deferred;

alter table public.puzzle_versions enable row level security;

revoke all on table public.puzzle_versions from anon, authenticated;
grant select on table public.puzzle_versions to authenticated;
-- Writes happen only through the server-side generation pipeline.

create policy "puzzle_versions: read published own or tutorial"
  on public.puzzle_versions for select to authenticated
  using (
    status = 'published'
    and (owner_id = (select auth.uid()) or owner_id is null)
  );

-- ---------------------------------------------------------------------------
-- Secret solutions (private schema: no Data API access, no grants)
-- ---------------------------------------------------------------------------
create table private.puzzle_solutions (
  puzzle_version_id  uuid primary key references public.puzzle_versions (id) on delete cascade,
  schema_version     smallint not null default 1 check (schema_version = 1),
  solution           jsonb not null check (
    jsonb_typeof(solution) = 'object'
    and solution -> 'schema_version' = to_jsonb(schema_version)
    and jsonb_typeof(solution -> 'puzzles') = 'object'
  ),
  created_at         timestamptz not null default now()
);

-- =============================================================================
-- Puzzle definition validator (schema v1)
-- =============================================================================
-- PUBLIC definition (stored in puzzle_versions.public_definition):
-- {
--   "schema_version": 1,
--   "title": "The Locked Study",
--   "intro": "You wake up ...",
--   "photos":   [ { "photo_id": "<room_photos.id>" } | { "asset_key": "tutorial/1.jpg" } ],
--   "items":    [ { "id": "brass_key", "name": "Brass key", "description": "..." } ],
--   "hotspots": [ { "id": "desk_drawer", "photo_index": 0, "object_label": "drawer",
--                   "name": "Desk drawer", "description": "...", "hidden": false,
--                   "shape": { "type": "rect", "x": 0.1, "y": 0.5, "w": 0.2, "h": 0.1 } } ],
--   "puzzles":  [ { "id": "open_drawer", "kind": "inspect" | "code" | "use_item" | "combine",
--                   "hotspot_id": "desk_drawer",          -- required except for combine
--                   "requires": ["other_puzzle_id"],      -- dependency graph
--                   "title": "...", "prompt": "...",
--                   "answer_format": { "kind": "digits", "length": 4 } } ],   -- code only
--   "exit": { "requires": ["final_puzzle_id"], "message": "You escaped!" }
-- }
--
-- SECRET solution (stored in private.puzzle_solutions.solution):
-- {
--   "schema_version": 1,
--   "puzzles": {
--     "<puzzle_id>": {
--       "answer":  "4096",                    -- code
--       "item_id": "brass_key",               -- use_item
--       "inputs":  ["torn_note_a", "torn_note_b"],   -- combine (exactly 2)
--       "rewards": { "items": [], "consume_items": [], "reveal_hotspots": [] },
--       "message": "The drawer slides open..."
--     }
--   }
-- }
-- Returns a list of human-readable errors; an empty array means valid.
-- =============================================================================
create or replace function private.validate_puzzle_definition(p_public jsonb, p_secret jsonb)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  errors        text[] := '{}';
  id_re         constant text := '^[a-z0-9][a-z0-9_-]{0,63}$';
  photo_count   integer;
  hotspot_ids   text[] := '{}';
  item_ids      text[] := '{}';
  puzzle_ids    text[] := '{}';
  h             jsonb;
  it            jsonb;
  p             jsonb;
  s             jsonb;
  r             text;
  shape         jsonb;
  pid           text;
  kind          text;
  -- solvability simulation
  solved        text[] := '{}';
  inventory     text[] := '{}';
  revealed      text[] := '{}';
  progress      boolean;
  can_solve     boolean;
begin
  if p_public is null or jsonb_typeof(p_public) <> 'object' then
    return array['public definition must be a JSON object'];
  end if;
  if p_secret is null or jsonb_typeof(p_secret) <> 'object' then
    return array['solution must be a JSON object'];
  end if;
  if p_public -> 'schema_version' is distinct from '1'::jsonb then
    errors := array_append(errors, ('public.schema_version must be 1')::text);
  end if;
  if p_secret -> 'schema_version' is distinct from '1'::jsonb then
    errors := array_append(errors, ('solution.schema_version must be 1')::text);
  end if;
  if octet_length(p_public::text) > 262144 then
    errors := array_append(errors, ('public definition exceeds 256 KB')::text);
  end if;
  if octet_length(p_secret::text) > 131072 then
    errors := array_append(errors, ('solution exceeds 128 KB')::text);
  end if;

  -- Secrets must never leak into the public definition.
  if jsonb_path_exists(p_public, 'lax $.**.answer')
     or jsonb_path_exists(p_public, 'lax $.**.rewards')
     or jsonb_path_exists(p_public, 'lax $.**.inputs')
     or jsonb_path_exists(p_public, 'lax $.**.solution') then
    errors := array_append(errors, ('public definition contains solution-only keys (answer/rewards/inputs/solution)')::text);
  end if;

  if jsonb_typeof(p_public -> 'photos') <> 'array' or jsonb_array_length(p_public -> 'photos') = 0 then
    errors := array_append(errors, ('photos must be a non-empty array')::text);
    photo_count := 0;
  else
    photo_count := jsonb_array_length(p_public -> 'photos');
  end if;

  if jsonb_typeof(p_public -> 'items') is distinct from 'array' then
    errors := array_append(errors, ('items must be an array')::text);
  end if;
  if jsonb_typeof(p_public -> 'hotspots') is distinct from 'array' then
    errors := array_append(errors, ('hotspots must be an array')::text);
  end if;
  if jsonb_typeof(p_public -> 'puzzles') is distinct from 'array'
     or jsonb_array_length(p_public -> 'puzzles') = 0 then
    errors := array_append(errors, ('puzzles must be a non-empty array')::text);
  end if;
  if jsonb_typeof(p_secret -> 'puzzles') is distinct from 'object' then
    errors := array_append(errors, ('solution.puzzles must be an object keyed by puzzle id')::text);
  end if;
  if cardinality(errors) > 0 then
    return errors;
  end if;

  if jsonb_array_length(p_public -> 'hotspots') > 100 then errors := array_append(errors, ('too many hotspots (max 100)')::text); end if;
  if jsonb_array_length(p_public -> 'items')    > 100 then errors := array_append(errors, ('too many items (max 100)')::text);    end if;
  if jsonb_array_length(p_public -> 'puzzles')  > 60  then errors := array_append(errors, ('too many puzzles (max 60)')::text);   end if;

  -- Items
  for it in select * from jsonb_array_elements(p_public -> 'items') loop
    if coalesce(it ->> 'id', '') !~ id_re then
      errors := array_append(errors, (format('invalid item id: %s', coalesce(it ->> 'id', '<missing>')))::text);
    elsif (it ->> 'id') = any(item_ids) then
      errors := array_append(errors, (format('duplicate item id: %s', it ->> 'id'))::text);
    else
      item_ids := item_ids || (it ->> 'id');
    end if;
    if coalesce(it ->> 'name', '') = '' then
      errors := array_append(errors, (format('item %s needs a name', coalesce(it ->> 'id', '?')))::text);
    end if;
  end loop;

  -- Hotspots
  for h in select * from jsonb_array_elements(p_public -> 'hotspots') loop
    if coalesce(h ->> 'id', '') !~ id_re then
      errors := array_append(errors, (format('invalid hotspot id: %s', coalesce(h ->> 'id', '<missing>')))::text);
      continue;
    elsif (h ->> 'id') = any(hotspot_ids) then
      errors := array_append(errors, (format('duplicate hotspot id: %s', h ->> 'id'))::text);
      continue;
    end if;
    hotspot_ids := hotspot_ids || (h ->> 'id');

    if jsonb_typeof(h -> 'photo_index') <> 'number'
       or (h ->> 'photo_index')::numeric <> floor((h ->> 'photo_index')::numeric)
       or (h ->> 'photo_index')::integer not between 0 and photo_count - 1 then
      errors := array_append(errors, (format('hotspot %s has an invalid photo_index', h ->> 'id'))::text);
    end if;
    if coalesce(h ->> 'object_label', '') = '' then
      errors := array_append(errors, (format('hotspot %s needs an object_label', h ->> 'id'))::text);
    end if;
    if h ? 'hidden' and jsonb_typeof(h -> 'hidden') <> 'boolean' then
      errors := array_append(errors, (format('hotspot %s: hidden must be boolean', h ->> 'id'))::text);
    end if;

    shape := h -> 'shape';
    if shape is null or shape ->> 'type' is distinct from 'rect'
       or jsonb_typeof(shape -> 'x') <> 'number' or jsonb_typeof(shape -> 'y') <> 'number'
       or jsonb_typeof(shape -> 'w') <> 'number' or jsonb_typeof(shape -> 'h') <> 'number' then
      errors := array_append(errors, (format('hotspot %s needs a rect shape with numeric x/y/w/h', h ->> 'id'))::text);
    elsif (shape ->> 'x')::numeric < 0 or (shape ->> 'y')::numeric < 0
       or (shape ->> 'w')::numeric <= 0 or (shape ->> 'h')::numeric <= 0
       or (shape ->> 'x')::numeric + (shape ->> 'w')::numeric > 1
       or (shape ->> 'y')::numeric + (shape ->> 'h')::numeric > 1 then
      errors := array_append(errors, (format('hotspot %s shape must be normalized within [0,1]', h ->> 'id'))::text);
    end if;
  end loop;

  -- Puzzle ids first (requires may reference later puzzles)
  for p in select * from jsonb_array_elements(p_public -> 'puzzles') loop
    if coalesce(p ->> 'id', '') !~ id_re then
      errors := array_append(errors, (format('invalid puzzle id: %s', coalesce(p ->> 'id', '<missing>')))::text);
    elsif (p ->> 'id') = any(puzzle_ids) then
      errors := array_append(errors, (format('duplicate puzzle id: %s', p ->> 'id'))::text);
    else
      puzzle_ids := puzzle_ids || (p ->> 'id');
    end if;
  end loop;

  -- Puzzle bodies + matching solutions
  for p in select * from jsonb_array_elements(p_public -> 'puzzles') loop
    pid  := p ->> 'id';
    kind := p ->> 'kind';
    continue when pid is null or pid !~ id_re;

    if kind is null or kind not in ('inspect', 'code', 'use_item', 'combine') then
      errors := array_append(errors, (format('puzzle %s has invalid kind', pid))::text);
      continue;
    end if;

    if kind <> 'combine' then
      if not ((p ->> 'hotspot_id') = any(hotspot_ids)) or p ->> 'hotspot_id' is null then
        errors := array_append(errors, (format('puzzle %s references unknown hotspot %s', pid, coalesce(p ->> 'hotspot_id', '<missing>')))::text);
      end if;
    end if;

    if p ? 'requires' then
      if jsonb_typeof(p -> 'requires') <> 'array' then
        errors := array_append(errors, (format('puzzle %s: requires must be an array', pid))::text);
      else
        for r in select * from jsonb_array_elements_text(p -> 'requires') loop
          if not (r = any(puzzle_ids)) then
            errors := array_append(errors, (format('puzzle %s requires unknown puzzle %s', pid, r))::text);
          elsif r = pid then
            errors := array_append(errors, (format('puzzle %s requires itself', pid))::text);
          end if;
        end loop;
      end if;
    end if;

    s := p_secret -> 'puzzles' -> pid;
    if s is null or jsonb_typeof(s) <> 'object' then
      errors := array_append(errors, (format('puzzle %s has no solution entry', pid))::text);
      continue;
    end if;

    if kind = 'code' then
      if coalesce(btrim(s ->> 'answer'), '') = '' then
        errors := array_append(errors, (format('code puzzle %s needs a non-empty answer', pid))::text);
      end if;
    elsif kind = 'use_item' then
      if not ((s ->> 'item_id') = any(item_ids)) or s ->> 'item_id' is null then
        errors := array_append(errors, (format('use_item puzzle %s references unknown item', pid))::text);
      end if;
    elsif kind = 'combine' then
      if jsonb_typeof(s -> 'inputs') <> 'array' or jsonb_array_length(s -> 'inputs') <> 2 then
        errors := array_append(errors, (format('combine puzzle %s needs exactly 2 inputs', pid))::text);
      else
        for r in select * from jsonb_array_elements_text(s -> 'inputs') loop
          if not (r = any(item_ids)) then
            errors := array_append(errors, (format('combine puzzle %s uses unknown item %s', pid, r))::text);
          end if;
        end loop;
      end if;
    end if;

    if s ? 'rewards' then
      for r in select * from jsonb_array_elements_text(coalesce(s -> 'rewards' -> 'items', '[]')) loop
        if not (r = any(item_ids)) then errors := array_append(errors, (format('puzzle %s rewards unknown item %s', pid, r))::text); end if;
      end loop;
      for r in select * from jsonb_array_elements_text(coalesce(s -> 'rewards' -> 'consume_items', '[]')) loop
        if not (r = any(item_ids)) then errors := array_append(errors, (format('puzzle %s consumes unknown item %s', pid, r))::text); end if;
      end loop;
      for r in select * from jsonb_array_elements_text(coalesce(s -> 'rewards' -> 'reveal_hotspots', '[]')) loop
        if not (r = any(hotspot_ids)) then errors := array_append(errors, (format('puzzle %s reveals unknown hotspot %s', pid, r))::text); end if;
      end loop;
    end if;
  end loop;

  -- Every solution entry must correspond to a puzzle
  for r in select * from jsonb_object_keys(p_secret -> 'puzzles') loop
    if not (r = any(puzzle_ids)) then
      errors := array_append(errors, (format('solution has entry for unknown puzzle %s', r))::text);
    end if;
  end loop;

  -- Exit
  if jsonb_typeof(p_public -> 'exit') <> 'object'
     or jsonb_typeof(p_public -> 'exit' -> 'requires') <> 'array'
     or jsonb_array_length(p_public -> 'exit' -> 'requires') = 0 then
    errors := array_append(errors, ('exit.requires must be a non-empty array')::text);
  else
    for r in select * from jsonb_array_elements_text(p_public -> 'exit' -> 'requires') loop
      if not (r = any(puzzle_ids)) then
        errors := array_append(errors, (format('exit requires unknown puzzle %s', r))::text);
      end if;
    end loop;
  end if;

  if cardinality(errors) > 0 then
    return errors;
  end if;

  -- Solvability: greedy simulation. Success proves a valid solve order exists
  -- (catches cycles, missing items, unreachable hidden hotspots).
  select coalesce(array_agg(x ->> 'id'), '{}') into revealed
  from jsonb_array_elements(p_public -> 'hotspots') x
  where coalesce((x ->> 'hidden')::boolean, false) = false;

  loop
    progress := false;
    for p in select * from jsonb_array_elements(p_public -> 'puzzles') loop
      pid := p ->> 'id';
      continue when pid = any(solved);
      kind := p ->> 'kind';
      s := p_secret -> 'puzzles' -> pid;

      can_solve := not exists (
        select 1 from jsonb_array_elements_text(coalesce(p -> 'requires', '[]')) req
        where not (req = any(solved))
      );
      if can_solve and kind <> 'combine' then
        can_solve := (p ->> 'hotspot_id') = any(revealed);
      end if;
      if can_solve and kind = 'use_item' then
        can_solve := (s ->> 'item_id') = any(inventory);
      end if;
      if can_solve and kind = 'combine' then
        can_solve := not exists (
          select 1 from jsonb_array_elements_text(s -> 'inputs') i where not (i = any(inventory))
        );
      end if;

      if can_solve then
        solved := solved || pid;
        inventory := array(
          select distinct x from unnest(
            inventory || array(select jsonb_array_elements_text(coalesce(s -> 'rewards' -> 'items', '[]')))
          ) x
          where not (x = any(array(select jsonb_array_elements_text(coalesce(s -> 'rewards' -> 'consume_items', '[]')))))
        );
        revealed := revealed || array(select jsonb_array_elements_text(coalesce(s -> 'rewards' -> 'reveal_hotspots', '[]')));
        progress := true;
      end if;
    end loop;
    exit when not progress;
  end loop;

  for r in select * from jsonb_array_elements_text(p_public -> 'exit' -> 'requires') loop
    if not (r = any(solved)) then
      errors := array_append(errors, (format('exit puzzle %s is not reachable (cycle, missing item, or hidden hotspot never revealed)', r))::text);
    end if;
  end loop;
  for p in select * from jsonb_array_elements(p_public -> 'puzzles') loop
    if not ((p ->> 'id') = any(solved)) then
      errors := array_append(errors, (format('puzzle %s can never be solved', p ->> 'id'))::text);
    end if;
  end loop;

  return errors;
end;
$$;

revoke all on function private.validate_puzzle_definition(jsonb, jsonb) from public, anon, authenticated;
grant execute on function private.validate_puzzle_definition(jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Room creation (custom rooms; full accounts only)
-- ---------------------------------------------------------------------------
create or replace function public.create_room(p_title text default null)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_permanent_user();
  v_room public.rooms;
begin
  insert into public.rooms (owner_id, kind, title)
  values (v_uid, 'custom', coalesce(nullif(btrim(p_title), ''), 'Untitled room'))
  returning * into v_room;
  return v_room;
end;
$$;

revoke all on function public.create_room(text) from public, anon, authenticated;
grant execute on function public.create_room(text) to authenticated;
