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

// ---------------------------------------------------------------------------
// The accuse step, on the crime scene from supabase/tests/03_genres_accuse.sql:
// three inspects grant the evidence (ticket names the culprit, letter the
// motive, teacup the method); the accusation needs all three and is the exit.
// open_box sits before it and needs the key from find_key; the ticket also
// clues the safe's code.
// ---------------------------------------------------------------------------
const rect = (x: number, y: number) => ({ type: "rect", x, y, w: 0.2, h: 0.2 });
const CASE_DEF = {
  schema_version: 1,
  genre: "crime_scene",
  title: "Supper at Marsh House",
  photos: [{ asset_key: "t/1.jpg" }],
  items: [
    { id: "ticket", name: "Train ticket", description: "A ticket for the 08:15, never punched. Ivy Marsh swore she was on that train." },
    { id: "letter", name: "Letter", description: "A final demand for a debt, signed by the host." },
    { id: "teacup", name: "Teacup", description: "A bitter film at the bottom: poisoned tea." },
    { id: "key", name: "Small key", description: "It fits something small." },
  ],
  hotspots: ["desk", "cabinet", "dresser", "box", "rug", "safe"].map((id, i) => ({
    id, photo_index: 0, object_label: id, shape: rect((i % 3) * 0.3, i < 3 ? 0 : 0.5),
  })),
  puzzles: [
    { id: "search_desk", kind: "inspect", hotspot_id: "desk" },
    { id: "open_cabinet", kind: "inspect", hotspot_id: "cabinet" },
    { id: "check_dresser", kind: "inspect", hotspot_id: "dresser" },
    { id: "open_box", kind: "use_item", hotspot_id: "box" },
    {
      id: "name_the_killer", kind: "accuse", requires: ["search_desk", "open_cabinet", "check_dresser"],
      title: "Name the killer", prompt: "Who did it, why, and how?",
      suspects: [
        { id: "s_ivy", name: "Ivy Marsh", role: "The housekeeper", alibi: "On the 08:15 to town all evening." },
        { id: "s_tom", name: "Tom Reed", role: "The gardener", alibi: "Pruning roses until dark." },
        { id: "s_clara", name: "Clara Voss", role: "The niece", alibi: "Asleep upstairs by nine." },
      ],
      motives: [{ id: "m_debt", name: "Debt" }, { id: "m_jealousy", name: "Jealousy" }, { id: "m_revenge", name: "Revenge" }],
      methods: [{ id: "x_tea", name: "Poisoned tea" }, { id: "x_brandy", name: "Spiked brandy" }, { id: "x_pills", name: "Sleeping pills" }],
    },
    { id: "find_key", kind: "inspect", hotspot_id: "rug" },
    { id: "open_safe", kind: "code", hotspot_id: "safe" },
  ],
  exit: { requires: ["name_the_killer"], message: "Ivy Marsh is led away." },
};
const CASE_SECRET = {
  schema_version: 1,
  puzzles: {
    search_desk: { rewards: { items: ["ticket"] }, message: "Under the blotter: a train ticket." },
    open_cabinet: { rewards: { items: ["letter"] }, message: "A letter, folded small." },
    check_dresser: { rewards: { items: ["teacup"] }, message: "A teacup, pushed to the back." },
    open_box: { item_id: "key", rewards: { consume_items: ["key"] }, message: "The box is empty." },
    name_the_killer: {
      answer: { suspect: "s_ivy", motive: "m_debt", method: "x_tea" },
      evidence: { suspect: "ticket", motive: "letter", method: "teacup" },
      rewards: { items: [], consume_items: [], reveal_hotspots: [] },
      message: "She never caught the 08:15.",
      hints: [
        "Three things you found tell one story.",
        "The ticket breaks an alibi; the letter and the cup say why and how.",
        "Ivy Marsh, for a debt, with poisoned tea.",
      ],
    },
    find_key: { rewards: { items: ["key"] }, message: "A small key under the rug." },
    open_safe: { answer: "0815", message: "The safe is empty." },
  },
};

function playCase(session: Session, action: Record<string, unknown>, opts: Record<string, unknown> = {}) {
  return submitAction(session, CASE_DEF, CASE_SECRET, action, opts);
}
const accuse = (suspect_id: string, motive_id: string, method_id: string, puzzle_id = "name_the_killer") =>
  ({ type: "accuse", puzzle_id, suspect_id, motive_id, method_id });
const EVIDENCE = ["cabinet", "desk", "dresser"].map((hotspot_id) => ({ type: "inspect", hotspot_id }));
const WRONG = { outcome: "wrong", puzzle_id: "name_the_killer", message: "That doesn't add up." };

function withEvidence(): Session {
  let s = createSession(CASE_DEF);
  for (const action of EVIDENCE) s = playCase(s, action).session;
  return s;
}

Deno.test("accuse: requires, contradicted, invalid picks, and the right accusation", () => {
  let s = createSession(CASE_DEF);
  assert(!("contradicted" in s.state));   // like start_or_resume_session: added by the first state write
  assertEquals(playCase(s, accuse("s_ivy", "m_debt", "x_tea")).result,
    { outcome: "invalid", message: "That puzzle is not available." });

  let step = playCase(s, EVIDENCE[0]);          // letter: no suspect evidence yet
  assertEquals(step.result.state.contradicted, []);
  step = playCase(step.session, EVIDENCE[1]);   // ticket breaks Ivy Marsh's alibi
  assertEquals(step.result.state.contradicted, ["s_ivy"]);
  step = playCase(step.session, EVIDENCE[2]);
  assertEquals(step.session.state.contradicted, ["s_ivy"]);
  s = step.session;

  // Ids that are not this puzzle's options in their dimension: invalid, nothing written.
  for (const action of [
    accuse("m_debt", "m_debt", "x_tea"),
    accuse("s_nobody", "m_debt", "x_tea"),
    accuse("s_ivy", "m_debt", "ticket"),
    { type: "accuse", puzzle_id: "name_the_killer", suspect_id: "s_ivy", motive_id: "m_debt" },
  ]) {
    const r = playCase(s, action);
    assertEquals(r.result, { outcome: "invalid", message: "Pick one of each." });
    assertEquals(r.session, s);
  }
  assertEquals(playCase(s, accuse("s_ivy", "m_debt", "x_tea", "search_desk")).result.message, "That puzzle is not available.");

  const wrong = playCase(s, accuse("s_ivy", "m_debt", "x_brandy"));
  assertEquals(wrong.result, WRONG);
  assertEquals(wrong.session.code_wrong_streak, 1);
  const right = playCase(wrong.session, accuse("s_ivy", "m_debt", "x_tea"));
  assertEquals(right.result.outcome, "solved");
  assertEquals(right.result.message, "She never caught the 08:15.");
  assertEquals(right.result.completed, true);
  assertEquals(right.result.exit_message, "Ivy Marsh is led away.");
  assertEquals(right.result.state.contradicted, ["s_ivy"]);
  assertEquals(right.session.code_wrong_streak, 0);
  assertEquals(right.session.wrong_answer_count, 1);
  assertEquals(right.session.status, "completed");
});

Deno.test("accuse: every wrong triple gets one identical reply and counts like a wrong code", () => {
  let s = withEvidence();
  const state = s.state;
  const replies = new Set<string>();
  for (const suspect of ["s_ivy", "s_tom", "s_clara"]) {
    for (const motive of ["m_debt", "m_jealousy", "m_revenge"]) {
      for (const method of ["x_tea", "x_brandy", "x_pills"]) {
        if (suspect === "s_ivy" && motive === "m_debt" && method === "x_tea") continue;
        const r = playCase(s, accuse(suspect, motive, method), { cooldown: { wrongAnswers: 100 } });
        replies.add(JSON.stringify(r.result));
        s = r.session;
      }
    }
  }
  assertEquals([...replies], [JSON.stringify(WRONG)]);
  assertEquals(s.wrong_answer_count, 26);
  assertEquals(s.code_wrong_streak, 26);
  assertEquals(s.state, state);
});

Deno.test("accuse: codes and accusations share one streak and one lock", () => {
  const t0 = Date.UTC(2026, 9, 26, 12, 0, 0);
  let s = withEvidence();
  for (let i = 0; i < 4; i++) s = playCase(s, accuse("s_tom", "m_debt", "x_tea"), { now: t0 }).session;
  for (let i = 0; i < 3; i++) s = playCase(s, { type: "solve", puzzle_id: "open_safe", answer: "1111" }, { now: t0 }).session;
  assertEquals(s.code_wrong_streak, 7);

  const eighth = playCase(s, accuse("s_clara", "m_revenge", "x_pills"), { now: t0 });
  assertEquals(eighth.result, { ...WRONG, retry_after: new Date(t0 + 10 * 60_000).toISOString() });
  assertEquals(eighth.session.code_wrong_streak, 0);
  s = eighth.session;

  // Locked: the right accusation and the right code are both refused, nothing is written.
  const locked = playCase(s, accuse("s_ivy", "m_debt", "x_tea"), { now: t0 + 60_000 });
  assertEquals(locked.result.outcome, "invalid");
  assertEquals(locked.result.reason, "cooldown");
  assertEquals(locked.result.retry_after, new Date(t0 + 10 * 60_000).toISOString());
  assertEquals(locked.session, s);
  assertEquals(playCase(s, { type: "solve", puzzle_id: "open_safe", answer: "0815" }, { now: t0 + 60_000 }).result.reason, "cooldown");
  const inspect = playCase(s, { type: "inspect", hotspot_id: "rug" }, { now: t0 + 60_000 });
  assertEquals(inspect.result.outcome, "solved");
  assertEquals(inspect.session.code_locked_until, s.code_locked_until);

  const after = playCase(inspect.session, accuse("s_ivy", "m_debt", "x_tea"), { now: t0 + 10 * 60_000 + 1 });
  assertEquals(after.result.outcome, "solved");
  assertEquals(after.session.code_wrong_streak, 0);
  assertEquals(after.session.wrong_answer_count, 8);
});

Deno.test("a new session inherits the streak and lock, so starting again never lifts a lock", () => {
  const t0 = Date.UTC(2026, 9, 26, 12, 0, 0);
  let s = withEvidence();
  for (let i = 0; i < 8; i++) s = playCase(s, accuse("s_tom", "m_debt", "x_tea"), { now: t0 }).session;
  assertEquals(s.code_locked_until, t0 + 10 * 60_000);

  let again: Session = createSession(CASE_DEF, s);
  assertEquals([again.code_wrong_streak, again.code_locked_until, again.wrong_answer_count], [0, t0 + 10 * 60_000, 0]);
  for (const action of EVIDENCE) again = playCase(again, action, { now: t0 }).session;
  assertEquals(playCase(again, accuse("s_ivy", "m_debt", "x_tea"), { now: t0 + 60_000 }).result.reason, "cooldown");

  // After the lock: seven wrong answers, then a fresh session; the next wrong answer locks again.
  for (let i = 0; i < 7; i++) again = playCase(again, accuse("s_tom", "m_debt", "x_tea"), { now: t0 + 11 * 60_000 }).session;
  again = createSession(CASE_DEF, again);
  assertEquals([again.code_wrong_streak, again.code_locked_until], [7, null]);
  for (const action of EVIDENCE) again = playCase(again, action, { now: t0 + 11 * 60_000 }).session;
  assertEquals(playCase(again, accuse("s_tom", "m_debt", "x_tea"), { now: t0 + 11 * 60_000 }).result.retry_after,
    new Date(t0 + 21 * 60_000).toISOString());
  assertEquals(createSession(CASE_DEF).code_wrong_streak, 0);   // no previous session: a clean start
});

Deno.test("hints treat an accusation like combine: attemptable once its requires are met", () => {
  const s = withEvidence();
  // open_box comes first but its key is not held; the accusation has no hotspot to reveal.
  assertEquals(hintTarget(s, CASE_DEF, CASE_SECRET), "name_the_killer");
  const hint = useHint(s, CASE_DEF, CASE_SECRET, 1);
  assertEquals(hint.result.puzzle_id, "name_the_killer");
  assertEquals(hint.result.hint, "Three things you found tell one story.");
});

Deno.test("walkthrough solves a crime scene, and evidence makes its granting puzzles required", () => {
  assertEquals(requiredPuzzleIds(CASE_DEF, CASE_SECRET), ["search_desk", "open_cabinet", "check_dresser", "name_the_killer"]);
  const run = walkthrough(CASE_DEF, CASE_SECRET);
  assertEquals(run.completed, true);
  assertEquals(run.steps.map((step: { puzzle_id: string }) => step.puzzle_id),
    ["search_desk", "open_cabinet", "check_dresser", "name_the_killer"]);
  assertEquals(run.steps[3].action, accuse("s_ivy", "m_debt", "x_tea"));
  assertEquals(run.optional, ["open_box", "find_key", "open_safe"]);

  // Even when the accusation does not require the dresser, its teacup is evidence.
  const looser = structuredClone(CASE_DEF);
  looser.puzzles[4].requires = ["search_desk", "open_cabinet"];
  assert(requiredPuzzleIds(looser, CASE_SECRET).includes("check_dresser"));
});
