-- =============================================================================
-- Escapd database tests, part 4: gameplay v2 storage (20261027000100).
-- A schema 2 job by default; the worker publishes a v2 room through the v2
-- check (and refuses two exits, a missing photo, an answer in the public room);
-- start_or_resume_session on a v2 room; the play-action load and save calls
-- (the caller's own session only, a stale save refused, completion).
-- Run via scripts/test-db.sh (after 03).
-- =============================================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;
\o /dev/null

drop schema if exists tests cascade;
create schema tests;
grant usage on schema tests to public;

create function tests.claims(p_uid uuid, p_anon boolean default false) returns void
language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
$$;

create function tests.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'TEST FAILED: %', p_msg;
  end if;
  raise notice 'ok - %', p_msg;
end $$;
-- Runs p_sql and asserts it raises (optionally with a matching message/SQLSTATE).
create function tests.throws(p_sql text, p_msg text, p_like text default null) returns void language plpgsql as $$
declare v_err text; v_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_err = message_text, v_state = returned_sqlstate;
    if p_like is not null and v_err not ilike '%' || p_like || '%' and v_state <> p_like then
      raise exception 'TEST FAILED: % (raised "%" [%], expected like "%")', p_msg, v_err, v_state, p_like;
    end if;
    raise notice 'ok - % (raised: %)', p_msg, v_err;
    return;
  end;
  raise exception 'TEST FAILED: % (no error raised)', p_msg;
end $$;

insert into auth.users (id, email, is_anonymous) values
  ('44444444-0000-4000-8000-000000000044', 'v2@test.dev', false),
  ('55555555-0000-4000-8000-000000000055', 'other@test.dev', false);
insert into public.entitlements (user_id, provider, status)
values ('44444444-0000-4000-8000-000000000044', 'manual', 'active');

create temp table ctx (k text primary key, v text);
grant all on ctx to public;

-- =============================================================================
-- 1. A new job asks for schema 2
-- =============================================================================
begin;
select tests.claims('44444444-0000-4000-8000-000000000044');
set local role authenticated;
do $$
declare r public.rooms;
begin
  r := public.create_room('V2 room', 'noir');
  insert into ctx values ('room', r.id::text);
end $$;
commit;

insert into public.room_photos (room_id, owner_id, storage_path, position, mime_type)
select r.id, r.owner_id, r.owner_id || '/' || r.id || '/p' || n || '.jpg', n, 'image/jpeg'
from public.rooms r cross join generate_series(0, 2) n
where r.id = (select v from ctx where k = 'room')::uuid;

begin;
select tests.claims('44444444-0000-4000-8000-000000000044');
set local role authenticated;
do $$
declare j public.generation_jobs;
begin
  j := public.request_room_generation((select v from ctx where k = 'room')::uuid, gen_random_uuid());
  perform tests.ok(j.output_schema_version = 2, 'new generation jobs ask for schema 2');
end $$;
commit;

-- =============================================================================
-- 2. The worker publishes a v2 room through the v2 check
-- =============================================================================
begin;
set local role service_role;
do $$
declare
  v_room  uuid := (select v from ctx where k = 'room')::uuid;
  v_job   public.generation_jobs;
  v_res   jsonb;
  v_pub   jsonb;
  v_sec   jsonb;
  v_photos jsonb := (select jsonb_agg(jsonb_build_object('photo_id', id) order by position) from public.room_photos where room_id = v_room);
begin
  v_job := public.worker_claim_generation_job('v2-worker', 120);
  v_pub := jsonb_build_object(
    'schema_version', 2, 'mode', 'noir', 'title', 'The Second Ledger', 'objective', 'Open the door.',
    'photos', v_photos,
    'objects', '[{"id":"desk","photo_index":0,"box":{"x":0.1,"y":0.5,"w":0.3,"h":0.3},"label":"Desk","type":"desk","archetype":"Drawer","variant":"drawer","controls":[{"id":"open","domain":{"kind":"bool"}}],"initial":{"open":false,"locked":false}},
                 {"id":"door","photo_index":1,"box":{"x":0.5,"y":0.1,"w":0.3,"h":0.8},"label":"Door","type":"door","archetype":"Door","variant":"combination","controls":[],"submit":{"kind":"wheels","alphabet":"digits","count":3},"initial":{"open":false},"exit":true}]'::jsonb,
    'items', '[]'::jsonb,
    'cards', '[{"id":"card_1","title":"A slip","text":"Code: {{code}}"}]'::jsonb,
    'finale', '{"kind":"combination","object":"door","wheels":3,"alphabet":"digits"}'::jsonb);
  v_sec := '{"schema_version":2,"slots":{"code":{"kind":"code","value":"7|2|9","text":"729"}},
             "rules":[{"id":"rule_1","step":"step_1","trigger":{"on":"control","target":"desk","control":"open"},"when":[],"effects":[{"do":"show_card","card":"card_1"}]},
                      {"id":"rule_2","step":"step_2","trigger":{"on":"submit","object":"door"},"when":[{"if":"submitted","eq":{"slot":"code"}}],"effects":[{"do":"open","object":"door"},{"do":"complete"}]}],
             "steps":[{"id":"step_1","title":"Look inside","thread":0,"motif":"contain","object":"desk","requires":[],"hints":["a","b","c"]},
                      {"id":"step_2","title":"Out","thread":null,"motif":"finale","object":"door","requires":["step_1"],"hints":["a","b","c"]}],
             "ending":"The door gives."}'::jsonb;

  -- Two exits, a missing photo and an answer written into the public room are refused.
  perform tests.ok(cardinality(private.validate_puzzle_definition_v2(
      jsonb_set(v_pub, '{objects,0,exit}', 'true'), v_sec)) > 0, 'two exits are refused');
  perform tests.ok(cardinality(private.validate_puzzle_definition_v2(
      jsonb_set(v_pub, '{objects,0,photo_index}', '5'), v_sec)) > 0, 'an object on a photo the room lacks is refused');
  perform tests.ok(cardinality(private.validate_puzzle_definition_v2(
      jsonb_set(v_pub, '{objective}', '"Enter 7|2|9."'), v_sec)) > 0, 'an answer in the public room is refused');
  perform tests.ok(cardinality(private.validate_puzzle_definition_v2(v_pub, v_sec)) = 0, 'the valid v2 room passes');

  v_res := public.worker_complete_generation_job(v_job.id, v_job.lease_token, v_pub, v_sec,
    '{"model":"test-model","input_tokens":200,"output_tokens":80,"cost_usd":0.02}'::jsonb);
  perform tests.ok((v_res ->> 'ok')::boolean, 'a v2 room is published');
  perform tests.ok((select schema_version from public.puzzle_versions where id = (v_res ->> 'puzzle_version_id')::uuid) = 2,
    'its version is stored as schema 2');
  perform tests.ok((select schema_version from private.puzzle_solutions where puzzle_version_id = (v_res ->> 'puzzle_version_id')::uuid) = 2,
    'its secret is stored as schema 2');
  perform tests.ok((select status from public.rooms where id = v_room) = 'ready', 'the room is ready');
end $$;
commit;

-- =============================================================================
-- 3. A session on it, and the play-action calls
-- =============================================================================
begin;
select tests.claims('44444444-0000-4000-8000-000000000044');
set local role authenticated;
do $$
declare s public.game_sessions;
begin
  s := public.start_or_resume_session((select v from ctx where k = 'room')::uuid);
  perform tests.ok(s.state -> 'revealed_hotspots' = '[]'::jsonb, 'a v2 session starts with v1''s empty state');
  insert into ctx values ('session', s.id::text);
  perform tests.ok(not has_function_privilege('authenticated', 'public.worker_v2_play_load(uuid, uuid)', 'execute')
      and not has_function_privilege('authenticated', 'public.worker_v2_play_save(uuid, timestamptz, jsonb, integer, integer, integer, timestamptz, boolean)', 'execute'),
    'players cannot call the play-action functions directly');
end $$;
commit;

begin;
set local role service_role;
do $$
declare
  v_session uuid := (select v from ctx where k = 'session')::uuid;
  v_loaded  jsonb;
  v_at      timestamptz;
  v_state   jsonb := '{"objects":{},"items":{},"inventory":[],"solved":["step_1"],"fired":[],"cards":["card_1"],"seen":[],"overlays":[],"completed":false,"hints":{"step_2":1},"revealed_hotspots":[]}';
begin
  perform tests.ok(public.worker_v2_play_load(v_session, '55555555-0000-4000-8000-000000000055') is null,
    'another player''s session does not load');
  v_loaded := public.worker_v2_play_load(v_session, '44444444-0000-4000-8000-000000000044');
  perform tests.ok(v_loaded -> 'secret' ->> 'ending' = 'The door gives.' and v_loaded -> 'definition' ->> 'title' = 'The Second Ledger',
    'the owner''s session loads with its definition and secret');
  v_at := (v_loaded -> 'session' ->> 'updated_at')::timestamptz;

  perform tests.ok(public.worker_v2_play_save(v_session, v_at, v_state, 1, 1, 1, now() + interval '5 seconds', false),
    'a save from the loaded version lands');
  perform tests.ok(not public.worker_v2_play_save(v_session, v_at, v_state, 0, 0, 1, null, false),
    'a second save from the same, now stale, version is refused');
  perform tests.ok((select wrong_answer_count = 1 and hints_used = 1 and action_count = 1 and code_locked_until > now()
                    and state -> 'solved' = '["step_1"]'::jsonb from public.game_sessions where id = v_session),
    'the save updates the state, the counts and the cooldown');

  v_at := (select updated_at from public.game_sessions where id = v_session);
  perform tests.ok(public.worker_v2_play_save(v_session, v_at, jsonb_set(v_state, '{completed}', 'true'), 0, 0, 1, null, true),
    'the winning save lands');
  perform tests.ok((select status = 'completed' and completed_at is not null from public.game_sessions where id = v_session),
    'the session is completed, so case closed reads its stats');
  v_at := (select updated_at from public.game_sessions where id = v_session);
  perform tests.ok(not public.worker_v2_play_save(v_session, v_at, v_state, 0, 0, 1, null, false),
    'a completed session takes no more saves');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
delete from auth.users where id in ('44444444-0000-4000-8000-000000000044', '55555555-0000-4000-8000-000000000055');
delete from private.storage_deletion_queue where object_path like '44444444-0000-4000-8000-000000000044/%';
drop schema tests cascade;
\o
\echo 'database tests (gameplay v2): all assertions passed'
