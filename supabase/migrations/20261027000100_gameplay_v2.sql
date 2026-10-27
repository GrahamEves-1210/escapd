-- =============================================================================
-- Gameplay v2 (docs/GAMEPLAY_V2.md, chunk 3)
-- =============================================================================
-- Rooms of schema 2: objects with archetypes and an engine that interprets
-- rules. The deep checks (references, host rules, slot coverage, a solvable
-- room with no softlock or shortcut) run in TypeScript before the worker
-- completes a job (_shared/v2/validate.ts + simulate.ts), and the play-action
-- edge function runs the engine (_shared/v2/engine.ts + play.ts). The database
-- keeps a structural check of its own, stores both schemas side by side, and
-- gives the edge function two service-only calls: load a session with its
-- definition and secret, and save what one request changed.
--
--   * puzzle_versions / puzzle_solutions take schema_version 1 or 2;
--   * private.validate_puzzle_definition_v2: structural checks only;
--   * worker_complete_generation_job: v2 output goes through the v2 check,
--     its genre is public.mode;
--   * new jobs ask for schema 2;
--   * worker_v2_play_load / worker_v2_play_save (service_role only).
--
-- A v2 session starts with v1's empty state from start_or_resume_session;
-- play.ts turns it into the engine's state on its first request. The state
-- keeps v1's three arrays (revealed_hotspots stays empty), so the table's
-- check holds. A wrong submit's cooldown is game_sessions.code_locked_until.
-- =============================================================================

alter table public.puzzle_versions drop constraint puzzle_versions_schema_version_check;
alter table public.puzzle_versions add constraint puzzle_versions_schema_version_check check (schema_version in (1, 2));
alter table public.puzzle_versions drop constraint puzzle_versions_definition_shape;
alter table public.puzzle_versions add constraint puzzle_versions_definition_shape check (
  jsonb_typeof(public_definition) = 'object'
  and public_definition -> 'schema_version' = to_jsonb(schema_version)
  and (
    (schema_version = 1
      and jsonb_typeof(public_definition -> 'hotspots') = 'array'
      and jsonb_typeof(public_definition -> 'puzzles') = 'array')
    or (schema_version = 2
      and jsonb_typeof(public_definition -> 'objects') = 'array')
  )
  and octet_length(public_definition::text) <= 262144
);

alter table private.puzzle_solutions drop constraint puzzle_solutions_schema_version_check;
alter table private.puzzle_solutions add constraint puzzle_solutions_schema_version_check check (schema_version in (1, 2));
-- The solution's shape check was declared inline; drop it by what it checks, whatever its name.
do $$
declare v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'private.puzzle_solutions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%puzzles%'
  loop
    execute format('alter table private.puzzle_solutions drop constraint %I', v_name);
  end loop;
end $$;
alter table private.puzzle_solutions add constraint puzzle_solutions_solution_check check (
  jsonb_typeof(solution) = 'object'
  and solution -> 'schema_version' = to_jsonb(schema_version)
  and (
    (schema_version = 1 and jsonb_typeof(solution -> 'puzzles') = 'object')
    or (schema_version = 2 and jsonb_typeof(solution -> 'rules') = 'array' and jsonb_typeof(solution -> 'steps') = 'array')
  )
);

alter table public.generation_jobs alter column output_schema_version set default 2;

-- -----------------------------------------------------------------------------
-- Structural check for a schema 2 room. Returns every problem found.
-- -----------------------------------------------------------------------------
create or replace function private.validate_puzzle_definition_v2(p_public jsonb, p_secret jsonb)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_errors  text[] := '{}';
  v_objects jsonb := p_public -> 'objects';
  v_photos  integer := coalesce(jsonb_array_length(case when jsonb_typeof(p_public -> 'photos') = 'array' then p_public -> 'photos' end), 0);
  v_o       jsonb;
  v_exits   integer := 0;
  v_ids     text[] := '{}';
  v_box     jsonb;
begin
  if jsonb_typeof(p_public) <> 'object' or p_public -> 'schema_version' <> '2'::jsonb then
    return array['public.schema_version must be 2'];
  end if;
  if coalesce(p_public ->> 'mode', '') not in ('noir', 'crime_scene', 'paranormal') then
    v_errors := v_errors || 'public.mode must be noir, crime_scene or paranormal'::text;
  end if;
  if coalesce(char_length(p_public ->> 'title'), 0) not between 1 and 80 then
    v_errors := v_errors || 'public.title must be 1-80 characters'::text;
  end if;
  if coalesce(char_length(p_public ->> 'objective'), 0) not between 1 and 300 then
    v_errors := v_errors || 'public.objective must be 1-300 characters'::text;
  end if;
  if v_photos = 0 then
    v_errors := v_errors || 'public.photos must list the room''s photos'::text;
  end if;
  if jsonb_typeof(v_objects) <> 'array' or jsonb_array_length(v_objects) not between 2 and 40 then
    return v_errors || 'public.objects must be an array of 2-40 objects'::text;
  end if;
  for v_o in select * from jsonb_array_elements(v_objects) loop
    if coalesce(v_o ->> 'id', '') !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
      v_errors := v_errors || format('object id %s is not a valid id', coalesce(v_o ->> 'id', 'null'));
    elsif (v_o ->> 'id') = any(v_ids) then
      v_errors := v_errors || format('object id %s is repeated', v_o ->> 'id');
    end if;
    v_ids := v_ids || (v_o ->> 'id');
    if jsonb_typeof(v_o -> 'photo_index') <> 'number' or (v_o ->> 'photo_index')::numeric not between 0 and v_photos - 1 then
      v_errors := v_errors || format('object %s has no photo', v_o ->> 'id');
    end if;
    v_box := v_o -> 'box';
    if jsonb_typeof(v_box) <> 'object'
       or jsonb_typeof(v_box -> 'x') <> 'number' or jsonb_typeof(v_box -> 'y') <> 'number'
       or jsonb_typeof(v_box -> 'w') <> 'number' or jsonb_typeof(v_box -> 'h') <> 'number'
       or (v_box ->> 'x')::numeric < 0 or (v_box ->> 'y')::numeric < 0
       or (v_box ->> 'w')::numeric <= 0 or (v_box ->> 'h')::numeric <= 0
       or (v_box ->> 'x')::numeric + (v_box ->> 'w')::numeric > 1.0001
       or (v_box ->> 'y')::numeric + (v_box ->> 'h')::numeric > 1.0001 then
      v_errors := v_errors || format('object %s has a box outside the photo', v_o ->> 'id');
    end if;
    if coalesce((v_o ->> 'exit')::boolean, false) then
      v_exits := v_exits + 1;
    end if;
  end loop;
  if v_exits <> 1 then
    v_errors := v_errors || 'exactly one object must be the exit'::text;
  end if;
  if jsonb_typeof(p_public -> 'finale') <> 'object' or not ((p_public -> 'finale' ->> 'object') = any(v_ids)) then
    v_errors := v_errors || 'public.finale must name an object'::text;
  end if;
  if jsonb_typeof(p_public -> 'items') <> 'array' or jsonb_typeof(p_public -> 'cards') <> 'array' then
    v_errors := v_errors || 'public.items and public.cards must be arrays'::text;
  end if;

  if jsonb_typeof(p_secret) <> 'object' or p_secret -> 'schema_version' <> '2'::jsonb then
    return v_errors || 'secret.schema_version must be 2'::text;
  end if;
  if jsonb_typeof(p_secret -> 'slots') <> 'object' or jsonb_typeof(p_secret -> 'rules') <> 'array'
     or jsonb_typeof(p_secret -> 'steps') <> 'array' or jsonb_array_length(p_secret -> 'rules') = 0 then
    v_errors := v_errors || 'secret must hold slots, rules and steps'::text;
  end if;
  if coalesce(char_length(p_secret ->> 'ending'), 0) not between 1 and 600 then
    v_errors := v_errors || 'secret.ending must be 1-600 characters'::text;
  end if;
  -- Answers live in the secret only: no slot value may appear in the public definition's text.
  if jsonb_typeof(p_secret -> 'slots') = 'object' and exists (
       select 1 from jsonb_each(p_secret -> 'slots') s
       where char_length(s.value ->> 'value') >= 3
         and coalesce(s.value ->> 'kind', '') not in ('option', 'object')
         and position(lower(s.value ->> 'value') in lower(p_public::text)) > 0) then
    v_errors := v_errors || 'an answer appears in the public definition'::text;
  end if;
  return v_errors;
end;
$$;

-- -----------------------------------------------------------------------------
-- Completing a job: the body of 20261026000100_genres_and_accuse.sql, with a
-- schema 2 branch (v2 check, genre from public.mode, schema_version stored).
-- -----------------------------------------------------------------------------
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
  v_schema   smallint := case when p_public_definition -> 'schema_version' = '2'::jsonb then 2 else 1 end;
begin
  select * into v_room from public.rooms where id = v_job.room_id for update;

  v_errors := case when v_schema = 2
    then private.validate_puzzle_definition_v2(p_public_definition, p_solution)
    else private.validate_puzzle_definition(p_public_definition, p_solution) end;

  -- Photo references must point at this room's photos.
  select coalesce(array_agg(id::text), '{}') into v_photo_ids from public.room_photos where room_id = v_room.id;
  if cardinality(v_errors) = 0 and exists (
       select 1 from jsonb_array_elements(p_public_definition -> 'photos') ph
       where not (coalesce(ph ->> 'photo_id', '') = any(v_photo_ids))) then
    v_errors := v_errors || 'photos[].photo_id must reference this room''s uploaded photos'::text;
  end if;

  -- The case must be of the genre the job was requested with (absent means noir).
  if cardinality(v_errors) = 0
     and coalesce(p_public_definition ->> case when v_schema = 2 then 'mode' else 'genre' end, 'noir') is distinct from v_job.genre then
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
    v_room.id, v_room.owner_id, v_version, v_schema, 'published', p_public_definition,
    encode(sha256(convert_to(p_public_definition::text || p_solution::text, 'UTF8')), 'hex'),
    v_job.id)
  returning id into v_pv_id;

  insert into private.puzzle_solutions (puzzle_version_id, schema_version, solution)
  values (v_pv_id, v_schema, p_solution);

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

-- -----------------------------------------------------------------------------
-- play-action: load a v2 session (the caller's own) with its definition and secret.
-- -----------------------------------------------------------------------------
create or replace function public.worker_v2_play_load(p_session_id uuid, p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id, 'status', s.status, 'state', s.state,
      'code_locked_until', s.code_locked_until, 'updated_at', s.updated_at),
    'definition', pv.public_definition,
    'secret', ps.solution)
  from public.game_sessions s
  join public.puzzle_versions pv on pv.id = s.puzzle_version_id
  join private.puzzle_solutions ps on ps.puzzle_version_id = pv.id
  where s.id = p_session_id and s.user_id = p_user_id and pv.schema_version = 2;
$$;

-- What one request changed. Refused (false) when the session moved on since
-- it was loaded (another request saved first) or is no longer active.
create or replace function public.worker_v2_play_save(
  p_session_id uuid, p_expected_updated_at timestamptz, p_state jsonb,
  p_wrong integer, p_hints integer, p_actions integer, p_locked_until timestamptz, p_completed boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.game_sessions
     set state = p_state,
         wrong_answer_count = wrong_answer_count + greatest(p_wrong, 0),
         hints_used = hints_used + greatest(p_hints, 0),
         action_count = action_count + greatest(p_actions, 0),
         code_locked_until = p_locked_until,
         last_played_at = now(),
         status = case when p_completed then 'completed' else status end,
         completed_at = case when p_completed then coalesce(completed_at, now()) else completed_at end
   where id = p_session_id and status = 'active' and updated_at = p_expected_updated_at;
  if not found then
    return false;
  end if;
  update public.rooms r set last_activity_at = now()
    from public.game_sessions s where s.id = p_session_id and r.id = s.room_id;
  return true;
end;
$$;

revoke all on function private.validate_puzzle_definition_v2(jsonb, jsonb) from public, anon, authenticated;
grant execute on function private.validate_puzzle_definition_v2(jsonb, jsonb) to service_role;
revoke all on function public.worker_complete_generation_job(uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.worker_complete_generation_job(uuid, uuid, jsonb, jsonb, jsonb) to service_role;
revoke all on function public.worker_v2_play_load(uuid, uuid) from public, anon, authenticated;
grant execute on function public.worker_v2_play_load(uuid, uuid) to service_role;
revoke all on function public.worker_v2_play_save(uuid, timestamptz, jsonb, integer, integer, integer, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.worker_v2_play_save(uuid, timestamptz, jsonb, integer, integer, integer, timestamptz, boolean) to service_role;
