// The engine port must play The Study (supabase/seed.sql) exactly as
// submit_action / use_hint do (supabase/tests/*.sql cover the SQL side).
import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { loadSeed } from "../../supabase/functions/_shared/test_fixtures.ts";
import {
  createSession,
  hintTarget,
  normalizeAnswer,
  requiredPuzzleIds,
  shownRungs,
  submitAction,
  useHint,
  walkthrough,
} from "./engine.js";

const { publicDefinition: def, solution: secret } = await loadSeed();

// deno-lint-ignore no-explicit-any
type Session = any;
function play(session: Session, action: Record<string, unknown>, now?: number) {
  return submitAction(session, def, secret, action, now === undefined ? {} : { now });
}

const STUDY: Array<[Record<string, unknown>, string]> = [
  [{ type: "inspect", hotspot_id: "desk_drawer" }, "find_key"],
  [{ type: "inspect", hotspot_id: "bookshelf" }, "find_note_left"],
  [{ type: "inspect", hotspot_id: "rug" }, "find_note_right"],
  [{ type: "use_item", item_id: "brass_key", hotspot_id: "cabinet" }, "open_cabinet"],
  [{ type: "combine", item_ids: ["torn_note_right", "torn_note_left"] }, "join_notes"],
  [{ type: "solve", puzzle_id: "open_safe", answer: "04-27" }, "open_safe"],
  [{ type: "inspect", hotspot_id: "door" }, "escape"],
];

Deno.test("a new session reveals every non-hidden hotspot", () => {
  const s = createSession(def);
  assertEquals(s.state.revealed_hotspots, ["desk_drawer", "bookshelf", "rug", "cabinet", "door"]);
  assertEquals(s.state.solved, []);
  assertEquals(s.status, "active");
});

Deno.test("the full tutorial sequence completes with the exit message", () => {
  let s = createSession(def);
  let last: Record<string, unknown> = {};
  for (const [action, puzzle] of STUDY) {
    const { session, result } = play(s, action);
    assertEquals(result.outcome, "solved", `${JSON.stringify(action)} -> ${JSON.stringify(result)}`);
    assertEquals(result.puzzle_id, puzzle);
    s = session;
    last = result;
  }
  assertEquals(last.completed, true);
  assertEquals(last.exit_message, "The door swings open. You escaped!");
  assertEquals(s.status, "completed");
  assertEquals(s.action_count, STUDY.length);
  assertEquals(s.state.inventory, ["full_note"]);   // key and both halves consumed
  assertThrows(() => play(s, { type: "inspect", hotspot_id: "door" }), Error, "session is not active");
});

Deno.test("rewards: gained, consumed and revealed are reported and applied", () => {
  let s = createSession(def);
  s = play(s, STUDY[0][0]).session;
  const { session, result } = play(s, STUDY[3][0]);
  assertEquals(result.gained_items, []);
  assertEquals(result.consumed_items, ["brass_key"]);
  assertEquals(result.revealed_hotspots, ["safe"]);
  assertEquals(result.message, "The cabinet opens, revealing a wall safe.");
  assert(session.state.revealed_hotspots.includes("safe"));
  assertEquals(session.state.inventory, []);
});

Deno.test("the hidden safe stays unreachable until the cabinet is opened", () => {
  let s = createSession(def);
  assert(!s.state.revealed_hotspots.includes("safe"));
  assertEquals(play(s, { type: "inspect", hotspot_id: "safe" }).result.outcome, "invalid");
  assertEquals(play(s, { type: "solve", puzzle_id: "open_safe", answer: "0427" }).result,
    { outcome: "invalid", message: "That puzzle is not available." });
  for (const [action] of STUDY.slice(0, 3)) s = play(s, action).session;
  assert(!s.state.revealed_hotspots.includes("safe"));
  s = play(s, STUDY[3][0]).session;
  assert(s.state.revealed_hotspots.includes("safe"));
});

Deno.test("codes: wrong answers, normalization, and the cooldown", () => {
  let s = createSession(def);
  for (const [action] of STUDY.slice(0, 4)) s = play(s, action).session;
  const wrong = play(s, { type: "solve", puzzle_id: "open_safe", answer: "1234" });
  assertEquals(wrong.result, { outcome: "wrong", puzzle_id: "open_safe", message: "Nothing happens." });
  assertEquals(wrong.session.wrong_answer_count, 1);
  assertEquals(wrong.session.code_wrong_streak, 1);
  assertEquals(wrong.session.state, s.state);
  assertEquals(normalizeAnswer(" 0 4.2_7 "), "0427");
  assertEquals(normalizeAnswer("O-4'2\"7"), "o427");

  // The 8th consecutive wrong code still says "wrong", carries retry_after and starts the lock.
  const t0 = Date.UTC(2026, 9, 23, 12, 0, 0);
  for (let i = 0; i < 7; i++) s = play(s, { type: "solve", puzzle_id: "open_safe", answer: `${i}000` }, t0).session;
  assertEquals(s.code_wrong_streak, 7);
  const eighth = play(s, { type: "solve", puzzle_id: "open_safe", answer: "9999" }, t0);
  assertEquals(eighth.result.outcome, "wrong");
  assertEquals(eighth.result.retry_after, new Date(t0 + 10 * 60_000).toISOString());
  assertEquals(eighth.session.code_wrong_streak, 0);
  s = eighth.session;

  // Locked: even the right code is refused, nothing is written, other actions still work.
  const locked = play(s, { type: "solve", puzzle_id: "open_safe", answer: "0427" }, t0 + 60_000);
  assertEquals(locked.result.reason, "cooldown");
  assertEquals(locked.result.outcome, "invalid");
  assertEquals(locked.session, s);
  assertEquals(play(s, { type: "inspect", hotspot_id: "door" }, t0 + 60_000).result.outcome, "nothing");

  // After the lock, the right code works and clears the streak.
  const open = play(s, { type: "solve", puzzle_id: "open_safe", answer: "0427" }, t0 + 10 * 60_000 + 1);
  assertEquals(open.result.outcome, "solved");
  assertEquals(open.session.code_wrong_streak, 0);
});

Deno.test("invalid and nothing outcomes match the SQL messages", () => {
  let s = createSession(def);
  assertEquals(play(s, { type: "inspect", hotspot_id: "nope" }).result.message, "That is not something you can interact with yet.");
  assertEquals(play(s, { type: "inspect", hotspot_id: "cabinet" }).result, { outcome: "nothing", message: "Nothing interesting happens." });
  assertEquals(play(s, { type: "use_item", item_id: "brass_key", hotspot_id: "cabinet" }).result.message, "You can't do that.");
  assertEquals(play(s, { type: "combine", item_ids: ["a"] }).result.message, "Pick two items to combine.");
  assertEquals(play(s, { type: "combine", item_ids: ["torn_note_left", "torn_note_right"] }).result.message, "You don't have those items.");
  assertEquals(play(s, { type: "dance" }).result.message, "Unknown action.");
  s = play(s, STUDY[0][0]).session;
  // The key is held but the drawer is not a lock: nothing.
  assertEquals(play(s, { type: "use_item", item_id: "brass_key", hotspot_id: "desk_drawer" }).result.outcome, "nothing");
  // Inspecting a spent hotspot again: nothing.
  assertEquals(play(s, STUDY[0][0]).result.outcome, "nothing");
  assertThrows(() => play(s, null as unknown as Record<string, unknown>), Error, "invalid action");
});

Deno.test("hints target the next attemptable step and charge once per rung", () => {
  let s = createSession(def);
  assertEquals(hintTarget(s, def, secret), "find_key");

  const first = useHint(s, def, secret, 1);
  assertEquals(first.result.status, "ok");
  assertEquals(first.result.puzzle_id, "find_key");
  assertEquals(first.result.already_revealed, false);
  assertEquals(first.result.hints_used, 1);
  s = first.session;

  // Same rung again: free replay.
  const again = useHint(s, def, secret, 1);
  assertEquals(again.result.already_revealed, true);
  assertEquals(again.session.hints_used, 1);
  // Skipping a rung is refused.
  const skip = useHint(s, def, secret, 3);
  assertEquals(skip.result.status, "rung_unavailable");
  assertEquals(skip.result.next_rung, 2);
  s = useHint(s, def, secret, 2).session;
  s = useHint(s, def, secret, 3).session;
  assertEquals(s.hints_used, 3);
  assertEquals(shownRungs(s).length, 3);
  const beyond = useHint(s, def, secret, 4);
  assertEquals(beyond.result.status, "rung_unavailable");
  assertEquals(beyond.result.next_rung, null);

  // The ladder stays pinned to find_key while it is unsolved, even after other progress.
  s = play(s, STUDY[1][0]).session;
  assertEquals(hintTarget(s, def, secret), "find_key");
  // Once solved, it moves on: the rug comes before the (now attemptable) cabinet in definition order.
  s = play(s, STUDY[0][0]).session;
  assertEquals(shownRungs(s), []);
  assertEquals(hintTarget(s, def, secret), "find_note_right");
  s = play(s, STUDY[2][0]).session;
  assertEquals(hintTarget(s, def, secret), "open_cabinet");
  const cab = useHint(s, def, secret, 1);
  assertEquals(cab.result.puzzle_id, "open_cabinet");
  assertEquals(cab.result.hints_used, 4);

  // With both halves held, the combine is next (the safe is still hidden).
  s = play(cab.session, STUDY[3][0]).session;
  assertEquals(hintTarget(s, def, secret), "join_notes");
  assertEquals(useHint(s, def, secret, 1, { hintsEnabled: false }).result.status, "disabled");
});

Deno.test("walkthrough finds the solve order and the required set", () => {
  // join_notes is required only because its note carries the safe's code (clue coverage).
  assertEquals(requiredPuzzleIds(def, secret), (def.puzzles as Array<{ id: string }>).map((p) => p.id));
  const run = walkthrough(def, secret);
  assertEquals(run.completed, true);
  assertEquals(run.steps.length, 7);
  assertEquals(run.optional, []);
  assertEquals(run.steps[run.steps.length - 1].puzzle_id, "escape");
});
