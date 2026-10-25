-- =============================================================================
-- Validator extensions: clue coverage, secret hints, and a service-only preview
-- =============================================================================
-- Additive to 20261023000200_rooms_and_puzzles.sql. The function body below is
-- the original private.validate_puzzle_definition with three changes:
--
--   1. Clue coverage. In the greedy solvability simulation a `code` puzzle is
--      only solvable once its answer is written somewhere the player can read:
--      the descriptions of items currently in the simulated inventory plus the
--      descriptions of hotspots currently revealed (non-hidden hotspots from the
--      start, hidden ones after a simulated reveal). Both sides are normalized
--      with private.normalize_answer, the same rule submit_action uses, so
--      "12 34" in a description covers the answer "12-34". The answer must sit
--      inside one description; it cannot span two. Treating the clue as
--      a solve condition (rather than failing the moment the code becomes
--      attemptable) keeps the check independent of puzzle array order: a clue
--      found later, by a puzzle that does not depend on the code, still counts.
--      A code that never gets a readable clue reports
--      "puzzle <id>: code answer is not written anywhere the player can read
--      before solving it" instead of the generic "can never be solved".
--   2. Code answers must contain at least one character that survives
--      normalization. An answer such as "--" normalizes to '' and would match
--      any separator-only input (and trivially any clue corpus).
--   3. Optional secret `hints` per puzzle: an array of 1-3 non-empty strings,
--      each at most 400 characters (rung 1 nudge, 2 direction, 3 reveal; read
--      by public.use_hint). `hints` joins answer/rewards/inputs/solution as a
--      key that must never appear anywhere in the public definition.
--
-- SECRET solution entry, extended:
--   "<puzzle_id>": { ..., "hints": ["nudge", "direction", "reveal"] }
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
  -- solvability simulation
  solved        text[] := '{}';
  inventory     text[] := '{}';
  revealed      text[] := '{}';
  progress      boolean;
  can_solve     boolean;
  corpus        text;
  clue_blocked  text[] := '{}';   -- code puzzles that were attemptable but had no readable clue
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
     or jsonb_path_exists(p_public, 'lax $.**.solution')
     or jsonb_path_exists(p_public, 'lax $.**.hints') then
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
  -- (catches cycles, missing items, unreachable hidden hotspots, and codes
  -- whose answer the player cannot read before solving them).
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
    -- blocked on its clue and is still unsolved is unsolved because of the clue.
    if (p ->> 'id') = any(clue_blocked) then
      errors := array_append(errors, (format('puzzle %s: code answer is not written anywhere the player can read before solving it', p ->> 'id'))::text);
    else
      errors := array_append(errors, (format('puzzle %s can never be solved', p ->> 'id'))::text);
    end if;
  end loop;

  return errors;
end;
$$;

revoke all on function private.validate_puzzle_definition(jsonb, jsonb) from public, anon, authenticated;
grant execute on function private.validate_puzzle_definition(jsonb, jsonb) to service_role;

-- The validator is not SECURITY DEFINER and now calls private.normalize_answer
-- (the single normalization rule shared with submit_action). service_role
-- already holds EXECUTE on the validator, so it needs the helper as well.
grant execute on function private.normalize_answer(text) to service_role;

-- ---------------------------------------------------------------------------
-- Preview: lets the generation pipeline see validation errors before it asks
-- worker_complete_generation_job to publish (one repair pass). Read-only: it
-- never inserts a puzzle_versions or puzzle_solutions row, and STABLE makes
-- PostgREST run it in a read-only transaction. Publish still re-validates and
-- additionally checks photos[].photo_id against the job's room, which a
-- preview cannot know.
-- Parameter names are a fixed contract with supabase/functions:
--   admin().rpc('worker_preview_puzzle', { p_public_definition, p_solution })
-- Returns the validator's errors; an empty array means publishable.
-- ---------------------------------------------------------------------------
create or replace function public.worker_preview_puzzle(p_public_definition jsonb, p_solution jsonb)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return private.validate_puzzle_definition(p_public_definition, p_solution);
end;
$$;

revoke all on function public.worker_preview_puzzle(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.worker_preview_puzzle(jsonb, jsonb) to service_role;
