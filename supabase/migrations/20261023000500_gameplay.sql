-- =============================================================================
-- Gameplay sessions and server-side puzzle validation
-- =============================================================================
-- Clients can READ their own sessions but never write them directly.
-- Every state change goes through public.submit_action(), which validates the
-- action against the published definition and the private solution, then
-- updates the session atomically (row lock). Completion is decided here, not
-- by the client.
--
-- Session state (jsonb):
--   { "solved": [puzzle ids], "inventory": [item ids],
--     "revealed_hotspots": [hotspot ids] }
-- =============================================================================

create table public.game_sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  room_id            uuid not null references public.rooms (id) on delete cascade,
  puzzle_version_id  uuid not null references public.puzzle_versions (id) on delete cascade,
  status             text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  state              jsonb not null default '{"solved": [], "inventory": [], "revealed_hotspots": []}'::jsonb
                       check (
                         jsonb_typeof(state) = 'object'
                         and jsonb_typeof(state -> 'solved') = 'array'
                         and jsonb_typeof(state -> 'inventory') = 'array'
                         and jsonb_typeof(state -> 'revealed_hotspots') = 'array'
                       ),
  action_count       integer not null default 0 check (action_count >= 0),
  wrong_answer_count integer not null default 0 check (wrong_answer_count >= 0),
  hints_used         integer not null default 0 check (hints_used >= 0),
  started_at         timestamptz not null default now(),
  last_played_at     timestamptz not null default now(),
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint game_sessions_completed_at check ((status = 'completed') = (completed_at is not null))
);

create unique index game_sessions_one_active_per_room
  on public.game_sessions (user_id, room_id) where status = 'active';
create index game_sessions_user_recent_idx on public.game_sessions (user_id, last_played_at desc);
create index game_sessions_room_idx on public.game_sessions (room_id);
create index game_sessions_version_idx on public.game_sessions (puzzle_version_id);

create trigger game_sessions_updated_at before update on public.game_sessions
  for each row execute function private.set_updated_at();

alter table public.game_sessions enable row level security;

revoke all on table public.game_sessions from anon, authenticated;
grant select, delete on table public.game_sessions to authenticated;

create policy "game_sessions: read own"
  on public.game_sessions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "game_sessions: delete own"   -- lets players reset progress
  on public.game_sessions for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Start a new session or resume the active one for a room.
-- ---------------------------------------------------------------------------
create or replace function public.start_or_resume_session(p_room_id uuid)
returns public.game_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := private.require_user();
  v_room    public.rooms;
  v_session public.game_sessions;
  v_def     jsonb;
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

  insert into public.game_sessions (user_id, room_id, puzzle_version_id, state)
  values (
    v_uid, p_room_id, v_room.current_version_id,
    jsonb_build_object(
      'solved', '[]'::jsonb,
      'inventory', '[]'::jsonb,
      'revealed_hotspots', coalesce((
        select jsonb_agg(h ->> 'id') from jsonb_array_elements(v_def -> 'hotspots') h
        where coalesce((h ->> 'hidden')::boolean, false) = false), '[]'::jsonb)))
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

create or replace function public.abandon_session(p_session_id uuid)
returns public.game_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := private.require_user();
  v_session public.game_sessions;
begin
  update public.game_sessions set status = 'abandoned'
   where id = p_session_id and user_id = v_uid and status = 'active'
  returning * into v_session;
  if not found then
    raise exception 'active session not found' using errcode = 'P0002';
  end if;
  return v_session;
end;
$$;

-- Normalizes free-text answers: case-insensitive, ignores whitespace and
-- common separators so "12-34", "12 34" and "1234" match.
create or replace function private.normalize_answer(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(coalesce(p, '')), '[\s\-_.,:;''"]+', '', 'g')
$$;

-- ---------------------------------------------------------------------------
-- The puzzle engine.
-- p_action is one of:
--   { "type": "inspect",  "hotspot_id": "desk_drawer" }
--   { "type": "solve",    "puzzle_id": "safe_code", "answer": "4096" }
--   { "type": "use_item", "item_id": "brass_key", "hotspot_id": "cabinet" }
--   { "type": "combine",  "item_ids": ["note_a", "note_b"] }
-- Returns:
--   { outcome: solved | wrong | nothing | invalid,
--     puzzle_id, message, gained_items, consumed_items, revealed_hotspots,
--     completed, state }
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
  v_target    text;
  v_items     text[];
  v_gained    text[] := '{}';
  v_consumed  text[] := '{}';
  v_reveal    text[] := '{}';
  v_completed boolean := false;
  v_state     jsonb;
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
    select p into v_puzzle from jsonb_array_elements(v_def -> 'puzzles') p
    where p ->> 'id' = p_action ->> 'puzzle_id' and p ->> 'kind' = 'code';
    if v_puzzle is null or (v_puzzle ->> 'id') = any(v_solved)
       or not ((v_puzzle ->> 'hotspot_id') = any(v_revealed))
       or exists (select 1 from jsonb_array_elements_text(coalesce(v_puzzle -> 'requires', '[]')) r where not (r = any(v_solved))) then
      return jsonb_build_object('outcome', 'invalid', 'message', 'That puzzle is not available.');
    end if;
    if private.normalize_answer(p_action ->> 'answer')
       is distinct from private.normalize_answer(v_secret -> 'puzzles' -> (v_puzzle ->> 'id') ->> 'answer') then
      update public.game_sessions
         set wrong_answer_count = wrong_answer_count + 1, action_count = action_count + 1, last_played_at = now()
       where id = v_session.id;
      return jsonb_build_object('outcome', 'wrong', 'puzzle_id', v_puzzle ->> 'id', 'message', 'Nothing happens.');
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
    'revealed_hotspots', to_jsonb(v_revealed));

  update public.game_sessions
     set state = v_state,
         action_count = action_count + 1,
         last_played_at = now(),
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
-- What the app should show/allow for the current user (server-computed).
-- ---------------------------------------------------------------------------
create or replace function public.get_my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := private.require_user();
  v_anon      boolean := private.is_anonymous();
  v_entitled  boolean := private.has_active_entitlement(v_uid);
  v_used      integer := private.generations_used(v_uid);
  v_cap       integer := private.config_int('generation_cap_per_window');
  v_ent       public.entitlements;
  v_tutorial  timestamptz;
begin
  select * into v_ent from public.entitlements
  where user_id = v_uid and entitlement_key = 'custom_rooms'
  order by (status in ('active', 'billing_issue')) desc, expires_at desc nulls first
  limit 1;
  select tutorial_completed_at into v_tutorial from public.profiles where id = v_uid;

  return jsonb_build_object(
    'user_id', v_uid,
    'is_anonymous', v_anon,
    'tutorial_completed', v_tutorial is not null,
    'has_custom_rooms_entitlement', v_entitled,
    'entitlement_status', v_ent.status,
    'entitlement_expires_at', v_ent.expires_at,
    'will_renew', v_ent.will_renew,
    'can_generate', v_entitled and not v_anon and v_used < v_cap,
    'generations_used', v_used,
    'generations_cap', v_cap,
    'min_photos_per_room', private.config_int('min_photos_per_room'),
    'max_photos_per_room', private.config_int('max_photos_per_room'));
end;
$$;

revoke all on function private.normalize_answer(text) from public, anon, authenticated;
revoke all on function public.start_or_resume_session(uuid) from public, anon, authenticated;
revoke all on function public.abandon_session(uuid) from public, anon, authenticated;
revoke all on function public.submit_action(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_my_access() from public, anon, authenticated;
grant execute on function public.start_or_resume_session(uuid) to authenticated;
grant execute on function public.abandon_session(uuid) to authenticated;
grant execute on function public.submit_action(uuid, jsonb) to authenticated;
grant execute on function public.get_my_access() to authenticated;
