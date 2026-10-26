-- =============================================================================
-- Escapd database tests, part 3: genres on rooms and generation jobs, the
-- create_room / request_room_generation signatures, the worker's genre check,
-- hotspot effects, and the accuse step (validator deducibility, submit_action,
-- the shared cooldown and how it outlives a session, state.contradicted,
-- use_hint).
-- Run via scripts/test-db.sh (after 02). Fails fast (ON_ERROR_STOP) on the
-- first broken assertion. Creates test users with fixed UUIDs; cleans them up
-- at the end.
-- =============================================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;
\o /dev/null

-- ---------------------------------------------------------------------------
-- Test helpers (same as 01; dropped at the end)
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
-- G = 11.. (full account, entitled), H = 22.. (guest), T = tutorial room/version (from seed)
insert into auth.users (id, email, is_anonymous) values
  ('11111111-0000-4000-8000-000000000011', 'g@test.dev', false),
  ('22222222-0000-4000-8000-000000000022', null, true);
insert into public.entitlements (user_id, provider, status)
values ('11111111-0000-4000-8000-000000000011', 'manual', 'active');

create temp table ctx (k text primary key, v text);
grant all on ctx to public;

-- A small crime scene: three inspects grant the evidence (ticket names the
-- culprit, letter the motive, teacup the method), the accusation needs all
-- three and is the exit. open_box (needs the key from find_key) sits before
-- the accusation in definition order and is not attemptable when it becomes
-- the next step, so use_hint must treat the accusation as attemptable on its
-- own (like combine) to target it. The ticket also clues the safe's code, so
-- codes and accusations can share one cooldown in the same session.
insert into ctx values ('cs_pub', $json$
{
  "schema_version": 1,
  "genre": "crime_scene",
  "title": "Supper at Marsh House",
  "intro": "The host never finished his tea. Work out who, why and how.",
  "photos": [ { "asset_key": "t/1.jpg" } ],
  "items": [
    { "id": "ticket", "name": "Train ticket", "description": "A ticket for the 08:15, never punched. Ivy Marsh swore she was on that train." },
    { "id": "letter", "name": "Letter",       "description": "A final demand for a debt, signed by the host." },
    { "id": "teacup", "name": "Teacup",       "description": "A bitter film at the bottom: poisoned tea." },
    { "id": "key",    "name": "Small key",    "description": "It fits something small." }
  ],
  "hotspots": [
    { "id": "desk",    "photo_index": 0, "object_label": "desk",    "shape": { "type": "rect", "x": 0.0, "y": 0.0, "w": 0.2, "h": 0.2 } },
    { "id": "cabinet", "photo_index": 0, "object_label": "cabinet", "shape": { "type": "rect", "x": 0.3, "y": 0.0, "w": 0.2, "h": 0.2 } },
    { "id": "dresser", "photo_index": 0, "object_label": "dresser", "shape": { "type": "rect", "x": 0.6, "y": 0.0, "w": 0.2, "h": 0.2 } },
    { "id": "box",     "photo_index": 0, "object_label": "box",     "shape": { "type": "rect", "x": 0.0, "y": 0.5, "w": 0.2, "h": 0.2 } },
    { "id": "rug",     "photo_index": 0, "object_label": "rug",     "shape": { "type": "rect", "x": 0.3, "y": 0.5, "w": 0.2, "h": 0.2 } },
    { "id": "safe",    "photo_index": 0, "object_label": "safe",    "shape": { "type": "rect", "x": 0.6, "y": 0.5, "w": 0.2, "h": 0.2 } }
  ],
  "puzzles": [
    { "id": "search_desk",   "kind": "inspect",  "hotspot_id": "desk" },
    { "id": "open_cabinet",  "kind": "inspect",  "hotspot_id": "cabinet" },
    { "id": "check_dresser", "kind": "inspect",  "hotspot_id": "dresser" },
    { "id": "open_box",      "kind": "use_item", "hotspot_id": "box" },
    { "id": "name_the_killer", "kind": "accuse", "requires": ["search_desk", "open_cabinet", "check_dresser"],
      "title": "Name the killer", "prompt": "Who did it, why, and how?",
      "suspects": [
        { "id": "s_ivy",   "name": "Ivy Marsh",  "role": "The housekeeper", "alibi": "On the 08:15 to town all evening." },
        { "id": "s_tom",   "name": "Tom Reed",   "role": "The gardener",    "alibi": "Pruning roses until dark." },
        { "id": "s_clara", "name": "Clara Voss", "role": "The niece",       "alibi": "Asleep upstairs by nine." } ],
      "motives": [
        { "id": "m_debt",     "name": "Debt" },
        { "id": "m_jealousy", "name": "Jealousy" },
        { "id": "m_revenge",  "name": "Revenge" } ],
      "methods": [
        { "id": "x_tea",    "name": "Poisoned tea" },
        { "id": "x_brandy", "name": "Spiked brandy" },
        { "id": "x_pills",  "name": "Sleeping pills" } ] },
    { "id": "find_key",  "kind": "inspect", "hotspot_id": "rug" },
    { "id": "open_safe", "kind": "code",    "hotspot_id": "safe" }
  ],
  "exit": { "requires": ["name_the_killer"], "message": "Ivy Marsh is led away." }
}
$json$), ('cs_sec', $json$
{
  "schema_version": 1,
  "puzzles": {
    "search_desk":   { "rewards": { "items": ["ticket"] }, "message": "Under the blotter: a train ticket." },
    "open_cabinet":  { "rewards": { "items": ["letter"] }, "message": "A letter, folded small." },
    "check_dresser": { "rewards": { "items": ["teacup"] }, "message": "A teacup, pushed to the back." },
    "open_box":      { "item_id": "key", "rewards": { "consume_items": ["key"] }, "message": "The box is empty." },
    "name_the_killer": {
      "answer":   { "suspect": "s_ivy",  "motive": "m_debt", "method": "x_tea" },
      "evidence": { "suspect": "ticket", "motive": "letter", "method": "teacup" },
      "rewards": { "items": [], "consume_items": [], "reveal_hotspots": [] },
      "message": "She never caught the 08:15.",
      "hints": [ "Three things you found tell one story.",
                 "The ticket breaks an alibi; the letter and the cup say why and how.",
                 "Ivy Marsh, for a debt, with poisoned tea." ] },
    "find_key":      { "rewards": { "items": ["key"] }, "message": "A small key under the rug." },
    "open_safe":     { "answer": "0815", "message": "The safe is empty." }
  }
}
$json$);

-- =============================================================================
-- 1. Genre columns and RPC signatures
-- =============================================================================
do $$
begin
  perform tests.ok((select genre from public.rooms where id = '00000000-0000-4000-8000-000000000001') = 'noir',
    'the tutorial room is noir');
  perform tests.throws($q$insert into public.rooms (owner_id, title, genre) values ('11111111-0000-4000-8000-000000000011', 'x', 'horror')$q$,
    'rooms.genre only takes the three genres', '23514');
  perform tests.throws($q$insert into public.generation_jobs (room_id, owner_id, idempotency_key, genre)
                          values ('00000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000011', gen_random_uuid(), 'horror')$q$,
    'generation_jobs.genre only takes the three genres', '23514');

  perform tests.ok((select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'create_room') = 1
      and (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'request_room_generation') = 1,
    'create_room and request_room_generation each have exactly one signature (no ambiguous overloads)');
  perform tests.ok(has_function_privilege('authenticated', 'public.create_room(text, text)', 'execute')
      and not has_function_privilege('anon', 'public.create_room(text, text)', 'execute')
      and has_function_privilege('authenticated', 'public.request_room_generation(uuid, uuid, text)', 'execute')
      and not has_function_privilege('anon', 'public.request_room_generation(uuid, uuid, text)', 'execute'),
    'the re-created RPCs are granted to authenticated only');
end $$;

begin;
do $$
declare v_genre text;
begin
  insert into public.rooms (owner_id, title) values ('11111111-0000-4000-8000-000000000011', 'Defaults')
  returning genre into v_genre;
  perform tests.ok(v_genre = 'noir', 'rooms.genre defaults to noir');
  insert into public.generation_jobs (room_id, owner_id, idempotency_key)
  values ('00000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000011', gen_random_uuid())
  returning genre into v_genre;
  perform tests.ok(v_genre = 'noir', 'generation_jobs.genre defaults to noir');
end $$;
rollback;

-- =============================================================================
-- 2. create_room
-- =============================================================================
begin;
select tests.claims('11111111-0000-4000-8000-000000000011');
set local role authenticated;
do $$
declare r public.rooms;
begin
  r := public.create_room('Old call');
  perform tests.ok(r.genre = 'noir' and r.title = 'Old call' and r.status = 'draft',
    'create_room with the old argument list makes a noir draft');
  insert into ctx values ('room_noir', r.id::text);
  r := public.create_room(p_title => 'Named call');
  perform tests.ok(r.genre = 'noir', 'create_room called by name with only p_title still resolves');
  r := public.create_room('Dinner party', 'crime_scene');
  perform tests.ok(r.genre = 'crime_scene' and r.title = 'Dinner party', 'create_room takes a genre');
  r := public.create_room(p_genre => 'paranormal');
  perform tests.ok(r.genre = 'paranormal' and r.title = 'Untitled room', 'create_room with only a genre keeps the default title');
  insert into ctx values ('room_case', r.id::text);
  perform tests.ok((public.create_room('Null genre', null)).genre = 'noir', 'a null genre means noir');
  perform tests.throws($q$select public.create_room('Bad', 'horror')$q$, 'create_room rejects an unknown genre', '22023');

  perform tests.throws(format($q$update public.rooms set genre = 'noir' where id = '%s'$q$, r.id),
    'the client cannot change a room''s genre', 'permission denied');
  update public.rooms set title = 'Still renamable' where id = r.id;
  perform tests.ok((select title = 'Still renamable' and genre = 'paranormal' from public.rooms where id = r.id),
    'the owner can still rename the room and reads its genre');
end $$;
commit;

begin;
select tests.claims('22222222-0000-4000-8000-000000000022', true);
set local role authenticated;
select tests.throws($q$select public.create_room('guest case', 'crime_scene')$q$, 'a guest still cannot create rooms', 'full account');
rollback;

-- Three photos per room (inserted directly; registration is covered by 01).
insert into public.room_photos (room_id, owner_id, storage_path, position, mime_type)
select r.id, r.owner_id, r.owner_id || '/' || r.id || '/p' || n || '.jpg', n, 'image/jpeg'
from public.rooms r cross join generate_series(0, 2) n
where r.id in ((select v from ctx where k = 'room_noir')::uuid, (select v from ctx where k = 'room_case')::uuid);

-- =============================================================================
-- 3. request_room_generation with a genre
-- =============================================================================
begin;
select tests.claims('11111111-0000-4000-8000-000000000011');
set local role authenticated;
do $$
declare
  v_noir uuid := (select v from ctx where k = 'room_noir')::uuid;
  v_case uuid := (select v from ctx where k = 'room_case')::uuid;
  v_key  uuid := '0d0d0d0d-0000-4000-8000-000000000031';
  j      public.generation_jobs;
begin
  j := public.request_room_generation(v_noir, v_key);
  perform tests.ok(j.status = 'queued' and j.genre = 'noir',
    'request_room_generation with the old argument list queues a job of the room''s genre');
  perform tests.ok((public.request_room_generation(p_room_id => v_noir, p_idempotency_key => v_key)).id = j.id
      and (public.request_room_generation(v_noir, v_key, 'noir')).id = j.id,
    'replaying a key without a genre or with the same genre returns the same job');
  perform tests.throws(format($q$select public.request_room_generation('%s', '%s', 'paranormal')$q$, v_noir, v_key),
    'replaying a key with another genre raises', '22023');
  perform tests.throws(format($q$select public.request_room_generation('%s', gen_random_uuid(), 'paranormal')$q$, v_noir),
    'an active job of another genre is not returned as the one asked for', '22023');
  perform tests.ok((public.request_room_generation(v_noir, gen_random_uuid())).id = j.id,
    'a request without a genre still returns the active job');
  perform tests.throws(format($q$select public.request_room_generation('%s', gen_random_uuid(), 'horror')$q$, v_case),
    'an unknown genre is rejected', '22023');
  perform tests.ok((select genre from public.generation_jobs where id = j.id) = 'noir',
    'the owner reads the job''s genre');

  -- Clear the way for the worker: only the case room's job will be queued.
  perform public.cancel_room_generation(j.id);

  j := public.request_room_generation(v_case, '0d0d0d0d-0000-4000-8000-000000000032', 'crime_scene');
  perform tests.ok(j.genre = 'crime_scene' and (select genre from public.rooms where id = v_case) = 'crime_scene',
    'a draft room takes the requested genre, and the job copies it');
  insert into ctx values ('job_case', j.id::text);
end $$;
commit;

-- Worker: the claimed job carries the genre; output of another genre is invalid.
begin;
set local role service_role;
do $$
declare
  v_case  uuid := (select v from ctx where k = 'room_case')::uuid;
  v_job   public.generation_jobs;
  v_res   jsonb;
  v_pub   jsonb;
  v_sec   jsonb := (select v from ctx where k = 'cs_sec')::jsonb;
begin
  select jsonb_set((select v from ctx where k = 'cs_pub')::jsonb, '{photos}',
                   jsonb_agg(jsonb_build_object('photo_id', id) order by position))
    into v_pub
  from public.room_photos where room_id = v_case;

  v_job := public.worker_claim_generation_job('test-worker', 120);
  perform tests.ok(v_job.id = (select v from ctx where k = 'job_case')::uuid and v_job.genre = 'crime_scene',
    'the claimed job carries the genre snapshot');

  v_res := public.worker_complete_generation_job(v_job.id, v_job.lease_token, v_pub - 'genre', v_sec);
  perform tests.ok(not (v_res ->> 'ok')::boolean
      and v_res -> 'errors' ? 'public.genre must be the job''s genre (crime_scene)',
    'a definition without a genre (noir) fails a crime scene job');
  select * into v_job from public.generation_jobs where id = v_job.id;
  perform tests.ok(v_job.status = 'queued' and v_job.error_code = 'invalid_output',
    'a genre mismatch re-queues the job like any invalid output');

  update public.generation_jobs set next_attempt_at = now() where id = v_job.id;
  v_job := public.worker_claim_generation_job('test-worker', 120);
  v_res := public.worker_complete_generation_job(v_job.id, v_job.lease_token, jsonb_set(v_pub, '{genre}', '"paranormal"'), v_sec);
  perform tests.ok(v_res -> 'errors' ? 'public.genre must be the job''s genre (crime_scene)',
    'a definition of another named genre fails too');

  update public.generation_jobs set next_attempt_at = now() where id = v_job.id;
  v_job := public.worker_claim_generation_job('test-worker', 120);
  v_res := public.worker_complete_generation_job(v_job.id, v_job.lease_token, v_pub, v_sec);
  perform tests.ok((v_res ->> 'ok')::boolean, 'a crime scene definition with an accusation publishes');
  perform tests.ok((select r.status = 'ready' and r.genre = 'crime_scene' and pv.public_definition ->> 'genre' = 'crime_scene'
                    from public.rooms r join public.puzzle_versions pv on pv.id = r.current_version_id
                    where r.id = v_case),
    'the room is ready and its published definition carries the genre');
end $$;
commit;

-- A built case keeps its genre; draft and failed rooms can change theirs.
begin;
select tests.claims('11111111-0000-4000-8000-000000000011');
set local role authenticated;
do $$
declare
  v_noir uuid := (select v from ctx where k = 'room_noir')::uuid;
  v_case uuid := (select v from ctx where k = 'room_case')::uuid;
  j      public.generation_jobs;
begin
  perform tests.throws(format($q$select public.request_room_generation('%s', gen_random_uuid(), 'noir')$q$, v_case),
    'a genre change on a ready room raises', '22023');
  perform tests.ok((select genre from public.rooms where id = v_case) = 'crime_scene', 'the ready room keeps its genre');
  j := public.request_room_generation(v_case, gen_random_uuid(), 'crime_scene');
  perform tests.ok(j.genre = 'crime_scene', 'a ready room can be rebuilt in its own genre');
  perform public.cancel_room_generation(j.id);
  j := public.request_room_generation(v_case, gen_random_uuid());
  perform tests.ok(j.genre = 'crime_scene', 'a rebuild without a genre keeps the room''s');
  perform public.cancel_room_generation(j.id);

  perform tests.ok((select status from public.rooms where id = v_noir) = 'draft', 'the cancelled noir room is a draft again');
  j := public.request_room_generation(v_noir, gen_random_uuid(), 'paranormal');
  perform tests.ok(j.genre = 'paranormal' and (select genre from public.rooms where id = v_noir) = 'paranormal',
    'a draft room can change genre on a later request');
  perform public.cancel_room_generation(j.id);
end $$;
commit;

update public.rooms set status = 'failed' where id = (select v from ctx where k = 'room_noir')::uuid;
begin;
select tests.claims('11111111-0000-4000-8000-000000000011');
set local role authenticated;
do $$
declare
  v_noir uuid := (select v from ctx where k = 'room_noir')::uuid;
  j      public.generation_jobs;
begin
  j := public.request_room_generation(v_noir, gen_random_uuid(), 'crime_scene');
  perform tests.ok(j.genre = 'crime_scene' and (select genre from public.rooms where id = v_noir) = 'crime_scene',
    'a failed room can change genre');
  perform public.cancel_room_generation(j.id);
end $$;
commit;

-- =============================================================================
-- 4. Validator: genre, effects, accusations
-- =============================================================================
do $$
declare
  v_pub  jsonb := (select v from ctx where k = 'cs_pub')::jsonb;
  v_sec  jsonb := (select v from ctx where k = 'cs_sec')::jsonb;
  v_errs text[];
  v_cant constant text := 'accusation name_the_killer cannot be worked out from the clues';
  v_genre_err constant text := 'public.genre must be one of noir, crime_scene, paranormal';
begin
  perform tests.ok(cardinality(private.validate_puzzle_definition(v_pub, v_sec)) = 0,
    'a crime scene with a deducible accusation as its exit is valid (no hotspot needed)');
  perform tests.ok(cardinality(private.validate_puzzle_definition(v_pub - 'genre', v_sec)) = 0,
    'genre is optional');

  -- Genre
  perform tests.ok(v_genre_err = any(private.validate_puzzle_definition(jsonb_set(v_pub, '{genre}', '"horror"'), v_sec)),
    'an unknown genre is rejected');
  perform tests.ok(v_genre_err = any(private.validate_puzzle_definition(jsonb_set(v_pub, '{genre}', '1'), v_sec))
      and v_genre_err = any(private.validate_puzzle_definition(jsonb_set(v_pub, '{genre}', 'null'), v_sec)),
    'a genre that is not one of the three strings is rejected');

  -- Effects
  perform tests.ok(cardinality(private.validate_puzzle_definition(
      jsonb_set(jsonb_set(v_pub, '{hotspots,0,effect}', '"flicker"'), '{hotspots,1,effect}', '"whisper"'), v_sec)) = 0,
    'known hotspot effects are accepted');
  perform tests.ok('hotspot desk has an unknown effect' = any(private.validate_puzzle_definition(
      jsonb_set(v_pub, '{hotspots,0,effect}', '"glow"'), v_sec)),
    'an unknown hotspot effect is rejected');
  perform tests.ok('hotspot desk has an unknown effect' = any(private.validate_puzzle_definition(
      jsonb_set(v_pub, '{hotspots,0,effect}', '["flicker"]'), v_sec)),
    'an effect must be a single string');

  -- Deducibility
  v_errs := private.validate_puzzle_definition(
    jsonb_set(v_pub, '{items,0,description}', '"A ticket for the 08:15. Ivy Marsh and Tom Reed both swore they were on it."'), v_sec);
  perform tests.ok(v_cant = any(v_errs) and not ('puzzle name_the_killer can never be solved' = any(v_errs)),
    'evidence naming two suspects cannot prove the accusation');
  perform tests.ok('exit puzzle name_the_killer is not reachable (cycle, missing item, or hidden hotspot never revealed)' = any(v_errs),
    'an undeducible exit accusation leaves the exit unreachable');
  perform tests.ok(v_cant = any(private.validate_puzzle_definition(
      jsonb_set(v_pub, '{items,1,description}', '"A letter about the weather."'), v_sec)),
    'evidence that does not name the correct motive cannot prove the accusation');
  perform tests.ok(v_cant = any(private.validate_puzzle_definition(
      jsonb_set(v_pub, '{items,2,description}', '"Poisoned tea or spiked brandy, hard to say."'), v_sec)),
    'evidence that also names a wrong method cannot prove the accusation');
  perform tests.ok(v_cant = any(private.validate_puzzle_definition(v_pub,
      jsonb_set(v_sec, '{puzzles,name_the_killer,answer,suspect}', '"s_tom"'))),
    'an answer the evidence contradicts cannot be worked out');
  perform tests.ok(v_cant = any(private.validate_puzzle_definition(v_pub,
      jsonb_set(v_sec, '{puzzles,check_dresser,rewards,items}', '[]'))),
    'evidence the player never receives cannot prove the accusation');
  perform tests.ok(v_cant = any(private.validate_puzzle_definition(v_pub,
      jsonb_set(v_sec, '{puzzles,check_dresser,rewards,consume_items}', '["letter"]'))),
    'evidence that is consumed before the accusation cannot prove it');
  perform tests.ok(cardinality(private.validate_puzzle_definition(
      jsonb_set(v_pub, '{items,0,description}', '"Never punched: IVY-MARSH was not on the 08:15."'), v_sec)) = 0,
    'evidence names are matched after normalization');

  -- Structure
  perform tests.ok('accuse puzzle name_the_killer needs exactly 3 suspects' = any(private.validate_puzzle_definition(
      v_pub #- '{puzzles,4,suspects,2}', v_sec)),
    'an accusation needs exactly three suspects');
  perform tests.ok('accuse puzzle name_the_killer needs exactly 3 methods' = any(private.validate_puzzle_definition(
      v_pub #- '{puzzles,4,methods}', v_sec)),
    'an accusation needs a methods list');
  perform tests.ok('duplicate option id: ticket' = any(private.validate_puzzle_definition(
      jsonb_set(v_pub, '{puzzles,4,methods,2,id}', '"ticket"'), v_sec)),
    'an option id may not repeat an item id');
  perform tests.ok('duplicate option id: s_ivy' = any(private.validate_puzzle_definition(
      jsonb_set(v_pub, '{puzzles,4,motives,2,id}', '"s_ivy"'), v_sec)),
    'option ids are unique across dimensions');
  perform tests.ok('accuse puzzle name_the_killer has an invalid option id: Bad Id' = any(private.validate_puzzle_definition(
      jsonb_set(v_pub, '{puzzles,4,motives,0,id}', '"Bad Id"'), v_sec)),
    'option ids follow the id rule');
  perform tests.ok('accuse puzzle name_the_killer: suspect names must be distinct and none may contain another' = any(
      private.validate_puzzle_definition(jsonb_set(v_pub, '{puzzles,4,suspects,1,name}', '"Ivy"'), v_sec)),
    'a suspect name inside another is rejected');
  perform tests.ok('accuse puzzle name_the_killer: motive names must be distinct and none may contain another' = any(
      private.validate_puzzle_definition(jsonb_set(v_pub, '{puzzles,4,motives,1,name}', '"de-bt"'), v_sec)),
    'motive names that normalize the same are rejected');
  perform tests.ok('accuse puzzle name_the_killer: method m_x needs a name of 1-60 characters' = any(
      private.validate_puzzle_definition(jsonb_set(v_pub, '{puzzles,4,methods,1}', jsonb_build_object('id', 'm_x', 'name', repeat('x', 61))), v_sec)),
    'an option name over 60 characters is rejected');
  perform tests.ok('accuse puzzle name_the_killer: suspect s_tom needs an alibi of 1-200 characters' = any(
      private.validate_puzzle_definition(v_pub #- '{puzzles,4,suspects,1,alibi}', v_sec)),
    'a suspect needs an alibi');
  perform tests.ok('accuse puzzle name_the_killer: suspect s_tom needs a role of 1-60 characters' = any(
      private.validate_puzzle_definition(jsonb_set(v_pub, '{puzzles,4,suspects,1,role}', '"  "'), v_sec)),
    'a suspect needs a role');
  perform tests.ok('accuse puzzle name_the_killer: answer.motive must be one of its motives' = any(
      private.validate_puzzle_definition(v_pub, jsonb_set(v_sec, '{puzzles,name_the_killer,answer,motive}', '"m_greed"'))),
    'the answer must name existing options');
  perform tests.ok('accuse puzzle name_the_killer: evidence.method references unknown item' = any(
      private.validate_puzzle_definition(v_pub, v_sec #- '{puzzles,name_the_killer,evidence,method}')),
    'every dimension needs an evidence item');
  perform tests.ok('public definition contains solution-only keys (answer/rewards/inputs/solution/hints)' = any(
      private.validate_puzzle_definition(jsonb_set(v_pub, '{puzzles,4,evidence}', '{"suspect": "ticket"}'), v_sec)),
    'evidence in the public definition is rejected as a secret leak');
  perform tests.ok('puzzle name_the_killer has invalid kind' = any(
      private.validate_puzzle_definition(jsonb_set(v_pub, '{puzzles,4,kind}', '"banish"'), v_sec)),
    'unknown kinds are still rejected');
end $$;

-- =============================================================================
-- 5. Playing the accusation: state.contradicted, use_hint, right and wrong
-- =============================================================================
begin;
select tests.claims('11111111-0000-4000-8000-000000000011');
set local role authenticated;
do $$
declare
  s       public.game_sessions;
  r       jsonb;
  v_ok    boolean := true;
  v_count integer;
begin
  s := public.start_or_resume_session((select v from ctx where k = 'room_case')::uuid);

  r := public.submit_action(s.id, '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_ivy","motive_id":"m_debt","method_id":"x_tea"}');
  perform tests.ok(r = '{"outcome":"invalid","message":"That puzzle is not available."}'::jsonb,
    'an accusation is not available before its requires (even the right one)');

  r := public.submit_action(s.id, '{"type":"inspect","hotspot_id":"cabinet"}');
  perform tests.ok(r ->> 'outcome' = 'solved' and r -> 'state' -> 'contradicted' = '[]'::jsonb
      and r -> 'state' ?& array['solved', 'inventory', 'revealed_hotspots'],
    'every state write carries contradicted (empty before the suspect evidence) and keeps the three keys');
  r := public.submit_action(s.id, '{"type":"inspect","hotspot_id":"desk"}');
  perform tests.ok(r -> 'state' -> 'contradicted' = '["s_ivy"]'::jsonb,
    'gaining the suspect evidence marks the culprit''s alibi as contradicted');
  perform tests.ok((select state -> 'contradicted' from public.game_sessions where id = s.id) = '["s_ivy"]'::jsonb,
    'contradicted is stored on the session');
  r := public.submit_action(s.id, '{"type":"inspect","hotspot_id":"dresser"}');
  perform tests.ok(r -> 'state' -> 'contradicted' = '["s_ivy"]'::jsonb, 'contradicted persists across later writes');

  r := public.use_hint(s.id, 1);
  perform tests.ok(r ->> 'status' = 'ok' and r ->> 'puzzle_id' = 'name_the_killer'
      and r ->> 'hint' = 'Three things you found tell one story.',
    'use_hint targets an accusation once its requires are met (no hotspot needed)');

  select action_count into v_count from public.game_sessions where id = s.id;
  for r in select public.submit_action(s.id, a) from unnest(array[
      '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"m_debt","motive_id":"m_debt","method_id":"x_tea"}',
      '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_nobody","motive_id":"m_debt","method_id":"x_tea"}',
      '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_ivy","motive_id":"m_debt","method_id":"ticket"}',
      '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_ivy","motive_id":"m_debt"}']::jsonb[]) a loop
    v_ok := v_ok and r = '{"outcome":"invalid","message":"Pick one of each."}'::jsonb;
  end loop;
  perform tests.ok(v_ok, 'an id that is not one of the puzzle''s options in its dimension is invalid: "Pick one of each."');
  perform tests.ok((select action_count = v_count and wrong_answer_count = 0 and code_wrong_streak = 0
                    from public.game_sessions where id = s.id),
    'invalid accusations write nothing and do not count as wrong');
  perform tests.ok(public.submit_action(s.id, '{"type":"accuse","puzzle_id":"search_desk","suspect_id":"s_ivy","motive_id":"m_debt","method_id":"x_tea"}')
      ->> 'message' = 'That puzzle is not available.',
    'accusing on a puzzle that is not an accusation is not available');
  insert into ctx values ('session_case', s.id::text);
end $$;
commit;

-- Every wrong combination gets the same reply (the limit is raised so no lock starts).
begin;
update private.app_config set value = '100' where key = 'code_cooldown_wrong_answers';
select tests.claims('11111111-0000-4000-8000-000000000011');
set local role authenticated;
do $$
declare
  v_id      uuid := (select v from ctx where k = 'session_case')::uuid;
  v_state   jsonb := (select state from public.game_sessions where id = v_id);
  v_replies jsonb[] := '{}';
  v_s text; v_m text; v_x text;
begin
  for v_s, v_m, v_x in
    select a, b, c
    from unnest(array['s_ivy', 's_tom', 's_clara']) a,
         unnest(array['m_debt', 'm_jealousy', 'm_revenge']) b,
         unnest(array['x_tea', 'x_brandy', 'x_pills']) c
    where (a, b, c) <> ('s_ivy', 'm_debt', 'x_tea')
  loop
    v_replies := v_replies || public.submit_action(v_id, jsonb_build_object(
      'type', 'accuse', 'puzzle_id', 'name_the_killer', 'suspect_id', v_s, 'motive_id', v_m, 'method_id', v_x));
  end loop;
  perform tests.ok(cardinality(v_replies) = 26
      and (select count(distinct x) from unnest(v_replies) x) = 1
      and v_replies[1] = '{"outcome":"wrong","puzzle_id":"name_the_killer","message":"That doesn''t add up."}'::jsonb,
    'all 26 wrong accusations get one identical reply, whichever parts are wrong');
  perform tests.ok((select wrong_answer_count = 26 and code_wrong_streak = 26 and state = v_state
                    from public.game_sessions where id = v_id),
    'wrong accusations count like wrong codes and leave the state alone');
end $$;
rollback;

-- One cooldown for codes and accusations.
begin;
select tests.claims('11111111-0000-4000-8000-000000000011');
set local role authenticated;
do $$
declare
  v_id    uuid := (select v from ctx where k = 'session_case')::uuid;
  s       public.game_sessions;
  r       jsonb;
  v_quiet boolean := true;
  v_count integer;
begin
  for i in 1..4 loop
    r := public.submit_action(v_id, '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_tom","motive_id":"m_debt","method_id":"x_tea"}');
    v_quiet := v_quiet and r ->> 'outcome' = 'wrong' and not (r ? 'retry_after');
  end loop;
  for i in 1..3 loop
    r := public.submit_action(v_id, '{"type":"solve","puzzle_id":"open_safe","answer":"1111"}');
    v_quiet := v_quiet and r ->> 'outcome' = 'wrong' and not (r ? 'retry_after');
  end loop;
  perform tests.ok(v_quiet and (select code_wrong_streak from public.game_sessions where id = v_id) = 7,
    'wrong accusations and wrong codes add to one streak');

  r := public.submit_action(v_id, '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_clara","motive_id":"m_revenge","method_id":"x_pills"}');
  select * into s from public.game_sessions where id = v_id;
  perform tests.ok(r ->> 'outcome' = 'wrong' and r ->> 'message' = 'That doesn''t add up.'
      and (r ->> 'retry_after')::timestamptz = s.code_locked_until,
    'the eighth wrong answer, an accusation, starts the lock and announces retry_after');
  perform tests.ok(s.code_locked_until between now() + interval '9 minutes' and now() + interval '11 minutes'
      and s.code_wrong_streak = 0 and s.wrong_answer_count = 8,
    'the lock lasts ten minutes and resets the streak');
  v_count := s.action_count;

  r := public.submit_action(v_id, '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_ivy","motive_id":"m_debt","method_id":"x_tea"}');
  perform tests.ok(r ->> 'outcome' = 'invalid' and r ->> 'reason' = 'cooldown'
      and (r ->> 'retry_after')::timestamptz = s.code_locked_until and coalesce(r ->> 'message', '') <> '',
    'during the cooldown even the right accusation is refused with reason cooldown');
  r := public.submit_action(v_id, '{"type":"solve","puzzle_id":"open_safe","answer":"0815"}');
  perform tests.ok(r ->> 'outcome' = 'invalid' and r ->> 'reason' = 'cooldown',
    'a lock started by an accusation also stops codes');
  perform tests.ok((select wrong_answer_count = 8 and action_count = v_count and code_locked_until = s.code_locked_until
                    from public.game_sessions where id = v_id),
    'cooldown refusals write nothing');
  r := public.submit_action(v_id, '{"type":"inspect","hotspot_id":"rug"}');
  perform tests.ok(r ->> 'outcome' = 'solved' and r -> 'gained_items' ? 'key'
      and (select code_locked_until = s.code_locked_until from public.game_sessions where id = v_id),
    'other actions still work during the cooldown and do not extend it');
end $$;
commit;

-- The lock outlives the session: abandoning or deleting a locked session and
-- replaying to the accusation does not lift it.
begin;
select tests.claims('11111111-0000-4000-8000-000000000011');
set local role authenticated;
do $$
declare
  v_id   uuid := (select v from ctx where k = 'session_case')::uuid;
  v_room uuid := (select v from ctx where k = 'room_case')::uuid;
  v_lock timestamptz;
  s      public.game_sessions;
  r      jsonb;
begin
  select code_locked_until into v_lock from public.game_sessions where id = v_id;
  perform public.abandon_session(v_id);
  s := public.start_or_resume_session(v_room);
  perform tests.ok(s.id <> v_id and s.code_locked_until = v_lock and s.code_wrong_streak = 0,
    'a session started after abandoning a locked one inherits the lock');
  perform public.submit_action(s.id, jsonb_build_object('type', 'inspect', 'hotspot_id', h))
     from unnest(array['desk', 'cabinet', 'dresser']) h;
  r := public.submit_action(s.id, '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_ivy","motive_id":"m_debt","method_id":"x_tea"}');
  perform tests.ok(r ->> 'outcome' = 'invalid' and r ->> 'reason' = 'cooldown' and (r ->> 'retry_after')::timestamptz = v_lock,
    'abandoning a locked session and starting again does not lift the lock');

  delete from public.game_sessions where id = s.id;
  s := public.start_or_resume_session(v_room);
  perform public.submit_action(s.id, jsonb_build_object('type', 'inspect', 'hotspot_id', h))
     from unnest(array['desk', 'cabinet', 'dresser']) h;
  r := public.submit_action(s.id, '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_ivy","motive_id":"m_debt","method_id":"x_tea"}');
  perform tests.ok(r ->> 'outcome' = 'invalid' and r ->> 'reason' = 'cooldown' and (r ->> 'retry_after')::timestamptz = v_lock,
    'deleting a locked session (the DELETE grant) and starting again does not lift the lock either');
  perform tests.ok(not has_table_privilege('authenticated', 'private.code_cooldowns', 'select, insert, update, delete'),
    'players cannot read or change the per-room cooldown directly');
end $$;
rollback;

-- Simulate the ten minutes passing.
update public.game_sessions set code_locked_until = now() - interval '1 second'
 where id = (select v from ctx where k = 'session_case')::uuid;

-- The streak outlives the session too: a fresh session does not bring a fresh allowance.
begin;
select tests.claims('11111111-0000-4000-8000-000000000011');
set local role authenticated;
do $$
declare
  v_id    uuid := (select v from ctx where k = 'session_case')::uuid;
  s       public.game_sessions;
  r       jsonb;
  v_quiet boolean := true;
begin
  for i in 1..7 loop
    r := public.submit_action(v_id, '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_tom","motive_id":"m_debt","method_id":"x_tea"}');
    v_quiet := v_quiet and r ->> 'outcome' = 'wrong' and not (r ? 'retry_after');
  end loop;
  delete from public.game_sessions where id = v_id;
  s := public.start_or_resume_session((select v from ctx where k = 'room_case')::uuid);
  perform tests.ok(v_quiet and s.code_wrong_streak = 7 and s.code_locked_until is null,
    'a new session inherits the wrong-answer streak');
  perform public.submit_action(s.id, jsonb_build_object('type', 'inspect', 'hotspot_id', h))
     from unnest(array['desk', 'cabinet', 'dresser']) h;
  r := public.submit_action(s.id, '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_clara","motive_id":"m_debt","method_id":"x_tea"}');
  perform tests.ok(r ->> 'outcome' = 'wrong' and (r ->> 'retry_after')::timestamptz > now() + interval '9 minutes',
    'the eighth wrong answer starts the lock even when the first seven were in a deleted session');
end $$;
rollback;

begin;
select tests.claims('11111111-0000-4000-8000-000000000011');
set local role authenticated;
do $$
declare
  v_id uuid := (select v from ctx where k = 'session_case')::uuid;
  r    jsonb;
begin
  r := public.submit_action(v_id, '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_ivy","motive_id":"m_debt","method_id":"x_brandy"}');
  perform tests.ok(r = '{"outcome":"wrong","puzzle_id":"name_the_killer","message":"That doesn''t add up."}'::jsonb
      and (select code_wrong_streak from public.game_sessions where id = v_id) = 1,
    'after the cooldown one wrong accusation does not re-lock');
  r := public.submit_action(v_id, '{"type":"accuse","puzzle_id":"name_the_killer","suspect_id":"s_ivy","motive_id":"m_debt","method_id":"x_tea"}');
  perform tests.ok(r ->> 'outcome' = 'solved' and r ->> 'puzzle_id' = 'name_the_killer'
      and r ->> 'message' = 'She never caught the 08:15.' and (r ->> 'completed')::boolean
      and r ->> 'exit_message' = 'Ivy Marsh is led away.' and r -> 'state' -> 'contradicted' = '["s_ivy"]'::jsonb,
    'the right accusation solves the exit and completes the case');
  perform tests.ok((select status = 'completed' and code_wrong_streak = 0 and wrong_answer_count = 9
                    from public.game_sessions where id = v_id),
    'a right accusation clears the streak; wrong_answer_count stays cumulative');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
delete from auth.users where id in ('11111111-0000-4000-8000-000000000011', '22222222-0000-4000-8000-000000000022');
delete from private.storage_deletion_queue where object_path like '11111111-0000-4000-8000-000000000011/%';
drop schema tests cascade;
\o
\echo 'database tests (genres, accuse): all assertions passed'
