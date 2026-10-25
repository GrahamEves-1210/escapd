-- =============================================================================
-- Escapd database tests, part 2: clue coverage and the hints key in the
-- validator, the service-only preview RPC, use_hint, and the wrong-code
-- cooldown in submit_action.
-- Run via scripts/test-db.sh (after 01). Fails fast (ON_ERROR_STOP) on the
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
-- E = 0e.. (full account), F = 0f.. (guest), T = tutorial room/version (from seed)
insert into auth.users (id, email, is_anonymous) values
  ('eeeeeeee-0000-4000-8000-00000000000e', 'e@test.dev', false),
  ('ffffffff-0000-4000-8000-00000000000f', null, true);

create temp table ctx (k text primary key, v text);
grant all on ctx to public;
insert into ctx select 'tut_pub', public_definition::text
  from public.puzzle_versions where id = '00000000-0000-4000-8000-000000000002';
insert into ctx select 'tut_sec', solution::text
  from private.puzzle_solutions where puzzle_version_id = '00000000-0000-4000-8000-000000000002';

-- =============================================================================
-- 1. Validator: clue coverage, hints, separator-only answers
-- =============================================================================
do $$
declare
  v_pub  jsonb := (select v from ctx where k = 'tut_pub')::jsonb;
  v_sec  jsonb := (select v from ctx where k = 'tut_sec')::jsonb;
  v_room jsonb;
  v_rsec jsonb;
  v_errs text[];
  v_hint_err constant text := 'puzzle find_key: hints must be an array of 1-3 non-empty strings of at most 400 characters';
begin
  perform tests.ok(cardinality(private.validate_puzzle_definition(v_pub, v_sec)) = 0,
    'seeded tutorial (with hints) passes the extended validator');
  perform tests.ok((select bool_and(jsonb_array_length(value -> 'hints') = 3) from jsonb_each(v_sec -> 'puzzles')),
    'every tutorial puzzle carries three hint rungs');

  -- Without the taped note's text, 0427 is written nowhere the player can read.
  v_errs := private.validate_puzzle_definition(
    jsonb_set(v_pub, '{items,3,description}', '"The halves do not quite meet."'), v_sec);
  perform tests.ok('puzzle open_safe: code answer is not written anywhere the player can read before solving it' = any(v_errs),
    'an unclued code fails validation with the clue-coverage error');
  perform tests.ok(not ('puzzle open_safe can never be solved' = any(v_errs)),
    'the clue error replaces the generic unsolvable error for that code');

  -- Standalone room: the card carrying the code is only found after the code is solved.
  v_room := '{
    "schema_version": 1, "photos": [{ "asset_key": "t/1.jpg" }],
    "items": [{ "id": "card", "name": "Card", "description": "Pencilled on the back: 5150." }],
    "hotspots": [
      { "id": "box",  "photo_index": 0, "object_label": "box",  "shape": { "type": "rect", "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2 } },
      { "id": "lamp", "photo_index": 0, "object_label": "lamp", "shape": { "type": "rect", "x": 0.5, "y": 0.5, "w": 0.2, "h": 0.2 } } ],
    "puzzles": [
      { "id": "open_box",  "kind": "code",    "hotspot_id": "box" },
      { "id": "find_card", "kind": "inspect", "hotspot_id": "lamp", "requires": ["open_box"] } ],
    "exit": { "requires": ["find_card"] } }';
  v_rsec := '{ "schema_version": 1, "puzzles": {
    "open_box":  { "answer": "5150" },
    "find_card": { "rewards": { "items": ["card"] } } } }';
  v_errs := private.validate_puzzle_definition(v_room, v_rsec);
  perform tests.ok('puzzle open_box: code answer is not written anywhere the player can read before solving it' = any(v_errs),
    'a code clued only by an item obtained after solving it fails validation');

  v_errs := private.validate_puzzle_definition(
    jsonb_set(jsonb_set(v_room, '{puzzles}', '[{ "id": "open_box", "kind": "code", "hotspot_id": "box" }]'),
              '{exit,requires}', '["open_box"]'),
    '{ "schema_version": 1, "puzzles": { "open_box": { "answer": "5150", "rewards": { "items": ["card"] } } } }');
  perform tests.ok('puzzle open_box: code answer is not written anywhere the player can read before solving it' = any(v_errs),
    'a code clued only by its own reward fails validation');

  -- Same room, but the card does not depend on the code: valid even though the
  -- code comes first in array order.
  v_errs := private.validate_puzzle_definition(
    jsonb_set(jsonb_set(v_room, '{puzzles,1}', '{ "id": "find_card", "kind": "inspect", "hotspot_id": "lamp" }'),
              '{exit,requires}', '["open_box", "find_card"]'),
    v_rsec);
  perform tests.ok(cardinality(v_errs) = 0, 'a clue gathered before the code is accepted regardless of array order');

  -- A clue in a visible hotspot description counts, with answer normalization.
  v_errs := private.validate_puzzle_definition(
    jsonb_set(jsonb_set(jsonb_set(v_room, '{hotspots,1,description}', '"Scratched into the base: 51-50"'),
                        '{puzzles,1}', '{ "id": "find_card", "kind": "inspect", "hotspot_id": "lamp" }'),
              '{items,0,description}', '"Blank."'),
    v_rsec);
  perform tests.ok(cardinality(v_errs) = 0, 'a normalized clue in a revealed hotspot description is accepted');

  -- Two descriptions cannot be stitched into one code.
  v_errs := private.validate_puzzle_definition(
    jsonb_set(jsonb_set(jsonb_set(v_room, '{hotspots,0,description}', '"A box. The lid says 51"'),
                        '{hotspots,1,description}', '"50 watts, says the lamp."'),
              '{items,0,description}', '"Blank."'),
    jsonb_set(v_rsec, '{puzzles,find_card}', '{}'));
  perform tests.ok('puzzle open_box: code answer is not written anywhere the player can read before solving it' = any(v_errs),
    'a code split across two separate descriptions is not a clue');

  -- Secret hints: 1-3 non-empty strings, <= 400 characters each.
  perform tests.ok(v_hint_err = any(private.validate_puzzle_definition(v_pub,
      jsonb_set(v_sec, '{puzzles,find_key,hints}', '["a", "b", "c", "d"]'))), 'more than three hints is rejected');
  perform tests.ok(v_hint_err = any(private.validate_puzzle_definition(v_pub,
      jsonb_set(v_sec, '{puzzles,find_key,hints}', '[]'))), 'an empty hints array is rejected');
  perform tests.ok(v_hint_err = any(private.validate_puzzle_definition(v_pub,
      jsonb_set(v_sec, '{puzzles,find_key,hints}', '["Look closer.", "   "]'))), 'a blank hint is rejected');
  perform tests.ok(v_hint_err = any(private.validate_puzzle_definition(v_pub,
      jsonb_set(v_sec, '{puzzles,find_key,hints}', '"Look closer."'))), 'hints must be an array');
  perform tests.ok(v_hint_err = any(private.validate_puzzle_definition(v_pub,
      jsonb_set(v_sec, '{puzzles,find_key,hints}', '[1, 2]'))), 'hints must be strings');
  perform tests.ok(v_hint_err = any(private.validate_puzzle_definition(v_pub,
      jsonb_set(v_sec, '{puzzles,find_key,hints}', jsonb_build_array(repeat('x', 401))))), 'a hint over 400 characters is rejected');
  perform tests.ok(cardinality(private.validate_puzzle_definition(v_pub,
      jsonb_set(v_sec, '{puzzles,find_key,hints}', jsonb_build_array(repeat('x', 400))))) = 0, 'a single 400-character hint is accepted');
  perform tests.ok(cardinality(private.validate_puzzle_definition(v_pub, v_sec #- '{puzzles,find_key,hints}')) = 0,
    'hints are optional');
  perform tests.ok('public definition contains solution-only keys (answer/rewards/inputs/solution/hints)' = any(
      private.validate_puzzle_definition(jsonb_set(v_pub, '{puzzles,0,hints}', '["Look in the drawer."]'), v_sec)),
    'hints in the public definition are rejected as a secret leak');
  perform tests.ok('code puzzle open_safe needs a non-empty answer' = any(
      private.validate_puzzle_definition(v_pub, jsonb_set(v_sec, '{puzzles,open_safe,answer}', '"- -"'))),
    'a code answer made only of separators is rejected');
end $$;

-- =============================================================================
-- 2. worker_preview_puzzle: service-only, read-only
-- =============================================================================
do $$
begin
  perform tests.ok(not has_function_privilege('anon', 'public.worker_preview_puzzle(jsonb, jsonb)', 'execute'),
    'anon cannot execute worker_preview_puzzle');
  perform tests.ok(not has_function_privilege('authenticated', 'public.worker_preview_puzzle(jsonb, jsonb)', 'execute'),
    'authenticated cannot execute worker_preview_puzzle');
  perform tests.ok(has_function_privilege('service_role', 'public.worker_preview_puzzle(jsonb, jsonb)', 'execute'),
    'service_role can execute worker_preview_puzzle');
end $$;

begin;
select tests.claims('eeeeeeee-0000-4000-8000-00000000000e');
set local role authenticated;
select tests.throws($q$select public.worker_preview_puzzle('{}'::jsonb, '{}'::jsonb)$q$,
  'a player cannot call worker_preview_puzzle', 'permission denied');
rollback;

begin;
insert into ctx values
  ('pv_count', (select count(*) from public.puzzle_versions)::text),
  ('ps_count', (select count(*) from private.puzzle_solutions)::text);
set local role service_role;
do $$
declare
  v_errs text[];
begin
  v_errs := public.worker_preview_puzzle(
    p_public_definition => (select v from ctx where k = 'tut_pub')::jsonb,
    p_solution          => (select v from ctx where k = 'tut_sec')::jsonb);
  perform tests.ok(v_errs = '{}'::text[], 'preview returns no errors for a valid definition');

  v_errs := public.worker_preview_puzzle(
    jsonb_set((select v from ctx where k = 'tut_pub')::jsonb, '{items,3,description}', '"Blank."'),
    (select v from ctx where k = 'tut_sec')::jsonb);
  perform tests.ok('puzzle open_safe: code answer is not written anywhere the player can read before solving it' = any(v_errs),
    'preview returns the validator errors (clue coverage)');

  v_errs := public.worker_preview_puzzle('{"schema_version":1,"photos":[],"hotspots":[],"puzzles":[]}', '{"schema_version":1,"puzzles":{}}');
  perform tests.ok(cardinality(v_errs) > 0, 'preview returns errors for a malformed definition');
end $$;
reset role;
select tests.ok(
  (select count(*) from public.puzzle_versions) = (select v::bigint from ctx where k = 'pv_count')
  and (select count(*) from private.puzzle_solutions) = (select v::bigint from ctx where k = 'ps_count'),
  'worker_preview_puzzle inserts no puzzle_versions or puzzle_solutions rows');
rollback;

-- =============================================================================
-- 3. use_hint
-- =============================================================================
do $$
begin
  perform tests.ok(not has_function_privilege('anon', 'public.use_hint(uuid, integer)', 'execute')
    and has_function_privilege('authenticated', 'public.use_hint(uuid, integer)', 'execute'),
    'use_hint is granted to authenticated only');
end $$;

begin;
select tests.claims('eeeeeeee-0000-4000-8000-00000000000e');
set local role authenticated;
do $$
declare
  s        public.game_sessions;
  r        jsonb;
  r2       jsonb;
  v_before jsonb;
  v_reveal text;
begin
  s := public.start_or_resume_session('00000000-0000-4000-8000-000000000001');
  perform tests.ok(s.hint_progress = '{}'::jsonb and s.hints_used = 0, 'a new session starts with no hint progress');

  r := public.use_hint(s.id, 1);
  perform tests.ok(r ->> 'status' = 'ok' and r ->> 'puzzle_id' = 'find_key' and (r ->> 'rung')::int = 1
      and (r ->> 'total_rungs')::int = 3 and coalesce(r ->> 'hint', '') <> ''
      and not (r ->> 'already_revealed')::boolean and (r ->> 'hints_used')::int = 1,
    'first hint targets the first attemptable puzzle and costs one');
  r2 := public.use_hint(s.id, 1);
  perform tests.ok(r2 ->> 'status' = 'ok' and r2 ->> 'hint' = r ->> 'hint'
      and (r2 ->> 'already_revealed')::boolean and (r2 ->> 'hints_used')::int = 1,
    'asking for the same rung again returns it without charging');
  perform tests.ok((select hints_used from public.game_sessions where id = s.id) = 1,
    'the same rung twice increments hints_used once');

  r := public.use_hint(s.id, 3);
  perform tests.ok(r ->> 'status' = 'rung_unavailable' and (r ->> 'next_rung')::int = 2 and not (r ? 'hint'),
    'skipping a rung is refused and names the next rung');
  perform tests.ok(public.use_hint(s.id, 0) ->> 'status' = 'rung_unavailable'
      and public.use_hint(s.id, null) ->> 'status' = 'rung_unavailable',
    'rung 0 and a null rung are refused');

  -- Solving a different puzzle does not move the ladder.
  perform public.submit_action(s.id, '{"type":"inspect","hotspot_id":"bookshelf"}');
  r := public.use_hint(s.id, 2);
  perform tests.ok(r ->> 'puzzle_id' = 'find_key' and (r ->> 'rung')::int = 2 and (r ->> 'hints_used')::int = 2,
    'the hint target stays pinned until it is solved');

  select hint_progress into v_before from public.game_sessions where id = s.id;
  perform tests.ok(v_before ->> 'puzzle_id' = 'find_key' and jsonb_array_length(v_before -> 'rungs') = 2,
    'hint_progress records the target and the two rungs shown');
  r := public.use_hint(s.id, 3);
  perform tests.ok(r ->> 'status' = 'ok' and (r ->> 'rung')::int = 3 and (r ->> 'hints_used')::int = 3,
    'the third rung opens after the second');
  perform tests.ok(strpos(v_before::text, r ->> 'hint') = 0, 'an unrevealed rung is never stored on the session');
  r := public.use_hint(s.id, 4);
  perform tests.ok(r ->> 'status' = 'rung_unavailable' and r -> 'next_rung' = 'null'::jsonb
      and (r ->> 'hints_used')::int = 3,
    'there is no rung past the last one');

  -- Solving the target moves the ladder to the next step (inspect, use_item, combine, code).
  perform public.submit_action(s.id, '{"type":"inspect","hotspot_id":"desk_drawer"}');
  r := public.use_hint(s.id, 1);
  perform tests.ok(r ->> 'puzzle_id' = 'find_note_right' and not (r ->> 'already_revealed')::boolean
      and (r ->> 'hints_used')::int = 4,
    'once the target is solved, the next attemptable puzzle becomes the target');
  perform public.submit_action(s.id, '{"type":"inspect","hotspot_id":"rug"}');
  perform tests.ok(public.use_hint(s.id, 1) ->> 'puzzle_id' = 'open_cabinet',
    'a use_item puzzle is the next step once its item is held');
  perform public.submit_action(s.id, '{"type":"use_item","item_id":"brass_key","hotspot_id":"cabinet"}');
  perform tests.ok(public.use_hint(s.id, 1) ->> 'puzzle_id' = 'join_notes',
    'a combine puzzle is the next step once both inputs are held (definition order wins)');
  perform public.submit_action(s.id, '{"type":"combine","item_ids":["torn_note_left","torn_note_right"]}');
  perform public.use_hint(s.id, 1);
  perform public.use_hint(s.id, 2);
  r := public.use_hint(s.id, 3);
  v_reveal := r ->> 'hint';
  perform tests.ok(r ->> 'puzzle_id' = 'open_safe' and (r ->> 'hints_used')::int = 9 and v_reveal like '%0427%',
    'the reveal rung for the code states the answer');
  perform tests.ok(not exists (select 1 from public.puzzle_versions where strpos(public_definition::text, v_reveal) > 0)
      and not exists (select 1 from public.puzzle_versions where jsonb_path_exists(public_definition, 'lax $.**.hints')),
    'the reveal rung never appears in any readable public_definition');

  -- Hints off in settings: structured response, nothing charged, no replay.
  update public.user_settings set hints_enabled = false;
  r := public.use_hint(s.id, 1);
  perform tests.ok(r ->> 'status' = 'disabled' and (r ->> 'hints_used')::int = 9 and not (r ? 'hint'),
    'hints disabled returns a structured disabled response');
  perform tests.ok(public.use_hint(s.id, 3) ->> 'status' = 'disabled'
      and (select hints_used from public.game_sessions where id = s.id) = 9,
    'hints disabled also withholds already-shown rungs and charges nothing');
  update public.user_settings set hints_enabled = true;
  r := public.use_hint(s.id, 3);
  perform tests.ok(r ->> 'hint' = v_reveal and (r ->> 'already_revealed')::boolean and (r ->> 'hints_used')::int = 9,
    're-enabling hints replays shown rungs for free');

  perform tests.throws($q$update public.game_sessions set hint_progress = '{}', hints_used = 0$q$,
    'client cannot write hint progress directly', 'permission denied');
  insert into ctx values ('session_e', s.id::text);
end $$;
commit;

-- Another user cannot read hints from E's session
begin;
select tests.claims('ffffffff-0000-4000-8000-00000000000f', true);
set local role authenticated;
select tests.throws(format($q$select public.use_hint('%s', 1)$q$, (select v from ctx where k = 'session_e')),
  'use_hint rejects another user''s session', 'session not found');
rollback;

-- No hints for the target; inactive sessions
begin;
update private.puzzle_solutions set solution = solution #- '{puzzles,find_key,hints}'
 where puzzle_version_id = '00000000-0000-4000-8000-000000000002';
select tests.claims('ffffffff-0000-4000-8000-00000000000f', true);
set local role authenticated;
do $$
declare
  s public.game_sessions;
  r jsonb;
begin
  s := public.start_or_resume_session('00000000-0000-4000-8000-000000000001');
  r := public.use_hint(s.id, 1);
  perform tests.ok(r ->> 'status' = 'no_hints' and r ->> 'puzzle_id' = 'find_key' and (r ->> 'total_rungs')::int = 0
      and (r ->> 'hints_used')::int = 0 and not (r ? 'hint'),
    'a target without hints returns a structured no_hints response');
  perform public.abandon_session(s.id);
  perform tests.throws(format($q$select public.use_hint('%s', 1)$q$, s.id),
    'use_hint refuses an inactive session', 'not active');
end $$;
rollback;

-- =============================================================================
-- 4. Wrong-code cooldown
-- =============================================================================
begin;
select tests.claims('ffffffff-0000-4000-8000-00000000000f', true);
set local role authenticated;
do $$
declare
  s        public.game_sessions;
  r        jsonb;
  v_quiet  boolean := true;
  v_count  integer;
begin
  s := public.start_or_resume_session('00000000-0000-4000-8000-000000000001');
  r := public.submit_action(s.id, '{"type":"solve","puzzle_id":"open_safe","answer":"0000"}');
  perform tests.ok(r ->> 'outcome' = 'invalid' and not (r ? 'reason'), 'an ordinary invalid solve carries no reason');
  perform public.submit_action(s.id, '{"type":"inspect","hotspot_id":"desk_drawer"}');
  perform public.submit_action(s.id, '{"type":"use_item","item_id":"brass_key","hotspot_id":"cabinet"}');

  for i in 1..7 loop
    r := public.submit_action(s.id, '{"type":"solve","puzzle_id":"open_safe","answer":"1111"}');
    v_quiet := v_quiet and r ->> 'outcome' = 'wrong' and not (r ? 'retry_after') and not (r ? 'reason');
  end loop;
  perform tests.ok(v_quiet, 'the first seven wrong codes are plain wrong answers');

  r := public.submit_action(s.id, '{"type":"solve","puzzle_id":"open_safe","answer":"2222"}');
  select * into s from public.game_sessions where id = s.id;
  perform tests.ok(r ->> 'outcome' = 'wrong' and (r ->> 'retry_after')::timestamptz = s.code_locked_until,
    'the eighth wrong code is still wrong and announces retry_after');
  perform tests.ok(s.code_locked_until between now() + interval '9 minutes' and now() + interval '11 minutes'
      and s.code_wrong_streak = 0 and s.wrong_answer_count = 8,
    'eight wrong codes lock code entry for ten minutes and reset the streak');
  v_count := s.action_count;

  r := public.submit_action(s.id, '{"type":"solve","puzzle_id":"open_safe","answer":"3333"}');
  perform tests.ok(r ->> 'outcome' = 'invalid' and r ->> 'reason' = 'cooldown'
      and (r ->> 'retry_after')::timestamptz = s.code_locked_until and coalesce(r ->> 'message', '') <> '',
    'the ninth immediate wrong code is blocked with reason cooldown and retry_after');
  r := public.submit_action(s.id, '{"type":"solve","puzzle_id":"open_safe","answer":"0427"}');
  perform tests.ok(r ->> 'outcome' = 'invalid' and r ->> 'reason' = 'cooldown',
    'even the correct code is not checked during the cooldown');
  perform tests.ok((select wrong_answer_count = 8 and action_count = v_count and code_locked_until = s.code_locked_until
      from public.game_sessions where id = s.id),
    'cooldown refusals write nothing (counters and lock unchanged)');

  r := public.submit_action(s.id, '{"type":"inspect","hotspot_id":"bookshelf"}');
  perform tests.ok(r ->> 'outcome' = 'solved' and r -> 'gained_items' ? 'torn_note_left',
    'inspect still works during the cooldown');
  perform tests.ok((select code_locked_until = s.code_locked_until from public.game_sessions where id = s.id),
    'other actions do not extend the cooldown');
  insert into ctx values ('session_f', s.id::text);
end $$;
commit;

-- Simulate the ten minutes passing.
update public.game_sessions set code_locked_until = now() - interval '1 second'
 where id = (select v from ctx where k = 'session_f')::uuid;

begin;
select tests.claims('ffffffff-0000-4000-8000-00000000000f', true);
set local role authenticated;
do $$
declare
  v_id uuid := (select v from ctx where k = 'session_f')::uuid;
  r    jsonb;
begin
  r := public.submit_action(v_id, '{"type":"solve","puzzle_id":"open_safe","answer":"9999"}');
  perform tests.ok(r ->> 'outcome' = 'wrong' and not (r ? 'retry_after')
      and (select code_wrong_streak from public.game_sessions where id = v_id) = 1,
    'after the cooldown a single wrong code does not re-lock');
  r := public.submit_action(v_id, '{"type":"solve","puzzle_id":"open_safe","answer":"0427"}');
  perform tests.ok(r ->> 'outcome' = 'solved', 'a correct code after the cooldown succeeds');
  perform tests.ok((select code_wrong_streak = 0 and wrong_answer_count = 9 from public.game_sessions where id = v_id),
    'a correct code clears the streak; wrong_answer_count stays cumulative');
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Cleanup
-- ---------------------------------------------------------------------------
delete from auth.users where id in ('eeeeeeee-0000-4000-8000-00000000000e', 'ffffffff-0000-4000-8000-00000000000f');
drop schema tests cascade;
\o
\echo 'database tests (clues, hints, cooldown): all assertions passed'
