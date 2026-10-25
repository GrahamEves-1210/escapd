-- =============================================================================
-- Escapd database tests: permissions, RLS isolation, storage, entitlements,
-- generation pipeline, gameplay engine, deletion/retention.
-- Run via scripts/test-db.sh. Fails fast (ON_ERROR_STOP) on the first broken
-- assertion. Creates test users with fixed UUIDs; cleans them up at the end.
-- =============================================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;
\o /dev/null

-- ---------------------------------------------------------------------------
-- Test helpers (dropped at the end)
-- ---------------------------------------------------------------------------
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

grant execute on all functions in schema tests to public;

-- Fixed ids
-- A = 0a.., B = 0b.., G (guest) = 0c.., T = tutorial room (from seed)
insert into auth.users (id, email, is_anonymous) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'a@test.dev', false),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'b@test.dev', false),
  ('cccccccc-0000-4000-8000-00000000000c', null, true);

-- =============================================================================
-- 1. Schema-wide guarantees
-- =============================================================================
do $$
begin
  perform tests.ok(
    not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
    'RLS enabled on every public table');

  perform tests.ok(
    not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')),
    'anon cannot execute any public/private function');

  perform tests.ok(
    not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'worker\_%'
        and has_function_privilege('authenticated', p.oid, 'execute')),
    'authenticated cannot execute worker_* functions');

  perform tests.ok(
    not has_function_privilege('authenticated', 'public.billing_apply_revenuecat_event(jsonb)', 'execute'),
    'authenticated cannot execute billing_apply_revenuecat_event');

  perform tests.ok(
    not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and has_function_privilege('authenticated', p.oid, 'execute')
        and p.proname not in ('is_anonymous', 'can_upload_room_photo')),
    'only the two RLS helper functions in private are executable by authenticated');

  perform tests.ok(
    not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef
        and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')),
    'every SECURITY DEFINER function pins search_path');

  perform tests.ok(
    (select count(*) from public.profiles where id in (
      'aaaaaaaa-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-00000000000b','cccccccc-0000-4000-8000-00000000000c')) = 3
    and (select count(*) from public.user_settings where user_id in (
      'aaaaaaaa-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-00000000000b','cccccccc-0000-4000-8000-00000000000c')) = 3,
    'profile + settings rows are created for new auth users');
end $$;

-- =============================================================================
-- 2. anon role is locked out of data
-- =============================================================================
begin;
set local role anon;
select tests.throws('select * from public.rooms', 'anon cannot read rooms', 'permission denied');
select tests.throws('select * from public.profiles', 'anon cannot read profiles', 'permission denied');
select tests.throws('select public.get_my_access()', 'anon cannot call get_my_access', 'permission denied');
rollback;

-- =============================================================================
-- 3. Profiles, settings, rooms: per-user isolation
-- =============================================================================
begin;
select tests.claims('aaaaaaaa-0000-4000-8000-00000000000a');
set local role authenticated;
do $$
declare v_room public.rooms;
begin
  perform tests.ok((select count(*) from public.profiles) = 1, 'user A sees only own profile');
  update public.profiles set display_name = 'Ada' where id = auth.uid();
  perform tests.ok((select display_name from public.profiles) = 'Ada', 'user A can set display_name');
  perform tests.ok((select count(*) from public.user_settings) = 1, 'user A sees only own settings');
  update public.user_settings set haptics_enabled = false;
  perform tests.ok((select not haptics_enabled from public.user_settings), 'user A can update settings');

  perform tests.throws($q$update public.profiles set tutorial_completed_at = now()$q$,
    'client cannot set tutorial_completed_at', 'permission denied');
  perform tests.throws($q$insert into public.rooms (owner_id, title) values (auth.uid(), 'x')$q$,
    'client cannot insert rooms directly', 'permission denied');
  perform tests.throws($q$select * from private.puzzle_solutions$q$,
    'client cannot read secret solutions', 'permission denied');
  perform tests.throws($q$select * from private.billing_events$q$,
    'client cannot read billing events', 'permission denied');
  perform tests.throws($q$insert into public.entitlements (user_id, provider, status) values (auth.uid(), 'manual', 'active')$q$,
    'client cannot grant itself an entitlement', 'permission denied');
  perform tests.throws($q$select public.worker_claim_generation_job('evil')$q$,
    'client cannot claim generation jobs', 'permission denied');

  v_room := public.create_room('My bedroom');
  perform tests.ok(v_room.status = 'draft' and v_room.kind = 'custom' and v_room.owner_id = auth.uid(),
    'create_room makes a draft custom room owned by caller');
  perform tests.ok((select count(*) from public.rooms where kind = 'tutorial') = 1, 'tutorial room is visible');
  perform tests.throws($q$update public.rooms set status = 'ready'$q$,
    'client cannot change room status', 'permission denied');
end $$;
commit;

begin;
select tests.claims('bbbbbbbb-0000-4000-8000-00000000000b');
set local role authenticated;
do $$
declare v_n integer;
begin
  perform tests.ok((select count(*) from public.rooms where kind = 'custom') = 0, 'user B cannot see user A rooms');
  update public.rooms set title = 'hacked' where kind = 'custom';
  get diagnostics v_n = row_count;
  perform tests.ok(v_n = 0, 'user B cannot rename user A rooms');
  delete from public.rooms;
  get diagnostics v_n = row_count;
  perform tests.ok(v_n = 0, 'user B cannot delete A rooms or the tutorial');
  perform tests.ok((select count(*) from public.profiles) = 1, 'user B sees only own profile');
end $$;
commit;

-- Guest restrictions
begin;
select tests.claims('cccccccc-0000-4000-8000-00000000000c', true);
set local role authenticated;
select tests.throws($q$select public.create_room('guest room')$q$, 'guest cannot create custom rooms', 'full account');
commit;

-- =============================================================================
-- 4. Storage policies + photo registration
-- =============================================================================
create temp table ctx (k text primary key, v text);
grant all on ctx to public;
insert into ctx select 'room_a', id::text from public.rooms where owner_id = 'aaaaaaaa-0000-4000-8000-00000000000a';

begin;
select tests.claims('aaaaaaaa-0000-4000-8000-00000000000a');
set local role authenticated;
do $$
declare
  v_room text := (select v from ctx where k = 'room_a');
  v_a    text := 'aaaaaaaa-0000-4000-8000-00000000000a';
  v_b    text := 'bbbbbbbb-0000-4000-8000-00000000000b';
  v_p    public.room_photos;
begin
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('room-photos', v_a || '/' || v_room || '/p0.jpg', v_a::uuid, '{"mimetype":"image/jpeg","size":1000}'),
         ('room-photos', v_a || '/' || v_room || '/p1.jpg', v_a::uuid, '{"mimetype":"image/jpeg","size":1000}');
  perform tests.ok(true, 'owner can upload into own editable room folder');

  perform tests.throws(format($q$insert into storage.objects (bucket_id, name) values ('room-photos', '%s/%s/x.jpg')$q$, v_b, v_room),
    'cannot upload into another user''s folder', 'row-level security');
  perform tests.throws(format($q$insert into storage.objects (bucket_id, name) values ('room-photos', '%s/%s/x.jpg')$q$, v_a, gen_random_uuid()),
    'cannot upload into a room you do not own', 'row-level security');
  perform tests.throws(format($q$insert into storage.objects (bucket_id, name) values ('room-photos', '%s/x.jpg')$q$, v_a),
    'cannot upload outside the {user}/{room}/ layout', 'row-level security');

  perform tests.throws(format($q$select public.register_room_photo('%s', '%s/%s/missing.jpg', 0::smallint)$q$, v_room, v_a, v_room),
    'cannot register a photo that was never uploaded', 'not found');
  v_p := public.register_room_photo(v_room::uuid, v_a || '/' || v_room || '/p0.jpg', 0::smallint, 4032, 3024);
  perform tests.ok(v_p.mime_type = 'image/jpeg' and v_p.byte_size = 1000, 'register_room_photo records the verified upload');
  perform public.register_room_photo(v_room::uuid, v_a || '/' || v_room || '/p1.jpg', 1::smallint);
  perform tests.throws(format($q$select public.register_room_photo('%s', '%s/%s/p1.jpg', 2::smallint)$q$, v_room, v_a, v_room),
    'same file cannot be registered twice', 'duplicate');
end $$;
commit;

-- Guest cannot upload; B cannot read A's objects
begin;
select tests.claims('cccccccc-0000-4000-8000-00000000000c', true);
set local role authenticated;
select tests.throws(
  format($q$insert into storage.objects (bucket_id, name) values ('room-photos', 'cccccccc-0000-4000-8000-00000000000c/%s/x.jpg')$q$, gen_random_uuid()),
  'guest cannot upload room photos', 'row-level security');
rollback;

begin;
select tests.claims('bbbbbbbb-0000-4000-8000-00000000000b');
set local role authenticated;
do $$
begin
  perform tests.ok((select count(*) from storage.objects where bucket_id = 'room-photos') = 0, 'user B cannot read user A photos (storage)');
  perform tests.ok((select count(*) from public.room_photos) = 0, 'user B cannot read user A photo rows');
end $$;
rollback;

-- =============================================================================
-- 5. Entitlements via RevenueCat events (service_role path)
-- =============================================================================
begin;
select tests.claims('aaaaaaaa-0000-4000-8000-00000000000a');
set local role authenticated;
select tests.throws(
  format($q$select public.request_room_generation('%s', gen_random_uuid())$q$, (select v from ctx where k = 'room_a')),
  'generation requires an active entitlement', 'subscription');
select tests.ok((public.get_my_access() ->> 'can_generate')::boolean = false, 'get_my_access: cannot generate without entitlement');
rollback;

begin;
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.billing_apply_revenuecat_event(jsonb_build_object('event', jsonb_build_object(
    'id', 'evt_1', 'type', 'INITIAL_PURCHASE', 'app_user_id', '$RCAnonymousID:123',
    'aliases', jsonb_build_array('$RCAnonymousID:123', 'aaaaaaaa-0000-4000-8000-00000000000a'),
    'original_app_user_id', '$RCAnonymousID:123',
    'entitlement_ids', jsonb_build_array('pro'), 'product_id', 'escapd_monthly',
    'store', 'APP_STORE', 'environment', 'SANDBOX', 'period_type', 'TRIAL',
    'event_timestamp_ms', (extract(epoch from now()) * 1000)::bigint,
    'expiration_at_ms', (extract(epoch from now() + interval '7 days') * 1000)::bigint)));
  perform tests.ok(r ->> 'outcome' = 'applied:active', 'INITIAL_PURCHASE activates entitlement (resolved via alias)');

  r := public.billing_apply_revenuecat_event(jsonb_build_object('event', jsonb_build_object(
    'id', 'evt_1', 'type', 'INITIAL_PURCHASE', 'app_user_id', 'aaaaaaaa-0000-4000-8000-00000000000a',
    'entitlement_ids', jsonb_build_array('pro'))));
  perform tests.ok(r ->> 'outcome' = 'duplicate', 'replayed event id is ignored (idempotent)');

  r := public.billing_apply_revenuecat_event(jsonb_build_object('event', jsonb_build_object(
    'id', 'evt_old', 'type', 'EXPIRATION', 'app_user_id', 'aaaaaaaa-0000-4000-8000-00000000000a',
    'entitlement_ids', jsonb_build_array('pro'),
    'event_timestamp_ms', (extract(epoch from now() - interval '1 day') * 1000)::bigint)));
  perform tests.ok(r ->> 'outcome' = 'stale', 'out-of-order (older) event does not revoke access');

  r := public.billing_apply_revenuecat_event(jsonb_build_object('event', jsonb_build_object(
    'id', 'evt_other', 'type', 'INITIAL_PURCHASE', 'app_user_id', 'aaaaaaaa-0000-4000-8000-00000000000a',
    'entitlement_ids', jsonb_build_array('some_other_entitlement'))));
  perform tests.ok(r ->> 'outcome' = 'ignored_entitlement', 'events for other entitlements are ignored');

  r := public.billing_apply_revenuecat_event(jsonb_build_object('event', jsonb_build_object(
    'id', 'evt_ghost', 'type', 'INITIAL_PURCHASE', 'app_user_id', '00000000-0000-4000-8000-0000000000ff',
    'entitlement_ids', jsonb_build_array('pro'))));
  perform tests.ok(r ->> 'outcome' = 'unknown_user', 'events for unknown users are recorded but grant nothing');

  perform tests.ok(private.has_active_entitlement('aaaaaaaa-0000-4000-8000-00000000000a'), 'user A is entitled');
  perform tests.ok(not private.has_active_entitlement('bbbbbbbb-0000-4000-8000-00000000000b'), 'user B is not entitled');
end $$;
commit;

-- =============================================================================
-- 6. Generation pipeline
-- =============================================================================
begin;
select tests.claims('aaaaaaaa-0000-4000-8000-00000000000a');
set local role authenticated;
do $$
declare
  v_room uuid := (select v from ctx where k = 'room_a')::uuid;
  v_key  uuid := 'd0d0d0d0-0000-4000-8000-000000000001';
  j1 public.generation_jobs;
  j2 public.generation_jobs;
begin
  perform tests.ok((public.get_my_access() ->> 'can_generate')::boolean, 'get_my_access: entitled user can generate');
  perform tests.throws(format($q$select public.request_room_generation('%s', '%s')$q$, v_room, v_key),
    'generation requires the minimum photo count', 'photos');

  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('room-photos', auth.uid() || '/' || v_room || '/p2.jpg', auth.uid(), '{"mimetype":"image/jpeg"}');
  perform public.register_room_photo(v_room, auth.uid() || '/' || v_room || '/p2.jpg', 2::smallint);

  j1 := public.request_room_generation(v_room, v_key);
  perform tests.ok(j1.status = 'queued', 'generation job queued');
  perform tests.ok((select status from public.rooms where id = v_room) = 'queued', 'room moves to queued');

  j2 := public.request_room_generation(v_room, v_key);
  perform tests.ok(j2.id = j1.id, 'same idempotency key returns the same job');
  j2 := public.request_room_generation(v_room, gen_random_uuid());
  perform tests.ok(j2.id = j1.id, 'a second request while one is active returns the active job');

  perform tests.throws(format($q$select public.register_room_photo('%s', 'x', 3::smallint)$q$, v_room),
    'photos are locked once generation is queued', 'draft');
  insert into ctx values ('job_a', j1.id::text);
end $$;
commit;

-- Worker: claim, invalid output -> retry, valid output -> publish
begin;
set local role service_role;
do $$
declare
  v_job   public.generation_jobs;
  v_res   jsonb;
  v_room  uuid := (select v from ctx where k = 'room_a')::uuid;
  v_photos jsonb;
  v_pub   jsonb;
  v_sec   jsonb;
begin
  v_job := public.worker_claim_generation_job('test-worker', 120);
  perform tests.ok(v_job.id = (select v from ctx where k = 'job_a')::uuid and v_job.status = 'running' and v_job.attempt_count = 1,
    'worker claims the queued job');
  perform tests.ok((select status from public.rooms where id = v_room) = 'generating', 'room moves to generating');
  perform tests.ok(public.worker_claim_generation_job('second-worker') is null, 'a leased job is not claimed twice');
  perform tests.ok((select count(*) from public.worker_get_job_photos(v_job.id, v_job.lease_token)) = 3, 'worker can list job photos');

  v_res := public.worker_complete_generation_job(v_job.id, v_job.lease_token,
    '{"schema_version":1,"photos":[],"hotspots":[],"puzzles":[]}'::jsonb,
    '{"schema_version":1,"puzzles":{}}'::jsonb,
    '{"model":"test-model","input_tokens":100,"output_tokens":50,"cost_usd":0.01}'::jsonb);
  perform tests.ok((v_res ->> 'ok')::boolean = false, 'invalid AI output is rejected');
  select * into v_job from public.generation_jobs where id = v_job.id;
  perform tests.ok(v_job.status = 'queued' and v_job.error_code = 'invalid_output', 'invalid output re-queues the job for retry');
  perform tests.ok((select count(*) from private.generation_usage where job_id = v_job.id) = 1, 'AI usage/cost recorded for the failed attempt');

  -- make it claimable now
  update public.generation_jobs set next_attempt_at = now() where id = v_job.id;
  v_job := public.worker_claim_generation_job('test-worker', 120);
  perform tests.ok(v_job.attempt_count = 2, 'job reclaimed for attempt 2');

  perform tests.throws(format($q$select public.worker_fail_generation_job('%s', gen_random_uuid(), 'x', 'x')$q$, v_job.id),
    'stale lease token cannot complete/fail a job', 'lease');

  select jsonb_agg(jsonb_build_object('photo_id', id) order by position) into v_photos
  from public.room_photos where room_id = v_room;

  -- The code must be written where the player can read it before solving
  -- (clue coverage): the card from the box carries it, in a different spelling
  -- than the secret answer so the leak check below stays meaningful.
  v_pub := jsonb_build_object(
    'schema_version', 1, 'title', 'Bedroom Mystery', 'photos', v_photos,
    'items', '[{"id":"key","name":"Key"},{"id":"card","name":"Card","description":"Pencilled on the back: 12 34."}]'::jsonb,
    'hotspots', '[{"id":"lamp","photo_index":0,"object_label":"lamp","shape":{"type":"rect","x":0.1,"y":0.1,"w":0.2,"h":0.2}},
                  {"id":"box","photo_index":1,"object_label":"box","shape":{"type":"rect","x":0.5,"y":0.5,"w":0.2,"h":0.2}}]'::jsonb,
    'puzzles', '[{"id":"get_key","kind":"inspect","hotspot_id":"lamp"},
                 {"id":"open_box","kind":"use_item","hotspot_id":"box","requires":["get_key"]},
                 {"id":"code","kind":"code","hotspot_id":"box","requires":["open_box"]}]'::jsonb,
    'exit', '{"requires":["code"],"message":"Out!"}'::jsonb);
  v_sec := '{"schema_version":1,"puzzles":{
              "get_key":{"rewards":{"items":["key"]}},
              "open_box":{"item_id":"key","rewards":{"consume_items":["key"],"items":["card"]}},
              "code":{"answer":"12-34"}}}'::jsonb;

  v_res := public.worker_complete_generation_job(v_job.id, v_job.lease_token, v_pub, v_sec,
    '{"model":"test-model","input_tokens":200,"output_tokens":80,"cost_usd":0.02}'::jsonb);
  perform tests.ok((v_res ->> 'ok')::boolean, 'valid AI output is published');
  perform tests.ok((select status from public.rooms where id = v_room) = 'ready', 'room becomes ready');
  perform tests.ok((select title from public.rooms where id = v_room) = 'My bedroom', 'user-chosen title is kept');
  perform tests.ok((select status from public.generation_jobs where id = v_job.id) = 'succeeded', 'job succeeded');
  perform tests.ok((select sum(cost_usd) from private.generation_usage where job_id = v_job.id) = 0.03, 'total AI cost tracked across attempts');
end $$;
commit;

-- Owner sees the published version but not the secret; other users see nothing
begin;
select tests.claims('aaaaaaaa-0000-4000-8000-00000000000a');
set local role authenticated;
do $$
begin
  perform tests.ok((select count(*) from public.puzzle_versions where owner_id = auth.uid()) = 1, 'owner can read the published version');
  perform tests.ok(not exists (select 1 from public.puzzle_versions where public_definition::text ilike '%12-34%'),
    'answers never appear in readable puzzle data');
end $$;
rollback;

begin;
select tests.claims('bbbbbbbb-0000-4000-8000-00000000000b');
set local role authenticated;
select tests.ok((select count(*) from public.puzzle_versions where owner_id is not null) = 0, 'user B cannot read user A puzzle versions');
select tests.ok((select count(*) from public.generation_jobs) = 0, 'user B cannot read user A generation jobs');
select tests.throws(format($q$select public.start_or_resume_session('%s')$q$, (select v from ctx where k = 'room_a')),
  'user B cannot start a session in user A room', 'not found');
rollback;

-- Generation cap
begin;
update private.app_config set value = '1' where key = 'generation_cap_per_window';
select tests.claims('aaaaaaaa-0000-4000-8000-00000000000a');
set local role authenticated;
select tests.throws(format($q$select public.request_room_generation('%s', gen_random_uuid())$q$, (select v from ctx where k = 'room_a')),
  'generation cap is enforced server-side', 'limit');
rollback;

-- =============================================================================
-- 7. Gameplay engine
-- =============================================================================
begin;
select tests.claims('aaaaaaaa-0000-4000-8000-00000000000a');
set local role authenticated;
do $$
declare
  v_room uuid := (select v from ctx where k = 'room_a')::uuid;
  s  public.game_sessions;
  s2 public.game_sessions;
  r  jsonb;
begin
  s := public.start_or_resume_session(v_room);
  perform tests.ok(s.status = 'active', 'session started');
  s2 := public.start_or_resume_session(v_room);
  perform tests.ok(s2.id = s.id, 'resuming returns the same active session');

  perform tests.throws(format($q$update public.game_sessions set status = 'completed' where id = '%s'$q$, s.id),
    'client cannot write session state directly', 'permission denied');

  r := public.submit_action(s.id, jsonb_build_object('type', 'solve', 'puzzle_id', 'code', 'answer', '1234'));
  perform tests.ok(r ->> 'outcome' = 'invalid', 'locked puzzle cannot be solved early');
  r := public.submit_action(s.id, jsonb_build_object('type', 'use_item', 'item_id', 'key', 'hotspot_id', 'box'));
  perform tests.ok(r ->> 'outcome' = 'invalid', 'cannot use an item you do not have');
  r := public.submit_action(s.id, jsonb_build_object('type', 'inspect', 'hotspot_id', 'lamp'));
  perform tests.ok(r ->> 'outcome' = 'solved' and r -> 'gained_items' ? 'key', 'inspecting the lamp yields the key');
  r := public.submit_action(s.id, jsonb_build_object('type', 'inspect', 'hotspot_id', 'lamp'));
  perform tests.ok(r ->> 'outcome' = 'nothing', 'inspecting again does nothing');
  r := public.submit_action(s.id, jsonb_build_object('type', 'use_item', 'item_id', 'key', 'hotspot_id', 'box'));
  perform tests.ok(r ->> 'outcome' = 'solved' and r -> 'consumed_items' ? 'key', 'using the key opens the box and consumes it');
  r := public.submit_action(s.id, jsonb_build_object('type', 'solve', 'puzzle_id', 'code', 'answer', '9999'));
  perform tests.ok(r ->> 'outcome' = 'wrong', 'wrong code rejected');
  r := public.submit_action(s.id, jsonb_build_object('type', 'solve', 'puzzle_id', 'code', 'answer', ' 12 34 '));
  perform tests.ok(r ->> 'outcome' = 'solved' and (r ->> 'completed')::boolean, 'normalized correct code solves and completes the room');
  select * into s from public.game_sessions where id = s.id;
  perform tests.ok(s.status = 'completed' and s.completed_at is not null and s.wrong_answer_count = 1,
    'completion and counters are recorded server-side');
  perform tests.throws(format($q$select public.submit_action('%s', '{"type":"inspect","hotspot_id":"lamp"}')$q$, s.id),
    'completed sessions accept no more actions', 'not active');
  insert into ctx values ('session_a', s.id::text);
end $$;
commit;

begin;
select tests.claims('bbbbbbbb-0000-4000-8000-00000000000b');
set local role authenticated;
select tests.throws(format($q$select public.submit_action('%s', '{"type":"inspect","hotspot_id":"lamp"}')$q$, (select v from ctx where k = 'session_a')),
  'user B cannot act on user A session', 'not found');
select tests.ok((select count(*) from public.game_sessions) = 0, 'user B cannot read user A sessions');
rollback;

-- Guest plays the tutorial end to end
begin;
select tests.claims('cccccccc-0000-4000-8000-00000000000c', true);
set local role authenticated;
do $$
declare
  s public.game_sessions;
  r jsonb;
begin
  s := public.start_or_resume_session('00000000-0000-4000-8000-000000000001');
  perform tests.ok(not (s.state -> 'revealed_hotspots' ? 'safe'), 'hidden hotspot starts hidden');
  r := public.submit_action(s.id, '{"type":"inspect","hotspot_id":"safe"}');
  perform tests.ok(r ->> 'outcome' = 'invalid', 'hidden hotspot cannot be used');
  perform public.submit_action(s.id, '{"type":"inspect","hotspot_id":"desk_drawer"}');
  perform public.submit_action(s.id, '{"type":"inspect","hotspot_id":"bookshelf"}');
  perform public.submit_action(s.id, '{"type":"inspect","hotspot_id":"rug"}');
  r := public.submit_action(s.id, '{"type":"use_item","item_id":"brass_key","hotspot_id":"cabinet"}');
  perform tests.ok(r -> 'revealed_hotspots' ? 'safe', 'unlocking the cabinet reveals the safe');
  r := public.submit_action(s.id, '{"type":"combine","item_ids":["torn_note_right","torn_note_left"]}');
  perform tests.ok(r -> 'gained_items' ? 'full_note', 'combining notes (any order) produces the full note');
  perform public.submit_action(s.id, '{"type":"solve","puzzle_id":"open_safe","answer":"0427"}');
  r := public.submit_action(s.id, '{"type":"inspect","hotspot_id":"door"}');
  perform tests.ok((r ->> 'completed')::boolean, 'guest escapes the tutorial');
  perform tests.ok((select tutorial_completed_at is not null from public.profiles), 'tutorial completion recorded on profile');
end $$;
commit;

-- =============================================================================
-- 8. Expiration, guest merge, deletion and retention
-- =============================================================================
begin;
set local role service_role;
select tests.ok(public.billing_apply_revenuecat_event(jsonb_build_object('event', jsonb_build_object(
  'id', 'evt_exp', 'type', 'EXPIRATION', 'app_user_id', 'aaaaaaaa-0000-4000-8000-00000000000a',
  'entitlement_ids', jsonb_build_array('pro'),
  'event_timestamp_ms', (extract(epoch from now()) * 1000)::bigint))) ->> 'outcome' = 'applied:expired',
  'EXPIRATION revokes access');
select tests.ok(not private.has_active_entitlement('aaaaaaaa-0000-4000-8000-00000000000a'), 'user A no longer entitled');

select tests.ok((public.worker_merge_guest_into_user(
  'cccccccc-0000-4000-8000-00000000000c', 'bbbbbbbb-0000-4000-8000-00000000000b') ->> 'sessions_moved')::int = 1,
  'guest tutorial progress merges into an existing account');
select tests.ok((select tutorial_completed_at is not null from public.profiles where id = 'bbbbbbbb-0000-4000-8000-00000000000b'),
  'tutorial completion carried over by merge');
select tests.throws($q$select public.worker_merge_guest_into_user('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b')$q$,
  'only anonymous users can be merged away', 'anonymous');
commit;

-- Owner deletes their room: everything cascades and photos are queued for storage deletion
begin;
select tests.claims('aaaaaaaa-0000-4000-8000-00000000000a');
set local role authenticated;
delete from public.rooms where id = (select v from ctx where k = 'room_a')::uuid;
commit;
do $$
declare v_room uuid := (select v from ctx where k = 'room_a')::uuid;
begin
  perform tests.ok(not exists (select 1 from public.room_photos where room_id = v_room)
    and not exists (select 1 from public.puzzle_versions where room_id = v_room)
    and not exists (select 1 from public.game_sessions where room_id = v_room)
    and not exists (select 1 from public.generation_jobs where room_id = v_room),
    'deleting a room cascades photos, versions, sessions, jobs');
  perform tests.ok(not exists (select 1 from private.puzzle_solutions s
    left join public.puzzle_versions v on v.id = s.puzzle_version_id where v.id is null),
    'secret solutions are deleted with their version');
  perform tests.ok((select count(*) from private.storage_deletion_queue where object_path like '%' || v_room || '%' and processed_at is null) = 3,
    'all 3 photo files are queued for storage deletion');
end $$;

begin;
set local role service_role;
do $$
declare v_batch record; v_ids bigint[];
begin
  select array_agg(id) into v_ids from public.worker_next_storage_deletions(100);
  perform tests.ok(cardinality(v_ids) = 3, 'janitor receives the queued deletions');
  perform tests.ok(public.worker_ack_storage_deletions(v_ids) = 3, 'janitor acknowledges deletions');
  perform tests.ok((select count(*) from public.worker_next_storage_deletions(100)) = 0, 'acknowledged deletions are not re-sent');
end $$;
commit;

-- Retention: stale drafts and inactive guests are purged
insert into auth.users (id, is_anonymous, created_at) values ('dddddddd-0000-4000-8000-00000000000d', true, now() - interval '90 days');
insert into public.rooms (owner_id, title, last_activity_at) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'old draft', now() - interval '30 days');
begin;
set local role service_role;
do $$
declare r jsonb := public.worker_purge_expired_data();
begin
  perform tests.ok((r ->> 'rooms_deleted')::int = 1, 'stale draft rooms are purged');
  perform tests.ok((r ->> 'guests_deleted')::int = 1, 'inactive guest accounts are purged');
end $$;
commit;
select tests.ok(exists (select 1 from auth.users where id = 'cccccccc-0000-4000-8000-00000000000c'), 'recently active guests are kept');

-- Account deletion cascades everything
delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-00000000000a';
do $$
begin
  perform tests.ok(not exists (select 1 from public.profiles where id = 'aaaaaaaa-0000-4000-8000-00000000000a')
    and not exists (select 1 from public.user_settings where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a')
    and not exists (select 1 from public.entitlements where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a')
    and not exists (select 1 from public.rooms where owner_id = 'aaaaaaaa-0000-4000-8000-00000000000a'),
    'deleting the auth user removes all of their data');
  perform tests.ok(exists (select 1 from private.billing_events where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'),
    'billing audit trail is retained after account deletion');
end $$;

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
delete from auth.users where id in ('bbbbbbbb-0000-4000-8000-00000000000b', 'cccccccc-0000-4000-8000-00000000000c');
delete from private.billing_events where event_id in ('evt_1', 'evt_old', 'evt_other', 'evt_ghost', 'evt_exp');
delete from storage.objects where name like 'aaaaaaaa-0000-4000-8000-00000000000a/%';
delete from private.storage_deletion_queue where object_path like 'aaaaaaaa-0000-4000-8000-00000000000a/%';
drop schema tests cascade;
\o
\echo 'database tests: all assertions passed'
