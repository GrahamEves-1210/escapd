// Local port of the puzzle engine for the developer trial preview (play.html).
//
// The database is the authority: public.submit_action, public.use_hint and
// public.start_or_resume_session in
// supabase/migrations/20261026000100_genres_and_accuse.sql (the accuse action,
// the shared cooldown and how a new session inherits it, state.contradicted)
// and private.normalize_answer in 20261023000500_gameplay.sql. This file
// mirrors them so a generated room can be played offline before it is ever
// published.
// It never ships in the app, which only renders what submit_action returns.
// If this file and the SQL disagree, the SQL is right; fix this file.
//
// Plain JavaScript with no imports: play.html inlines it after stripping the
// `export` keywords, and the Deno tests import it as a module.
//
// Sessions are plain objects and every call returns a new one:
//   { status, state: { solved, inventory, revealed_hotspots, contradicted? },
//     action_count, wrong_answer_count, hints_used, hint_progress,
//     code_wrong_streak, code_locked_until (ms since epoch | null) }
// As in SQL, a new session has no `contradicted`; every state write adds it.

export const COOLDOWN_DEFAULTS = { wrongAnswers: 8, minutes: 10 };

/** The accuse step's dimensions: action key, secret answer/evidence key, public option list. */
const ACCUSE_DIMENSIONS = [
  { action: "suspect_id", key: "suspect", options: "suspects" },
  { action: "motive_id", key: "motive", options: "motives" },
  { action: "method_id", key: "method", options: "methods" },
];

const MAX_ACTION_BYTES = 2048;

/** private.normalize_answer: lower-case, then drop whitespace (any \s, as puzzle-check.ts) and - _ . , : ; ' " */
export function normalizeAnswer(value) {
  return String(value ?? "").toLowerCase().replace(/[\s\-_.,:;'"]+/g, "");
}

const list = (value) => (Array.isArray(value) ? value.map(String) : []);
const secretOf = (secret, puzzleId) => (secret && secret.puzzles && secret.puzzles[puzzleId]) || null;
const requiresMet = (puzzle, solved) => list(puzzle.requires).every((r) => solved.includes(r));
const unique = (values) => [...new Set(values)];
/** Postgres `->>` on a JSON value: strings as they are, anything else as JSON text, missing as null. */
const textOf = (value) => (value == null ? null : typeof value === "string" ? value : JSON.stringify(value));

/** The accused suspect of each accusation whose suspect evidence is held (state.contradicted). */
function contradictedSuspects(def, secret, inventory) {
  return (def.puzzles || [])
    .filter((p) => p.kind === "accuse" && inventory.includes(secretOf(secret, p.id)?.evidence?.suspect))
    .map((p) => secretOf(secret, p.id).answer?.suspect ?? null);
}

/** The wrong-answer path shared by codes and accusations: one streak, one lock. */
function wrongAnswer(session, puzzleId, message, now, cooldown) {
  // The wrong answer that completes the streak starts the lock and resets the streak.
  const lock = session.code_wrong_streak + 1 >= cooldown.wrongAnswers ? now + cooldown.minutes * 60_000 : null;
  const next = {
    ...session,
    wrong_answer_count: session.wrong_answer_count + 1,
    action_count: session.action_count + 1,
    code_wrong_streak: lock === null ? session.code_wrong_streak + 1 : 0,
    code_locked_until: lock,
  };
  const result = { outcome: "wrong", puzzle_id: puzzleId, message };
  if (lock !== null) result.retry_after = new Date(lock).toISOString();
  return { session: next, result };
}

/**
 * start_or_resume_session for a new session: every non-hidden hotspot is
 * revealed. The streak and lock carry over from `previous`, the player's last
 * session on this room if any (private.code_cooldowns), so starting again
 * never lifts a lock.
 */
export function createSession(def, previous = null) {
  return {
    status: "active",
    state: {
      solved: [],
      inventory: [],
      revealed_hotspots: (def.hotspots || []).filter((h) => h.hidden !== true).map((h) => h.id),
    },
    action_count: 0,
    wrong_answer_count: 0,
    hints_used: 0,
    hint_progress: {},
    code_wrong_streak: previous?.code_wrong_streak ?? 0,
    code_locked_until: previous?.code_locked_until ?? null,
  };
}

function assertActive(session) {
  // submit_action and use_hint raise for an inactive session.
  if (!session || session.status !== "active") throw new Error("session is not active");
}

/**
 * public.submit_action. Returns { session, result }; result has the same keys
 * as the RPC's jsonb. opts.now (ms) and opts.cooldown override the clock and
 * the code_cooldown_* config values.
 */
export function submitAction(session, def, secret, action, opts = {}) {
  const now = opts.now ?? Date.now();
  const cooldown = { ...COOLDOWN_DEFAULTS, ...(opts.cooldown || {}) };
  if (action === null || typeof action !== "object" || Array.isArray(action) ||
      new TextEncoder().encode(JSON.stringify(action)).length > MAX_ACTION_BYTES) {
    throw new Error("invalid action");
  }
  assertActive(session);

  const puzzles = def.puzzles || [];
  const solved = list(session.state.solved);
  const inventory = list(session.state.inventory);
  const revealed = list(session.state.revealed_hotspots);
  const same = (result) => ({ session, result });
  let puzzle = null;

  if (action.type === "inspect") {
    const target = action.hotspot_id;
    if (target == null || !revealed.includes(target)) {
      return same({ outcome: "invalid", message: "That is not something you can interact with yet." });
    }
    puzzle = puzzles.find((p) => p.kind === "inspect" && p.hotspot_id === target &&
      !solved.includes(p.id) && requiresMet(p, solved)) || null;
  } else if (action.type === "solve") {
    // Cooldown: no code is checked (right or wrong) while the lock holds.
    if (session.code_locked_until != null && session.code_locked_until > now) {
      return same({
        outcome: "invalid",
        reason: "cooldown",
        retry_after: new Date(session.code_locked_until).toISOString(),
        message: "The lock needs a rest. Try another code in a few minutes; everything else is still within reach.",
      });
    }
    puzzle = puzzles.find((p) => p.id === action.puzzle_id && p.kind === "code") || null;
    if (!puzzle || solved.includes(puzzle.id) || !revealed.includes(puzzle.hotspot_id) || !requiresMet(puzzle, solved)) {
      return same({ outcome: "invalid", message: "That puzzle is not available." });
    }
    const expected = secretOf(secret, puzzle.id)?.answer;
    if (normalizeAnswer(action.answer) !== normalizeAnswer(expected)) {
      return wrongAnswer(session, puzzle.id, "Nothing happens.", now, cooldown);
    }
  } else if (action.type === "accuse") {
    // Cooldown: shared with codes, so the same lock stops a walk through all 27 accusations.
    if (session.code_locked_until != null && session.code_locked_until > now) {
      return same({
        outcome: "invalid",
        reason: "cooldown",
        retry_after: new Date(session.code_locked_until).toISOString(),
        message: "Take a breath. Try another accusation in a few minutes; everything else is still within reach.",
      });
    }
    puzzle = puzzles.find((p) => p.id === textOf(action.puzzle_id) && p.kind === "accuse") || null;
    if (!puzzle || solved.includes(puzzle.id) || !requiresMet(puzzle, solved)) {
      return same({ outcome: "invalid", message: "That puzzle is not available." });
    }
    // Decided from the public options alone, so it says nothing about the answer.
    const offered = (d) => (Array.isArray(puzzle[d.options]) ? puzzle[d.options] : [])
      .some((o) => o != null && textOf(o.id) !== null && textOf(o.id) === textOf(action[d.action]));
    if (!ACCUSE_DIMENSIONS.every(offered)) {
      return same({ outcome: "invalid", message: "Pick one of each." });
    }
    const answer = secretOf(secret, puzzle.id)?.answer || {};
    if (ACCUSE_DIMENSIONS.some((d) => textOf(action[d.action]) !== textOf(answer[d.key]))) {
      // Exactly the wrong-code path: same streak, same lock, one reply for every wrong triple.
      return wrongAnswer(session, puzzle.id, "That doesn't add up.", now, cooldown);
    }
  } else if (action.type === "use_item") {
    const target = action.hotspot_id;
    if (!inventory.includes(action.item_id) || target == null || !revealed.includes(target)) {
      return same({ outcome: "invalid", message: "You can't do that." });
    }
    puzzle = puzzles.find((p) => p.kind === "use_item" && p.hotspot_id === target &&
      secretOf(secret, p.id)?.item_id === action.item_id &&
      !solved.includes(p.id) && requiresMet(p, solved)) || null;
  } else if (action.type === "combine") {
    if (!Array.isArray(action.item_ids) || action.item_ids.length !== 2) {
      return same({ outcome: "invalid", message: "Pick two items to combine." });
    }
    const items = action.item_ids.map(String);
    if (!items.every((i) => inventory.includes(i))) {
      return same({ outcome: "invalid", message: "You don't have those items." });
    }
    // inputs @> items and inputs <@ items: the same set, in any order.
    puzzle = puzzles.find((p) => {
      if (p.kind !== "combine" || solved.includes(p.id) || !requiresMet(p, solved)) return false;
      const inputs = list(secretOf(secret, p.id)?.inputs);
      return items.every((i) => inputs.includes(i)) && inputs.every((i) => items.includes(i));
    }) || null;
  } else {
    return same({ outcome: "invalid", message: "Unknown action." });
  }

  if (!puzzle) {
    // No state change, so no write.
    return same({ outcome: "nothing", message: "Nothing interesting happens." });
  }

  const sol = secretOf(secret, puzzle.id) || {};
  const rewards = sol.rewards || {};
  const gained = list(rewards.items);
  const consumed = list(rewards.consume_items);
  const reveal = list(rewards.reveal_hotspots);

  const nextSolved = [...solved, puzzle.id];
  // Postgres de-duplicates with DISTINCT (unordered); this keeps first-seen order.
  const nextInventory = unique([...inventory, ...gained]).filter((i) => !consumed.includes(i));
  const nextRevealed = unique([...revealed, ...reveal]);
  const completed = list(def.exit && def.exit.requires).every((r) => nextSolved.includes(r));
  const state = {
    solved: nextSolved,
    inventory: nextInventory,
    revealed_hotspots: nextRevealed,
    // Only what the player already holds: the suspect evidence names the culprit.
    contradicted: contradictedSuspects(def, secret, nextInventory),
  };

  const next = {
    ...session,
    state,
    action_count: session.action_count + 1,
    // a correct code or accusation clears the wrong-answer streak
    code_wrong_streak: action.type === "solve" || action.type === "accuse" ? 0 : session.code_wrong_streak,
    status: completed ? "completed" : session.status,
  };
  return {
    session: next,
    result: {
      outcome: "solved",
      puzzle_id: puzzle.id,
      message: sol.message ?? "Something changed.",
      gained_items: gained,
      consumed_items: consumed,
      revealed_hotspots: reveal,
      completed,
      exit_message: completed ? (def.exit && def.exit.message) ?? null : null,
      state,
    },
  };
}

/** The puzzle use_hint pins its ladder to, or null when nothing is left. */
export function hintTarget(session, def, secret) {
  const puzzles = def.puzzles || [];
  const solved = list(session.state.solved);
  const inventory = list(session.state.inventory);
  const revealed = list(session.state.revealed_hotspots);

  // Keep the stored target until it is solved, so rungs never jump between puzzles.
  const stored = session.hint_progress && session.hint_progress.puzzle_id;
  if (stored != null && !solved.includes(stored) && puzzles.some((p) => p.id === stored)) return stored;

  const open = (p) => !solved.includes(p.id) && requiresMet(p, solved);
  // combine and accuse have no hotspot: their requires (and inputs) alone make them attemptable.
  const attemptable = puzzles.find((p) => open(p) &&
    (p.kind === "combine" || p.kind === "accuse" || revealed.includes(p.hotspot_id)) &&
    (p.kind !== "use_item" || inventory.includes(secretOf(secret, p.id)?.item_id)) &&
    (p.kind !== "combine" || list(secretOf(secret, p.id)?.inputs).every((i) => inventory.includes(i))));
  if (attemptable) return attemptable.id;
  return puzzles.find(open)?.id ?? null;
}

/** Rung texts already shown for the current ladder (what a client may display without charging). */
export function shownRungs(session) {
  const progress = session.hint_progress || {};
  if (progress.puzzle_id == null || list(session.state.solved).includes(progress.puzzle_id)) return [];
  return list(progress.rungs);
}

/**
 * public.use_hint. Returns { session, result }. opts.hintsEnabled mirrors
 * user_settings.hints_enabled (default true).
 */
export function useHint(session, def, secret, rung, opts = {}) {
  assertActive(session);
  const same = (result) => ({ session, result });
  if (opts.hintsEnabled === false) {
    return same({ status: "disabled", hints_used: session.hints_used, message: "Hints are turned off in settings." });
  }

  const target = hintTarget(session, def, secret);
  const progress = session.hint_progress || {};
  const rungs = target != null && target === progress.puzzle_id && Array.isArray(progress.rungs) ? list(progress.rungs) : [];
  const shown = rungs.length;
  const hints = target != null && Array.isArray(secretOf(secret, target)?.hints) ? list(secretOf(secret, target).hints) : [];
  const total = hints.length;

  if (total === 0) {
    return same({
      status: "no_hints",
      puzzle_id: target,
      total_rungs: 0,
      hints_used: session.hints_used,
      message: "There is no hint for this step. Look again at what you already hold.",
    });
  }

  const asked = Number.isInteger(rung) ? rung : null;
  // Already shown: replay without charging.
  if (asked !== null && asked >= 1 && asked <= shown) {
    return same({
      status: "ok", puzzle_id: target, rung: asked, total_rungs: total,
      hint: hints[asked - 1], already_revealed: true, hints_used: session.hints_used,
    });
  }

  // Only the next rung can be opened.
  if (asked !== shown + 1 || asked > total) {
    return same({
      status: "rung_unavailable",
      puzzle_id: target,
      rung: asked,
      next_rung: shown < total ? shown + 1 : null,
      total_rungs: total,
      hints_used: session.hints_used,
      message: "Hints open one rung at a time.",
    });
  }

  const next = {
    ...session,
    hint_progress: { puzzle_id: target, rungs: [...rungs, hints[asked - 1]] },
    hints_used: session.hints_used + 1,
  };
  return {
    session: next,
    result: {
      status: "ok", puzzle_id: target, rung: asked, total_rungs: total,
      hint: hints[asked - 1], already_revealed: false, hints_used: next.hints_used,
    },
  };
}

/** The action a player would send to solve this puzzle, using the secret. */
export function actionFor(puzzle, secret) {
  const sol = secretOf(secret, puzzle.id) || {};
  if (puzzle.kind === "inspect") return { type: "inspect", hotspot_id: puzzle.hotspot_id };
  if (puzzle.kind === "code") return { type: "solve", puzzle_id: puzzle.id, answer: String(sol.answer ?? "") };
  if (puzzle.kind === "use_item") return { type: "use_item", item_id: sol.item_id, hotspot_id: puzzle.hotspot_id };
  if (puzzle.kind === "accuse") {
    const answer = sol.answer || {};
    const action = { type: "accuse", puzzle_id: puzzle.id };
    for (const d of ACCUSE_DIMENSIONS) action[d.action] = answer[d.key];
    return action;
  }
  return { type: "combine", item_ids: list(sol.inputs).slice(0, 2) };
}

/**
 * Puzzles the exit depends on: through requires, through the items a puzzle
 * consumes, through revealing its hidden hotspot, for a code through whatever
 * makes the answer readable (an item or hidden hotspot whose description
 * contains it, the clue-coverage rule), and for an accusation through the
 * puzzles that grant its evidence items (the deducibility rule).
 */
export function requiredPuzzleIds(def, secret) {
  const puzzles = def.puzzles || [];
  const byId = new Map(puzzles.map((p) => [p.id, p]));
  const grants = new Map();      // item id -> puzzle ids that grant it
  const reveals = new Map();     // hotspot id -> puzzle ids that reveal it
  for (const p of puzzles) {
    const rewards = secretOf(secret, p.id)?.rewards || {};
    for (const i of list(rewards.items)) grants.set(i, [...(grants.get(i) || []), p.id]);
    for (const h of list(rewards.reveal_hotspots)) reveals.set(h, [...(reveals.get(h) || []), p.id]);
  }
  const hidden = new Set((def.hotspots || []).filter((h) => h.hidden === true).map((h) => h.id));
  const needed = new Set();
  const queue = list(def.exit && def.exit.requires);
  while (queue.length) {
    const id = queue.shift();
    if (needed.has(id) || !byId.has(id)) continue;
    needed.add(id);
    const p = byId.get(id);
    const sol = secretOf(secret, id) || {};
    queue.push(...list(p.requires));
    const items = p.kind === "use_item" ? [sol.item_id]
      : p.kind === "combine" ? list(sol.inputs)
      : p.kind === "accuse" ? ACCUSE_DIMENSIONS.map((d) => sol.evidence?.[d.key]).filter((i) => i != null).map(String)
      : [];
    if (p.kind === "code") {
      const answer = normalizeAnswer(sol.answer);
      const mentions = (text) => answer !== "" && normalizeAnswer(text).includes(answer);
      for (const item of def.items || []) if (mentions(item.description)) items.push(item.id);
      for (const h of def.hotspots || []) if (hidden.has(h.id) && mentions(h.description)) queue.push(...(reveals.get(h.id) || []));
    }
    for (const i of items) queue.push(...(grants.get(i) || []));
    if (p.hotspot_id && hidden.has(p.hotspot_id)) queue.push(...(reveals.get(p.hotspot_id) || []));
  }
  return puzzles.filter((p) => needed.has(p.id)).map((p) => p.id);
}

/**
 * A solve order found by playing the room with the engine: repeatedly take the
 * first required puzzle whose action the engine accepts. Returns the steps and
 * whether the room completed.
 */
export function walkthrough(def, secret) {
  const required = new Set(requiredPuzzleIds(def, secret));
  const puzzles = (def.puzzles || []).filter((p) => required.has(p.id));
  let session = createSession(def);
  const steps = [];
  let progress = true;
  while (session.status === "active" && progress) {
    progress = false;
    for (const p of puzzles) {
      if (session.state.solved.includes(p.id)) continue;
      const action = actionFor(p, secret);
      const { session: next, result } = submitAction(session, def, secret, action);
      if (result.outcome === "solved" && result.puzzle_id === p.id) {
        steps.push({ puzzle_id: p.id, kind: p.kind, action, message: result.message, completed: result.completed });
        session = next;
        progress = true;
        break;
      }
    }
  }
  return { steps, completed: session.status === "completed", optional: (def.puzzles || []).filter((p) => !required.has(p.id)).map((p) => p.id) };
}
