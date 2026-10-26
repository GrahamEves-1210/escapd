-- =============================================================================
-- Genres, the accusation step, and hotspot effects
-- =============================================================================
-- Additive. schema_version stays 1 and every new definition field is
-- optional, so existing rooms, sessions and the tutorial seed are unaffected.
--
--   1. Genre: 'noir' | 'crime_scene' | 'paranormal'.
--      rooms.genre (default 'noir', so existing rooms and the tutorial are
--      noir) is readable through the table SELECT grant and deliberately left
--      out of the rooms UPDATE column grant: a genre is chosen only through
--      create_room and request_room_generation, and a built (ready) room keeps
--      its genre. generation_jobs.genre is a snapshot of the room's genre when
--      the job is requested; worker_claim_generation_job returns the whole job
--      row, so the worker receives it with no signature change. The published
--      public definition carries an optional top-level "genre" (absent means
--      noir), and worker_complete_generation_job fails an attempt whose genre
--      differs from the job's, like any other invalid output.
--   2. Hotspot effects: an optional public hotspot "effect", one of
--      flicker | apparition | moved | cold | whisper. Templates set it; the
--      client renders it as an overlay.
--   3. The accuse step (crime scene finale). PUBLIC puzzle, no hotspot_id
--      (like combine), exactly 3 options per dimension:
--        { "id": "name_the_killer", "kind": "accuse", "requires": ["..."],
--          "title": "...", "prompt": "...",
--          "suspects": [ { "id": "s_ivy", "name": "Ivy Marsh",
--                          "role": "The housekeeper", "alibi": "One line." } ],
--          "motives":  [ { "id": "m_debt", "name": "A debt she couldn't pay" } ],
--          "methods":  [ { "id": "x_tea",  "name": "Poison in the evening tea" } ] }
--      Option ids follow the id rule and are unique across the whole
--      definition (other options, items, hotspots, puzzles). name is 1-60
--      characters; suspects also need a role (1-60) and an alibi (1-200).
--      Within a dimension the normalized names (private.normalize_answer) are
--      distinct and none contains another.
--      SECRET entry:
--        "name_the_killer": {
--          "answer":   { "suspect": "s_ivy", "motive": "m_debt", "method": "x_tea" },
--          "evidence": { "suspect": "<item id>", "motive": "<item id>", "method": "<item id>" },
--          "rewards": { ... }, "message": "...", "hints": ["...", "...", "..."] }
--      `evidence` joins answer/rewards/inputs/solution/hints as a key that must
--      never appear in the public definition. Evidence sources are items:
--      "found" means granted, and templates never consume them.
--      Deducibility, a solve condition in the simulation like clue coverage:
--      an accusation is attemptable once its requires are solved, and solvable
--      only when, in each dimension, the evidence item is held and its
--      normalized description contains the correct option's normalized name
--      and neither wrong option's. One that never gets there reports
--      "accusation <id> cannot be worked out from the clues". An accusation
--      may be the exit.
--   4. submit_action gains
--        { "type": "accuse", "puzzle_id": "...", "suspect_id": "...",
--          "motive_id": "...", "method_id": "..." }
--      It shares the code cooldown and streak, and a wrong triple takes
--      exactly the wrong-code path, with one reply for every wrong
--      combination. Every state write also stores state.contradicted: the
--      accused suspect of each accusation whose suspect evidence is in the
--      inventory (text the player already holds and has read).
--   5. use_hint treats accuse like combine: attemptable without a hotspot.
--   6. The wrong-answer cooldown (codes and accusations) is also kept per
--      player and room in private.code_cooldowns, and start_or_resume_session
--      starts a new session from it, so abandoning or deleting a locked
--      session no longer lifts the lock or resets the streak.
--
-- Mirrors that follow this file: supabase/functions/_shared/puzzle-check.ts
-- (validator rules and error texts) and scripts/trial/engine.js
-- (submit_action, use_hint and a new session's inherited cooldown).
-- =============================================================================

alter table public.rooms
  add column genre text not null default 'noir'
    constraint rooms_genre_check check (genre in ('noir', 'crime_scene', 'paranormal'));

alter table public.generation_jobs
  add column genre text not null default 'noir'
    constraint generation_jobs_genre_check check (genre in ('noir', 'crime_scene', 'paranormal'));

-- ---------------------------------------------------------------------------
-- Room creation, with a genre. The old one-argument signature is dropped
-- first: CREATE OR REPLACE with a new argument list would add an overload,
-- and create_room('title') would then be ambiguous (PostgREST PGRST203).
-- ---------------------------------------------------------------------------
drop function public.create_room(text);

create function public.create_room(p_title text default null, p_genre text default 'noir')
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_permanent_user();
  v_genre text := coalesce(p_genre, 'noir');
  v_room  public.rooms;
begin
  if v_genre not in ('noir', 'crime_scene', 'paranormal') then
    raise exception 'unknown genre %', v_genre using errcode = '22023';
  end if;
  insert into public.rooms (owner_id, kind, title, genre)
  values (v_uid, 'custom', coalesce(nullif(btrim(p_title), ''), 'Untitled room'), v_genre)
  returning * into v_room;
  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- Generation request, with an optional genre (null keeps the room's). Same
-- flow as before, plus:
--   * a replayed key with a different non-null genre raises, like a replayed
--     key for a different room;
--   * an active job of another genre is not handed back as if it were the
--     one asked for: that raises too;
--   * a draft or failed room takes the new genre; a ready room keeps its own,
--     since its published version (and any session on it) is of that genre;
--   * the job row gets the room's genre.
-- ---------------------------------------------------------------------------
drop function public.request_room_generation(uuid, uuid);

create function public.request_room_generation(
  p_room_id uuid, p_idempotency_key uuid, p_genre text default null)
returns public.generation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := private.require_permanent_user();
  v_room        public.rooms;
  v_job         public.generation_jobs;
  v_photo_count integer;
begin
  if p_idempotency_key is null then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;
  if p_genre is not null and p_genre not in ('noir', 'crime_scene', 'paranormal') then
    raise exception 'unknown genre %', p_genre using errcode = '22023';
  end if;

  -- Idempotent replay: same key returns the same job, whatever its state.
  select * into v_job from public.generation_jobs
  where owner_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    if v_job.room_id <> p_room_id then
      raise exception 'idempotency key already used for a different room' using errcode = '22023';
    end if;
    if p_genre is not null and p_genre <> v_job.genre then
      raise exception 'idempotency key already used for a different genre' using errcode = '22023';
    end if;
    return v_job;
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.owner_id is distinct from v_uid then
    raise exception 'room not found' using errcode = 'P0002';
  end if;

  -- One active job per room: return it instead of starting another.
  select * into v_job from public.generation_jobs
  where room_id = p_room_id and status in ('queued', 'running');
  if found then
    if p_genre is not null and p_genre <> v_job.genre then
      raise exception 'this room is already being built as another genre' using errcode = '22023';
    end if;
    return v_job;
  end if;

  if v_room.status not in ('draft', 'failed', 'ready') then
    raise exception 'room is not in a state that allows generation (%)', v_room.status using errcode = '55000';
  end if;

  if p_genre is not null and p_genre <> v_room.genre then
    if v_room.status = 'ready' then
      raise exception 'a built case keeps its genre' using errcode = '22023';
    end if;
    v_room.genre := p_genre;   -- draft or failed: no published version to disagree with
  end if;

  if not private.has_active_entitlement(v_uid) then
    raise exception 'an active subscription is required to generate custom rooms'
      using errcode = '42501', hint = 'entitlement_required';
  end if;

  if private.generations_used(v_uid) >= private.config_int('generation_cap_per_window') then
    raise exception 'generation limit reached for this period'
      using errcode = '54000', hint = 'generation_cap_reached';
  end if;

  select count(*) into v_photo_count from public.room_photos where room_id = p_room_id;
  if v_photo_count < private.config_int('min_photos_per_room') then
    raise exception 'at least % photos are required', private.config_int('min_photos_per_room')
      using errcode = '23514', hint = 'not_enough_photos';
  end if;

  insert into public.generation_jobs (room_id, owner_id, idempotency_key, max_attempts, genre)
  values (p_room_id, v_uid, p_idempotency_key, private.config_int('generation_max_attempts'), v_room.genre)
  returning * into v_job;

  update public.rooms set status = 'queued', genre = v_room.genre, last_activity_at = now() where id = p_room_id;

  return v_job;
end;
$$;

-- ---------------------------------------------------------------------------
-- Publish, with the genre check: the definition's "genre" (absent means noir)
-- must be the job's. A mismatch fails the attempt as invalid output, the same
-- way validation errors do. Otherwise unchanged from
-- 20261023000400_generation_pipeline.sql.
-- ---------------------------------------------------------------------------
create or replace function public.worker_complete_generation_job(
  p_job_id uuid, p_lease_token uuid, p_public_definition jsonb, p_solution jsonb,
  p_usage jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job      public.generation_jobs := private.lock_leased_job(p_job_id, p_lease_token);
  v_room     public.rooms;
  v_errors   text[];
  v_version  integer;
  v_pv_id    uuid;
  v_photo_ids text[];
begin
  select * into v_room from public.rooms where id = v_job.room_id for update;

  v_errors := private.validate_puzzle_definition(p_public_definition, p_solution);

  -- Photo references must point at this room's photos.
  select coalesce(array_agg(id::text), '{}') into v_photo_ids from public.room_photos where room_id = v_room.id;
  if cardinality(v_errors) = 0 and exists (
       select 1 from jsonb_array_elements(p_public_definition -> 'photos') ph
       where not (coalesce(ph ->> 'photo_id', '') = any(v_photo_ids))) then
    v_errors := v_errors || 'photos[].photo_id must reference this room''s uploaded photos'::text;
  end if;

  -- The case must be of the genre the job was requested with (absent means noir).
  if cardinality(v_errors) = 0
     and coalesce(p_public_definition ->> 'genre', 'noir') is distinct from v_job.genre then
    v_errors := v_errors || format('public.genre must be the job''s genre (%s)', v_job.genre);
  end if;

  if cardinality(v_errors) > 0 then
    perform private.record_generation_usage(v_job, p_usage, 'invalid_output');
    perform public.worker_fail_generation_job(
      p_job_id, p_lease_token, 'invalid_output',
      left(array_to_string(v_errors, '; '), 2000), true, null);
    return jsonb_build_object('ok', false, 'errors', to_jsonb(v_errors));
  end if;

  perform private.record_generation_usage(v_job, p_usage, 'succeeded');

  select coalesce(max(version), 0) + 1 into v_version from public.puzzle_versions where room_id = v_room.id;

  update public.puzzle_versions set status = 'superseded'
   where room_id = v_room.id and status = 'published';

  insert into public.puzzle_versions (
    room_id, owner_id, version, schema_version, status, public_definition, content_hash, generation_job_id)
  values (
    v_room.id, v_room.owner_id, v_version, 1, 'published', p_public_definition,
    encode(sha256(convert_to(p_public_definition::text || p_solution::text, 'UTF8')), 'hex'),
    v_job.id)
  returning id into v_pv_id;

  insert into private.puzzle_solutions (puzzle_version_id, schema_version, solution)
  values (v_pv_id, 1, p_solution);

  update public.rooms
     set status = 'ready',
         current_version_id = v_pv_id,
         title = case when title = 'Untitled room' and coalesce(btrim(p_public_definition ->> 'title'), '') <> ''
                      then left(btrim(p_public_definition ->> 'title'), 80) else title end,
         last_activity_at = now()
   where id = v_room.id;

  update public.generation_jobs
     set status = 'succeeded', result_version_id = v_pv_id, finished_at = now(),
         error_code = null, error_message = null,
         lease_token = null, leased_by = null, lease_expires_at = null
   where id = v_job.id;

  return jsonb_build_object('ok', true, 'puzzle_version_id', v_pv_id, 'version', v_version);
end;
$$;

-- =============================================================================
-- Validator: genre, hotspot effects, and the accuse step
-- =============================================================================
-- The body of 20261024000100_clue_coverage_and_preview.sql with:
--   * an optional top-level "genre" (noir | crime_scene | paranormal);
--   * an optional hotspot "effect" (flicker | apparition | moved | cold | whisper);
--   * kind "accuse": no hotspot (like combine), its public options and secret
--     answer/evidence (see the header of this file), and `evidence` in the
--     solution-only key check (whose error text is unchanged);
--   * the deducibility clause in the simulation, reported as
--     "accusation <id> cannot be worked out from the clues".
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
  hints_ok      boolean;
  -- accuse options
  accuse_dims   constant text[] := array['suspect', 'motive', 'method'];
  option_ids    text[] := '{}';
  dim           text;
  opts          jsonb;
  opt           jsonb;
  opt_id        text;
  -- solvability simulation
  solved        text[] := '{}';
  inventory     text[] := '{}';
  revealed      text[] := '{}';
  progress      boolean;
  can_solve     boolean;
  corpus        text;
  clue_blocked  text[] := '{}';   -- code puzzles that were attemptable but had no readable clue
  accuse_blocked text[] := '{}';  -- accusations that were attemptable but not yet provable from held evidence
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
  -- Optional; absent means noir.
  if p_public ? 'genre' and coalesce(p_public ->> 'genre', '') not in ('noir', 'crime_scene', 'paranormal') then
    errors := array_append(errors, ('public.genre must be one of noir, crime_scene, paranormal')::text);
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
     or jsonb_path_exists(p_public, 'lax $.**.solution')
     or jsonb_path_exists(p_public, 'lax $.**.hints')
     or jsonb_path_exists(p_public, 'lax $.**.evidence') then
    errors := array_append(errors, ('public definition contains solution-only keys (answer/rewards/inputs/solution/hints)')::text);
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
    if h ? 'effect' and coalesce(h ->> 'effect', '') not in ('flicker', 'apparition', 'moved', 'cold', 'whisper') then
      errors := array_append(errors, (format('hotspot %s has an unknown effect', h ->> 'id'))::text);
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

    if kind is null or kind not in ('inspect', 'code', 'use_item', 'combine', 'accuse') then
      errors := array_append(errors, (format('puzzle %s has invalid kind', pid))::text);
      continue;
    end if;

    -- combine and accuse are not tied to a hotspot
    if kind not in ('combine', 'accuse') then
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

    -- Accuse: exactly 3 public options per dimension (suspects, motives, methods).
    if kind = 'accuse' then
      foreach dim in array accuse_dims loop
        opts := p -> (dim || 's');
        if (case when jsonb_typeof(opts) = 'array' then jsonb_array_length(opts) <> 3 else true end) then
          errors := array_append(errors, (format('accuse puzzle %s needs exactly 3 %ss', pid, dim))::text);
          continue;
        end if;
        for opt in select * from jsonb_array_elements(opts) loop
          opt_id := opt ->> 'id';
          if coalesce(opt_id, '') !~ id_re then
            errors := array_append(errors, (format('accuse puzzle %s has an invalid option id: %s', pid, coalesce(opt_id, '<missing>')))::text);
          elsif opt_id = any(option_ids || item_ids || hotspot_ids || puzzle_ids) then
            errors := array_append(errors, (format('duplicate option id: %s', opt_id))::text);
          else
            option_ids := option_ids || opt_id;
          end if;
          if not coalesce(jsonb_typeof(opt -> 'name') = 'string' and btrim(opt ->> 'name') <> ''
                          and char_length(opt ->> 'name') <= 60, false) then
            errors := array_append(errors, (format('accuse puzzle %s: %s %s needs a name of 1-60 characters', pid, dim, coalesce(opt_id, '?')))::text);
          end if;
          if dim = 'suspect' then
            if not coalesce(jsonb_typeof(opt -> 'role') = 'string' and btrim(opt ->> 'role') <> ''
                            and char_length(opt ->> 'role') <= 60, false) then
              errors := array_append(errors, (format('accuse puzzle %s: suspect %s needs a role of 1-60 characters', pid, coalesce(opt_id, '?')))::text);
            end if;
            if not coalesce(jsonb_typeof(opt -> 'alibi') = 'string' and btrim(opt ->> 'alibi') <> ''
                            and char_length(opt ->> 'alibi') <= 200, false) then
              errors := array_append(errors, (format('accuse puzzle %s: suspect %s needs an alibi of 1-200 characters', pid, coalesce(opt_id, '?')))::text);
            end if;
          end if;
        end loop;
        -- Deducibility reads names as substrings of the evidence, so within a
        -- dimension no normalized name may equal or contain another.
        if exists (
          select 1
          from jsonb_array_elements(opts) with ordinality a(v, i)
          join jsonb_array_elements(opts) with ordinality b(v, j) on a.i <> b.j
          where strpos(private.normalize_answer(a.v ->> 'name'), private.normalize_answer(b.v ->> 'name')) > 0) then
          errors := array_append(errors, (format('accuse puzzle %s: %s names must be distinct and none may contain another', pid, dim))::text);
        end if;
      end loop;
    end if;

    s := p_secret -> 'puzzles' -> pid;
    if s is null or jsonb_typeof(s) <> 'object' then
      errors := array_append(errors, (format('puzzle %s has no solution entry', pid))::text);
      continue;
    end if;

    if kind = 'code' then
      -- Normalized, so separator-only answers ("--", " ") are rejected too.
      if private.normalize_answer(s ->> 'answer') = '' then
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
    elsif kind = 'accuse' then
      -- The answer picks one public option per dimension; each dimension's evidence is an item.
      foreach dim in array accuse_dims loop
        opts := case when jsonb_typeof(p -> (dim || 's')) = 'array' then p -> (dim || 's') else '[]'::jsonb end;
        if not exists (select 1 from jsonb_array_elements(opts) x where x ->> 'id' = s -> 'answer' ->> dim) then
          errors := array_append(errors, (format('accuse puzzle %s: answer.%s must be one of its %ss', pid, dim, dim))::text);
        end if;
        if not ((s -> 'evidence' ->> dim) = any(item_ids)) or s -> 'evidence' ->> dim is null then
          errors := array_append(errors, (format('accuse puzzle %s: evidence.%s references unknown item', pid, dim))::text);
        end if;
      end loop;
    end if;

    -- Optional hint ladder (secret only): 1-3 non-empty strings, <= 400 chars each.
    if s ? 'hints' then
      hints_ok := jsonb_typeof(s -> 'hints') = 'array';
      if hints_ok then
        hints_ok := jsonb_array_length(s -> 'hints') between 1 and 3
          and not exists (
            select 1 from jsonb_array_elements(s -> 'hints') hv
            where jsonb_typeof(hv) <> 'string'
               or btrim(hv #>> '{}') = ''
               or char_length(hv #>> '{}') > 400);
      end if;
      if not hints_ok then
        errors := array_append(errors, (format('puzzle %s: hints must be an array of 1-3 non-empty strings of at most 400 characters', pid))::text);
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
  -- (catches cycles, missing items, unreachable hidden hotspots, codes whose
  -- answer the player cannot read before solving them, and accusations the
  -- evidence in hand does not prove).
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
      if can_solve and kind not in ('combine', 'accuse') then
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
      -- Clue coverage: the answer must be readable in what the player holds or sees right now.
      -- Descriptions are joined with '|', which normalization keeps, so a code
      -- cannot be stitched together across the end of one description and the
      -- start of another.
      if can_solve and kind = 'code' then
        select concat_ws('|',
                 (select string_agg(x ->> 'description', '|') from jsonb_array_elements(p_public -> 'items') x
                   where (x ->> 'id') = any(inventory)),
                 (select string_agg(x ->> 'description', '|') from jsonb_array_elements(p_public -> 'hotspots') x
                   where (x ->> 'id') = any(revealed)))
          into corpus;
        can_solve := strpos(private.normalize_answer(corpus), private.normalize_answer(s ->> 'answer')) > 0;
        if not can_solve and not (pid = any(clue_blocked)) then
          clue_blocked := clue_blocked || pid;
        end if;
      end if;
      -- Deducibility: in every dimension the evidence item must be held, and its
      -- normalized description must name the correct option and neither wrong
      -- one (for suspects: it breaks exactly the culprit's alibi). Names are
      -- distinct and never contain one another, so this is unambiguous.
      if can_solve and kind = 'accuse' then
        foreach dim in array accuse_dims loop
          select private.normalize_answer(x ->> 'description') into corpus
          from jsonb_array_elements(p_public -> 'items') x
          where x ->> 'id' = s -> 'evidence' ->> dim;
          can_solve := coalesce(
            (s -> 'evidence' ->> dim) = any(inventory)
            and strpos(corpus, (select private.normalize_answer(x ->> 'name') from jsonb_array_elements(p -> (dim || 's')) x
                                where x ->> 'id' = s -> 'answer' ->> dim)) > 0
            and not exists (
              select 1 from jsonb_array_elements(p -> (dim || 's')) x
              where x ->> 'id' <> s -> 'answer' ->> dim
                and strpos(corpus, private.normalize_answer(x ->> 'name')) > 0),
            false);
          exit when not can_solve;
        end loop;
        if not can_solve and not (pid = any(accuse_blocked)) then
          accuse_blocked := accuse_blocked || pid;
        end if;
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
    if (p ->> 'id') = any(solved) then
      continue;
    end if;
    -- Attemptability only grows during the simulation, so a code that was ever
    -- blocked on its clue and is still unsolved is unsolved because of the clue
    -- (likewise an accusation and its evidence).
    if (p ->> 'id') = any(clue_blocked) then
      errors := array_append(errors, (format('puzzle %s: code answer is not written anywhere the player can read before solving it', p ->> 'id'))::text);
    elsif (p ->> 'id') = any(accuse_blocked) then
      errors := array_append(errors, (format('accusation %s cannot be worked out from the clues', p ->> 'id'))::text);
    else
      errors := array_append(errors, (format('puzzle %s can never be solved', p ->> 'id'))::text);
    end if;
  end loop;

  return errors;
end;
$$;

-- ---------------------------------------------------------------------------
-- The cooldown outlives the session.
-- game_sessions.code_wrong_streak and code_locked_until stay the copy that
-- submit_action reads and writes, but on their own they start again from
-- zero whenever a player abandons a session (abandon_session) or deletes it
-- (the DELETE grant) and starts a new one, and replaying the steps up to a
-- code or an accusation is cheap. So every change to them is also kept per
-- player and room in private.code_cooldowns, and a new session starts from
-- there. A room's later versions share its row, which only means a lock can
-- outlast a regeneration by a few minutes.
-- ---------------------------------------------------------------------------
create table private.code_cooldowns (
  user_id           uuid not null references auth.users (id) on delete cascade,
  room_id           uuid not null references public.rooms (id) on delete cascade,
  code_wrong_streak integer not null default 0 check (code_wrong_streak >= 0),
  code_locked_until timestamptz,
  updated_at        timestamptz not null default now(),
  primary key (user_id, room_id)
);

-- Readable by server tooling like every other private table (see 20261023000700).
grant select on table private.code_cooldowns to service_role;

-- Sessions that predate this table: start from each player's latest session on a room.
insert into private.code_cooldowns (user_id, room_id, code_wrong_streak, code_locked_until)
select user_id, room_id, code_wrong_streak, code_locked_until
from (select distinct on (user_id, room_id) * from public.game_sessions
      order by user_id, room_id, last_played_at desc) latest
where code_wrong_streak > 0 or code_locked_until > now();

create or replace function private.remember_code_cooldown()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.code_cooldowns (user_id, room_id, code_wrong_streak, code_locked_until)
  values (new.user_id, new.room_id, new.code_wrong_streak, new.code_locked_until)
  on conflict (user_id, room_id) do update
    set code_wrong_streak = excluded.code_wrong_streak,
        code_locked_until = excluded.code_locked_until,
        updated_at = now();
  return null;
end;
$$;

create trigger game_sessions_remember_code_cooldown
  after update of code_wrong_streak, code_locked_until on public.game_sessions
  for each row
  when (old.code_wrong_streak is distinct from new.code_wrong_streak
        or old.code_locked_until is distinct from new.code_locked_until)
  execute function private.remember_code_cooldown();

-- The body of 20261023000500_gameplay.sql, except that a new session starts
-- with the streak and lock its player left on the room.
create or replace function public.start_or_resume_session(p_room_id uuid)
returns public.game_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_room     public.rooms;
  v_session  public.game_sessions;
  v_def      jsonb;
  v_cooldown private.code_cooldowns;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found
     or not (v_room.owner_id = v_uid or (v_room.kind = 'tutorial' and v_room.status = 'ready')) then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  if v_room.current_version_id is null then
    raise exception 'room is not playable yet' using errcode = '55000';
  end if;

  select * into v_session from public.game_sessions
  where user_id = v_uid and room_id = p_room_id and status = 'active';
  if found then
    return v_session;   -- resume (keeps the version the session started on)
  end if;

  select public_definition into v_def from public.puzzle_versions where id = v_room.current_version_id;
  select * into v_cooldown from private.code_cooldowns where user_id = v_uid and room_id = p_room_id;

  insert into public.game_sessions (user_id, room_id, puzzle_version_id, state, code_wrong_streak, code_locked_until)
  values (
    v_uid, p_room_id, v_room.current_version_id,
    jsonb_build_object(
      'solved', '[]'::jsonb,
      'inventory', '[]'::jsonb,
      'revealed_hotspots', coalesce((
        select jsonb_agg(h ->> 'id') from jsonb_array_elements(v_def -> 'hotspots') h
        where coalesce((h ->> 'hidden')::boolean, false) = false), '[]'::jsonb)),
    coalesce(v_cooldown.code_wrong_streak, 0), v_cooldown.code_locked_until)
  on conflict (user_id, room_id) where status = 'active' do nothing
  returning * into v_session;

  if v_session.id is null then   -- lost a race with a concurrent call
    select * into v_session from public.game_sessions
    where user_id = v_uid and room_id = p_room_id and status = 'active';
  end if;

  update public.rooms set last_activity_at = now() where id = p_room_id and owner_id = v_uid;
  return v_session;
end;
$$;

-- ---------------------------------------------------------------------------
-- The puzzle engine: the body of 20261024000200_hints_and_cooldown.sql plus
-- the accuse action and state.contradicted.
-- p_action is one of:
--   { "type": "inspect",  "hotspot_id": "desk_drawer" }
--   { "type": "solve",    "puzzle_id": "safe_code", "answer": "4096" }
--   { "type": "use_item", "item_id": "brass_key", "hotspot_id": "cabinet" }
--   { "type": "combine",  "item_ids": ["note_a", "note_b"] }
--   { "type": "accuse",   "puzzle_id": "name_the_killer",
--     "suspect_id": "s_ivy", "motive_id": "m_debt", "method_id": "x_tea" }
-- Returns:
--   { outcome: solved | wrong | nothing | invalid,
--     puzzle_id, message, gained_items, consumed_items, revealed_hotspots,
--     completed, state }
--   state = { solved, inventory, revealed_hotspots, contradicted }, where
--   contradicted lists the accused suspect of every accusation whose suspect
--   evidence item is held (an alibi the player can already see broken).
-- Accuse:
--   An unknown option id in any dimension is { outcome: "invalid",
--   message: "Pick one of each." }, decided from the public options alone.
--   A wrong triple, whichever parts are wrong, is always exactly
--   { outcome: "wrong", puzzle_id, message: "That doesn't add up." }
--   (plus retry_after when it starts the lock), so nothing leaks about which
--   part was right.
-- Cooldown (solve and accuse share one streak and one lock, which a new
-- session on the same room inherits; inspect/use_item/combine are never
-- blocked):
--   The wrong answer that reaches code_cooldown_wrong_answers (default 8) still
--   returns outcome "wrong" and also carries "retry_after". Until then, every
--   solve and accuse returns, without writing anything:
--     { "outcome": "invalid", "reason": "cooldown",
--       "retry_after": "<timestamptz>", "message": "..." }
--   Clients branch on `reason`, never on `message`.
-- ---------------------------------------------------------------------------
create or replace function public.submit_action(p_session_id uuid, p_action jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := private.require_user();
  v_session   public.game_sessions;
  v_room      public.rooms;
  v_def       jsonb;
  v_secret    jsonb;
  v_type      text := p_action ->> 'type';
  v_solved    text[];
  v_inventory text[];
  v_revealed  text[];
  v_puzzle    jsonb;
  v_sol       jsonb;
  v_answer    jsonb;
  v_target    text;
  v_items     text[];
  v_gained    text[] := '{}';
  v_consumed  text[] := '{}';
  v_reveal    text[] := '{}';
  v_completed boolean := false;
  v_state     jsonb;
  v_lock      timestamptz;
begin
  if p_action is null or jsonb_typeof(p_action) <> 'object' or octet_length(p_action::text) > 2048 then
    raise exception 'invalid action' using errcode = '22023';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id for update;
  if not found or v_session.user_id <> v_uid then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if v_session.status <> 'active' then
    raise exception 'session is not active' using errcode = '55000';
  end if;

  select public_definition into v_def from public.puzzle_versions where id = v_session.puzzle_version_id;
  select solution into v_secret from private.puzzle_solutions where puzzle_version_id = v_session.puzzle_version_id;
  if v_def is null or v_secret is null then
    raise exception 'puzzle definition missing' using errcode = 'P0002';
  end if;

  v_solved    := array(select jsonb_array_elements_text(v_session.state -> 'solved'));
  v_inventory := array(select jsonb_array_elements_text(v_session.state -> 'inventory'));
  v_revealed  := array(select jsonb_array_elements_text(v_session.state -> 'revealed_hotspots'));

  -- Find the first matching, unlocked, unsolved puzzle for this action.
  if v_type = 'inspect' then
    v_target := p_action ->> 'hotspot_id';
    if v_target is null or not (v_target = any(v_revealed)) then
      return jsonb_build_object('outcome', 'invalid', 'message', 'That is not something you can interact with yet.');
    end if;
    select p into v_puzzle from jsonb_array_elements(v_def -> 'puzzles') p
    where p ->> 'kind' = 'inspect' and p ->> 'hotspot_id' = v_target
      and not ((p ->> 'id') = any(v_solved))
      and not exists (select 1 from jsonb_array_elements_text(coalesce(p -> 'requires', '[]')) r where not (r = any(v_solved)))
    limit 1;

  elsif v_type = 'solve' then
    -- Cooldown: no code is checked (right or wrong) while the lock holds.
    if v_session.code_locked_until > now() then
      return jsonb_build_object(
        'outcome', 'invalid',
        'reason', 'cooldown',
        'retry_after', v_session.code_locked_until,
        'message', 'The lock needs a rest. Try another code in a few minutes; everything else is still within reach.');
    end if;
    select p into v_puzzle from jsonb_array_elements(v_def -> 'puzzles') p
    where p ->> 'id' = p_action ->> 'puzzle_id' and p ->> 'kind' = 'code';
    if v_puzzle is null or (v_puzzle ->> 'id') = any(v_solved)
       or not ((v_puzzle ->> 'hotspot_id') = any(v_revealed))
       or exists (select 1 from jsonb_array_elements_text(coalesce(v_puzzle -> 'requires', '[]')) r where not (r = any(v_solved))) then
      return jsonb_build_object('outcome', 'invalid', 'message', 'That puzzle is not available.');
    end if;
    if private.normalize_answer(p_action ->> 'answer')
       is distinct from private.normalize_answer(v_secret -> 'puzzles' -> (v_puzzle ->> 'id') ->> 'answer') then
      -- The wrong answer that completes the streak starts the lock and resets the streak.
      if v_session.code_wrong_streak + 1 >= coalesce(private.config_int('code_cooldown_wrong_answers'), 8) then
        v_lock := now() + make_interval(mins => coalesce(private.config_int('code_cooldown_minutes'), 10));
      end if;
      update public.game_sessions
         set wrong_answer_count = wrong_answer_count + 1, action_count = action_count + 1, last_played_at = now(),
             code_wrong_streak = case when v_lock is null then code_wrong_streak + 1 else 0 end,
             code_locked_until = v_lock
       where id = v_session.id;
      return jsonb_build_object('outcome', 'wrong', 'puzzle_id', v_puzzle ->> 'id', 'message', 'Nothing happens.')
        || case when v_lock is null then '{}'::jsonb else jsonb_build_object('retry_after', v_lock) end;
    end if;

  elsif v_type = 'use_item' then
    v_target := p_action ->> 'hotspot_id';
    if not ((p_action ->> 'item_id') = any(v_inventory)) or v_target is null or not (v_target = any(v_revealed)) then
      return jsonb_build_object('outcome', 'invalid', 'message', 'You can''t do that.');
    end if;
    select p into v_puzzle from jsonb_array_elements(v_def -> 'puzzles') p
    where p ->> 'kind' = 'use_item' and p ->> 'hotspot_id' = v_target
      and v_secret -> 'puzzles' -> (p ->> 'id') ->> 'item_id' = p_action ->> 'item_id'
      and not ((p ->> 'id') = any(v_solved))
      and not exists (select 1 from jsonb_array_elements_text(coalesce(p -> 'requires', '[]')) r where not (r = any(v_solved)))
    limit 1;

  elsif v_type = 'combine' then
    if jsonb_typeof(p_action -> 'item_ids') <> 'array' or jsonb_array_length(p_action -> 'item_ids') <> 2 then
      return jsonb_build_object('outcome', 'invalid', 'message', 'Pick two items to combine.');
    end if;
    v_items := array(select jsonb_array_elements_text(p_action -> 'item_ids'));
    if not (v_items <@ v_inventory) then
      return jsonb_build_object('outcome', 'invalid', 'message', 'You don''t have those items.');
    end if;
    select p into v_puzzle from jsonb_array_elements(v_def -> 'puzzles') p
    where p ->> 'kind' = 'combine'
      and not ((p ->> 'id') = any(v_solved))
      and array(select jsonb_array_elements_text(v_secret -> 'puzzles' -> (p ->> 'id') -> 'inputs')) @> v_items
      and array(select jsonb_array_elements_text(v_secret -> 'puzzles' -> (p ->> 'id') -> 'inputs')) <@ v_items
      and not exists (select 1 from jsonb_array_elements_text(coalesce(p -> 'requires', '[]')) r where not (r = any(v_solved)))
    limit 1;

  elsif v_type = 'accuse' then
    -- Cooldown: shared with codes and kept across sessions (private.code_cooldowns),
    -- so the same lock stops a walk through all 27 accusations.
    if v_session.code_locked_until > now() then
      return jsonb_build_object(
        'outcome', 'invalid',
        'reason', 'cooldown',
        'retry_after', v_session.code_locked_until,
        'message', 'Take a breath. Try another accusation in a few minutes; everything else is still within reach.');
    end if;
    select p into v_puzzle from jsonb_array_elements(v_def -> 'puzzles') p
    where p ->> 'id' = p_action ->> 'puzzle_id' and p ->> 'kind' = 'accuse';
    if v_puzzle is null or (v_puzzle ->> 'id') = any(v_solved)
       or exists (select 1 from jsonb_array_elements_text(coalesce(v_puzzle -> 'requires', '[]')) r where not (r = any(v_solved))) then
      return jsonb_build_object('outcome', 'invalid', 'message', 'That puzzle is not available.');
    end if;
    -- Decided from the public options alone, so it says nothing about the answer.
    if not exists (select 1 from jsonb_array_elements(coalesce(v_puzzle -> 'suspects', '[]')) o where o ->> 'id' = p_action ->> 'suspect_id')
       or not exists (select 1 from jsonb_array_elements(coalesce(v_puzzle -> 'motives', '[]')) o where o ->> 'id' = p_action ->> 'motive_id')
       or not exists (select 1 from jsonb_array_elements(coalesce(v_puzzle -> 'methods', '[]')) o where o ->> 'id' = p_action ->> 'method_id') then
      return jsonb_build_object('outcome', 'invalid', 'message', 'Pick one of each.');
    end if;
    v_answer := v_secret -> 'puzzles' -> (v_puzzle ->> 'id') -> 'answer';
    if (p_action ->> 'suspect_id') is distinct from (v_answer ->> 'suspect')
       or (p_action ->> 'motive_id') is distinct from (v_answer ->> 'motive')
       or (p_action ->> 'method_id') is distinct from (v_answer ->> 'method') then
      -- Exactly the wrong-code path: same streak, same lock, one reply for every wrong triple.
      if v_session.code_wrong_streak + 1 >= coalesce(private.config_int('code_cooldown_wrong_answers'), 8) then
        v_lock := now() + make_interval(mins => coalesce(private.config_int('code_cooldown_minutes'), 10));
      end if;
      update public.game_sessions
         set wrong_answer_count = wrong_answer_count + 1, action_count = action_count + 1, last_played_at = now(),
             code_wrong_streak = case when v_lock is null then code_wrong_streak + 1 else 0 end,
             code_locked_until = v_lock
       where id = v_session.id;
      return jsonb_build_object('outcome', 'wrong', 'puzzle_id', v_puzzle ->> 'id', 'message', 'That doesn''t add up.')
        || case when v_lock is null then '{}'::jsonb else jsonb_build_object('retry_after', v_lock) end;
    end if;

  else
    return jsonb_build_object('outcome', 'invalid', 'message', 'Unknown action.');
  end if;

  if v_puzzle is null then
    -- No state change, so no write (keeps hot paths cheap).
    return jsonb_build_object('outcome', 'nothing', 'message', 'Nothing interesting happens.');
  end if;

  -- Apply rewards
  v_sol      := v_secret -> 'puzzles' -> (v_puzzle ->> 'id');
  v_gained   := array(select jsonb_array_elements_text(coalesce(v_sol -> 'rewards' -> 'items', '[]')));
  v_consumed := array(select jsonb_array_elements_text(coalesce(v_sol -> 'rewards' -> 'consume_items', '[]')));
  v_reveal   := array(select jsonb_array_elements_text(coalesce(v_sol -> 'rewards' -> 'reveal_hotspots', '[]')));

  v_solved    := v_solved || (v_puzzle ->> 'id');
  v_inventory := array(select distinct x from unnest(v_inventory || v_gained) x where not (x = any(v_consumed)));
  v_revealed  := array(select distinct x from unnest(v_revealed || v_reveal) x);

  v_completed := not exists (
    select 1 from jsonb_array_elements_text(v_def -> 'exit' -> 'requires') r where not (r = any(v_solved)));

  v_state := jsonb_build_object(
    'solved', to_jsonb(v_solved),
    'inventory', to_jsonb(v_inventory),
    'revealed_hotspots', to_jsonb(v_revealed),
    -- Only what the player already holds: the suspect evidence names the culprit.
    'contradicted', to_jsonb(array(
      select v_secret -> 'puzzles' -> (p ->> 'id') -> 'answer' ->> 'suspect'
      from jsonb_array_elements(v_def -> 'puzzles') with ordinality as e(p, ord)
      where p ->> 'kind' = 'accuse'
        and (v_secret -> 'puzzles' -> (p ->> 'id') -> 'evidence' ->> 'suspect') = any(v_inventory)
      order by ord)));

  update public.game_sessions
     set state = v_state,
         action_count = action_count + 1,
         last_played_at = now(),
         -- a correct code or accusation clears the wrong-answer streak
         code_wrong_streak = case when v_type in ('solve', 'accuse') then 0 else code_wrong_streak end,
         status = case when v_completed then 'completed' else status end,
         completed_at = case when v_completed then now() else completed_at end
   where id = v_session.id;

  if v_completed then
    select * into v_room from public.rooms where id = v_session.room_id;
    if v_room.kind = 'tutorial' then
      update public.profiles set tutorial_completed_at = coalesce(tutorial_completed_at, now()) where id = v_uid;
    end if;
  end if;

  return jsonb_build_object(
    'outcome', 'solved',
    'puzzle_id', v_puzzle ->> 'id',
    'message', coalesce(v_sol ->> 'message', 'Something changed.'),
    'gained_items', to_jsonb(v_gained),
    'consumed_items', to_jsonb(v_consumed),
    'revealed_hotspots', to_jsonb(v_reveal),
    'completed', v_completed,
    'exit_message', case when v_completed then v_def -> 'exit' ->> 'message' end,
    'state', v_state);
end;
$$;

-- ---------------------------------------------------------------------------
-- Hints: the body of 20261024000200_hints_and_cooldown.sql, with accuse
-- treated like combine (it has no hotspot, so its requires alone make it
-- attemptable). Three rungs per puzzle live in the secret solution:
--   puzzles[<puzzle_id>].hints = [nudge, direction, reveal]   (1-3 entries)
-- The ladder is pinned to the player's next step: the first unsolved puzzle,
-- in definition order, that can be attempted right now (requires met; hotspot
-- revealed unless combine or accuse; use_item item held; combine inputs both
-- held).
-- If nothing is attemptable, the first unsolved puzzle whose requires are met.
-- The target is stored in hint_progress and kept until that puzzle is solved.
--
-- p_rung is the rung the player wants to see (1-based):
--   already revealed for the target -> returned again, nothing charged
--   exactly the next rung           -> revealed, hints_used + 1
--   anything else                   -> status "rung_unavailable"
-- The session row lock (as in submit_action) serializes concurrent calls, so
-- two simultaneous requests for the same rung charge once.
--
-- Returns one of:
--   { status: "ok", puzzle_id, rung, total_rungs, hint, already_revealed, hints_used }
--   { status: "disabled", hints_used, message }               -- user_settings.hints_enabled = false
--   { status: "no_hints", puzzle_id, total_rungs: 0, hints_used, message }
--   { status: "rung_unavailable", puzzle_id, rung, next_rung (null when all
--     rungs are shown), total_rungs, hints_used, message }
-- Raises (like submit_action) for a missing, foreign, or inactive session.
-- ---------------------------------------------------------------------------
create or replace function public.use_hint(p_session_id uuid, p_rung integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := private.require_user();
  v_session   public.game_sessions;
  v_def       jsonb;
  v_secret    jsonb;
  v_solved    text[];
  v_inventory text[];
  v_revealed  text[];
  v_target    text;
  v_hints     jsonb;
  v_total     integer;
  v_rungs     jsonb;     -- rung texts already shown for v_target
  v_shown     integer;
begin
  select * into v_session from public.game_sessions where id = p_session_id for update;
  if not found or v_session.user_id <> v_uid then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if v_session.status <> 'active' then
    raise exception 'session is not active' using errcode = '55000';
  end if;

  if not coalesce((select hints_enabled from public.user_settings where user_id = v_uid), true) then
    return jsonb_build_object(
      'status', 'disabled',
      'hints_used', v_session.hints_used,
      'message', 'Hints are turned off in settings.');
  end if;

  select public_definition into v_def from public.puzzle_versions where id = v_session.puzzle_version_id;
  select solution into v_secret from private.puzzle_solutions where puzzle_version_id = v_session.puzzle_version_id;
  if v_def is null or v_secret is null then
    raise exception 'puzzle definition missing' using errcode = 'P0002';
  end if;

  v_solved    := array(select jsonb_array_elements_text(v_session.state -> 'solved'));
  v_inventory := array(select jsonb_array_elements_text(v_session.state -> 'inventory'));
  v_revealed  := array(select jsonb_array_elements_text(v_session.state -> 'revealed_hotspots'));

  -- Keep the stored target until it is solved, so rungs never jump between puzzles.
  v_target := v_session.hint_progress ->> 'puzzle_id';
  if v_target is null or v_target = any(v_solved)
     or not exists (select 1 from jsonb_array_elements(v_def -> 'puzzles') p where p ->> 'id' = v_target) then
    select p ->> 'id' into v_target
    from jsonb_array_elements(v_def -> 'puzzles') with ordinality as e(p, ord)
    where not ((p ->> 'id') = any(v_solved))
      and not exists (select 1 from jsonb_array_elements_text(coalesce(p -> 'requires', '[]')) r where not (r = any(v_solved)))
      and (p ->> 'kind' in ('combine', 'accuse') or (p ->> 'hotspot_id') = any(v_revealed))
      and (p ->> 'kind' <> 'use_item'
           or (v_secret -> 'puzzles' -> (p ->> 'id') ->> 'item_id') = any(v_inventory))
      and (p ->> 'kind' <> 'combine'
           or not exists (select 1 from jsonb_array_elements_text(coalesce(v_secret -> 'puzzles' -> (p ->> 'id') -> 'inputs', '[]')) i
                          where not (i = any(v_inventory))))
    order by ord
    limit 1;

    if v_target is null then
      select p ->> 'id' into v_target
      from jsonb_array_elements(v_def -> 'puzzles') with ordinality as e(p, ord)
      where not ((p ->> 'id') = any(v_solved))
        and not exists (select 1 from jsonb_array_elements_text(coalesce(p -> 'requires', '[]')) r where not (r = any(v_solved)))
      order by ord
      limit 1;
    end if;
  end if;

  v_rungs := case
               when v_target = v_session.hint_progress ->> 'puzzle_id'
                    and jsonb_typeof(v_session.hint_progress -> 'rungs') = 'array'
               then v_session.hint_progress -> 'rungs'
               else '[]'::jsonb
             end;
  v_shown := jsonb_array_length(v_rungs);

  v_hints := case
               when jsonb_typeof(v_secret -> 'puzzles' -> v_target -> 'hints') = 'array'
               then v_secret -> 'puzzles' -> v_target -> 'hints'
               else '[]'::jsonb
             end;
  v_total := jsonb_array_length(v_hints);

  if v_total = 0 then
    return jsonb_build_object(
      'status', 'no_hints',
      'puzzle_id', v_target,
      'total_rungs', 0,
      'hints_used', v_session.hints_used,
      'message', 'There is no hint for this step. Look again at what you already hold.');
  end if;

  -- Already shown: replay without charging.
  if p_rung between 1 and v_shown then
    return jsonb_build_object(
      'status', 'ok',
      'puzzle_id', v_target,
      'rung', p_rung,
      'total_rungs', v_total,
      'hint', v_hints ->> (p_rung - 1),
      'already_revealed', true,
      'hints_used', v_session.hints_used);
  end if;

  -- Only the next rung can be opened.
  if p_rung is distinct from v_shown + 1 or p_rung > v_total then
    return jsonb_build_object(
      'status', 'rung_unavailable',
      'puzzle_id', v_target,
      'rung', p_rung,
      'next_rung', case when v_shown < v_total then v_shown + 1 end,
      'total_rungs', v_total,
      'hints_used', v_session.hints_used,
      'message', 'Hints open one rung at a time.');
  end if;

  update public.game_sessions
     set hint_progress = jsonb_build_object('puzzle_id', v_target, 'rungs', v_rungs || jsonb_build_array(v_hints ->> (p_rung - 1))),
         hints_used = hints_used + 1,
         last_played_at = now()
   where id = v_session.id;

  return jsonb_build_object(
    'status', 'ok',
    'puzzle_id', v_target,
    'rung', p_rung,
    'total_rungs', v_total,
    'hint', v_hints ->> (p_rung - 1),
    'already_revealed', false,
    'hints_used', v_session.hints_used + 1);
end;
$$;

revoke all on function public.create_room(text, text) from public, anon, authenticated;
grant execute on function public.create_room(text, text) to authenticated;
revoke all on function public.request_room_generation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.request_room_generation(uuid, uuid, text) to authenticated;
revoke all on function public.worker_complete_generation_job(uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.worker_complete_generation_job(uuid, uuid, jsonb, jsonb, jsonb) to service_role;
revoke all on function private.validate_puzzle_definition(jsonb, jsonb) from public, anon, authenticated;
grant execute on function private.validate_puzzle_definition(jsonb, jsonb) to service_role;
revoke all on function private.remember_code_cooldown() from public, anon, authenticated;
revoke all on function public.start_or_resume_session(uuid) from public, anon, authenticated;
grant execute on function public.start_or_resume_session(uuid) to authenticated;
revoke all on function public.submit_action(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_action(uuid, jsonb) to authenticated;
revoke all on function public.use_hint(uuid, integer) from public, anon, authenticated;
grant execute on function public.use_hint(uuid, integer) to authenticated;
