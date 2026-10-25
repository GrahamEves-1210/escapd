-- =============================================================================
-- Hints and the wrong-code cooldown
-- =============================================================================
-- Additive to 20261023000500_gameplay.sql. No new tables; three columns on
-- game_sessions, two app_config tunables, a new client RPC (use_hint), and
-- submit_action replaced with the cooldown added (everything else unchanged).
--
-- Why new columns instead of keys in game_sessions.state:
--   submit_action rebuilds `state` from solved/inventory/revealed_hotspots on
--   every solve, so any other key there would be dropped.
--
--   hint_progress      { "puzzle_id": "<target>", "rungs": ["<rung 1 text>", ...] }
--                      The puzzle the hint ladder is pinned to and the rung texts
--                      already shown for it. Only revealed rungs are stored (the
--                      client can read this row). May name a puzzle that has
--                      since been solved; treat that as "nothing revealed yet".
--   code_wrong_streak  Wrong code answers since the last lock or correct code.
--   code_locked_until  While in the future, every `solve` is refused.
--
-- Why not wrong_answer_count + last_played_at (the plan's first sketch):
--   last_played_at moves on every action, so an inspect during a cooldown
--   would extend it, and a cumulative count would re-lock after a single wrong
--   answer once the first lock ended. A dedicated lock timestamp is not moved
--   by other actions, and the streak resets when a lock starts (and on a
--   correct code), so each lock is followed by a fresh allowance.
--   wrong_answer_count stays the cumulative total it always was.
-- =============================================================================

alter table public.game_sessions
  add column hint_progress     jsonb not null default '{}'::jsonb
                                 check (jsonb_typeof(hint_progress) = 'object'),
  add column code_wrong_streak integer not null default 0 check (code_wrong_streak >= 0),
  add column code_locked_until timestamptz;

insert into private.app_config (key, value, description) values
  ('code_cooldown_wrong_answers', '8',  'Consecutive wrong code answers in a session before code entry pauses'),
  ('code_cooldown_minutes',       '10', 'How long code entry stays paused once the wrong-answer limit is hit')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- The puzzle engine, with the wrong-code cooldown.
-- p_action is one of:
--   { "type": "inspect",  "hotspot_id": "desk_drawer" }
--   { "type": "solve",    "puzzle_id": "safe_code", "answer": "4096" }
--   { "type": "use_item", "item_id": "brass_key", "hotspot_id": "cabinet" }
--   { "type": "combine",  "item_ids": ["note_a", "note_b"] }
-- Returns:
--   { outcome: solved | wrong | nothing | invalid,
--     puzzle_id, message, gained_items, consumed_items, revealed_hotspots,
--     completed, state }
-- Cooldown (solve only; inspect/use_item/combine are never blocked):
--   The wrong answer that reaches code_cooldown_wrong_answers (default 8) still
--   returns outcome "wrong" and also carries "retry_after". Until then, every
--   solve returns, without writing anything:
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
         -- a correct code clears the wrong-code streak
         code_wrong_streak = case when v_type = 'solve' then 0 else code_wrong_streak end,
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
-- Hints. Three rungs per puzzle live in the secret solution:
--   puzzles[<puzzle_id>].hints = [nudge, direction, reveal]   (1-3 entries)
-- The ladder is pinned to the player's next step: the first unsolved puzzle,
-- in definition order, that can be attempted right now (requires met; hotspot
-- revealed unless combine; use_item item held; combine inputs both held).
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
      and (p ->> 'kind' = 'combine' or (p ->> 'hotspot_id') = any(v_revealed))
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

revoke all on function public.submit_action(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_action(uuid, jsonb) to authenticated;
revoke all on function public.use_hint(uuid, integer) from public, anon, authenticated;
grant execute on function public.use_hint(uuid, integer) to authenticated;
