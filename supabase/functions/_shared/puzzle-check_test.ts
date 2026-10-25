import { assert, assertEquals } from "jsr:@std/assert@1";
import { checkPuzzle, normalizeAnswer } from "./puzzle-check.ts";
import { loadSeed } from "./test_fixtures.ts";

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

const seed = await loadSeed();
const fresh = () => ({ pub: structuredClone(seed.publicDefinition) as Json, sol: structuredClone(seed.solution) as Json });
const puzzle = (pub: Json, id: string) => pub.puzzles.find((p: Json) => p.id === id);
const hotspot = (pub: Json, id: string) => pub.hotspots.find((h: Json) => h.id === id);
const has = (errors: string[], fragment: string) =>
  assert(errors.some((e) => e.includes(fragment)), `expected an error containing "${fragment}", got: ${JSON.stringify(errors)}`);

Deno.test("seed: The Study passes the TS preflight", () => {
  assertEquals(checkPuzzle(seed.publicDefinition, seed.solution), []);
});

Deno.test("normalizeAnswer mirrors private.normalize_answer", () => {
  assertEquals(normalizeAnswer("12-34"), "1234");
  assertEquals(normalizeAnswer(" 12 34 "), "1234");
  assertEquals(normalizeAnswer("A.b,c:d;e'f\"g_h\ti\nj"), "abcdefghij");
  assertEquals(normalizeAnswer(null), "");
});

Deno.test("rejects non-object inputs", () => {
  assertEquals(checkPuzzle([], {}), ["public definition must be a JSON object"]);
  assertEquals(checkPuzzle({}, null), ["solution must be a JSON object"]);
});

Deno.test("negative: dependency cycle", () => {
  const { pub, sol } = fresh();
  puzzle(pub, "find_key").requires = ["escape"];
  const errors = checkPuzzle(pub, sol);
  has(errors, "exit puzzle escape is not reachable");
  has(errors, "puzzle find_key can never be solved");
});

Deno.test("negative: self-requirement and unknown requirement", () => {
  const { pub, sol } = fresh();
  puzzle(pub, "find_key").requires = ["find_key", "nope"];
  const errors = checkPuzzle(pub, sol);
  has(errors, "puzzle find_key requires itself");
  has(errors, "puzzle find_key requires unknown puzzle nope");
});

Deno.test("negative: missing reward (key never granted)", () => {
  const { pub, sol } = fresh();
  delete sol.puzzles.find_key.rewards;
  const errors = checkPuzzle(pub, sol);
  has(errors, "puzzle open_cabinet can never be solved");
  has(errors, "exit puzzle escape is not reachable");
});

Deno.test("negative: required item consumed before it is used", () => {
  const { pub, sol } = fresh();
  sol.puzzles.find_note_right.rewards = { items: ["torn_note_right"], consume_items: ["torn_note_left"] };
  const errors = checkPuzzle(pub, sol);
  has(errors, "puzzle join_notes can never be solved");
});

Deno.test("negative: hidden hotspot never revealed", () => {
  const { pub, sol } = fresh();
  delete sol.puzzles.open_cabinet.rewards.reveal_hotspots;
  const errors = checkPuzzle(pub, sol);
  has(errors, "puzzle open_safe can never be solved");
});

Deno.test("negative: invalid photo_index and unknown photo id", () => {
  const { pub, sol } = fresh();
  hotspot(pub, "rug").photo_index = 3;
  hotspot(pub, "door").photo_index = 1.5;
  delete hotspot(pub, "bookshelf").photo_index;
  const errors = checkPuzzle(pub, sol);
  has(errors, "hotspot rug has an invalid photo_index");
  has(errors, "hotspot door has an invalid photo_index");
  has(errors, "hotspot bookshelf has an invalid photo_index");

  const ok = fresh();
  ok.pub.photos = [{ photo_id: "a" }, { photo_id: "b" }, { photo_id: "zzz" }];
  has(checkPuzzle(ok.pub, ok.sol, { photoIds: ["a", "b", "c"] }), "photos[].photo_id must reference this room's uploaded photos");
  ok.pub.photos = [{ photo_id: "b" }, { photo_id: "a" }, { photo_id: "c" }];
  assertEquals(checkPuzzle(ok.pub, ok.sol, { photoIds: ["a", "b", "c"] }), []);
  has(checkPuzzle(ok.pub, ok.sol, { photoIds: ["a", "b", "c"], generation: true }), "photos must echo the input photo ids in position order");
});

Deno.test("negative: solution keys leaked into the public definition", () => {
  for (const leak of ["answer", "rewards", "inputs", "solution", "hints"]) {
    const { pub, sol } = fresh();
    hotspot(pub, "safe").extra = [{ nested: { [leak]: "0427" } }];
    has(checkPuzzle(pub, sol), "public definition contains solution-only keys");
  }
  const { pub, sol } = fresh();
  puzzle(pub, "open_safe").answer = "0427";
  has(checkPuzzle(pub, sol), "public definition contains solution-only keys");
});

Deno.test("negative: unclued code (clue coverage)", () => {
  const { pub, sol } = fresh();
  pub.items.find((i: Json) => i.id === "full_note").description = "The halves fit together.";
  const errors = checkPuzzle(pub, sol);
  has(errors, "puzzle open_safe: code answer is not written anywhere");
  has(errors, "puzzle open_safe can never be solved");
});

Deno.test("clue coverage: text in a revealed hotspot counts; in a still-hidden one it does not", () => {
  const revealedClue = fresh();
  revealedClue.pub.items.find((i: Json) => i.id === "full_note").description = "Blank.";
  hotspot(revealedClue.pub, "rug").description = "Stitched into the hem: 04 27.";
  assertEquals(checkPuzzle(revealedClue.pub, revealedClue.sol), []);

  const hiddenClue = fresh();
  hiddenClue.pub.items.find((i: Json) => i.id === "full_note").description = "Blank.";
  hotspot(hiddenClue.pub, "door").hidden = true;
  hotspot(hiddenClue.pub, "door").description = "0427";
  has(checkPuzzle(hiddenClue.pub, hiddenClue.sol), "puzzle open_safe: code answer is not written anywhere");
});

Deno.test("clue coverage: digits never stitch across two descriptions", () => {
  // "...51" in one held item and "50..." in another do not clue 5150, in either order.
  const { pub, sol } = fresh();
  sol.puzzles.open_safe.answer = "5150";
  pub.items.find((i: Json) => i.id === "full_note").description = "The left half ends ...51";
  hotspot(pub, "safe").description = "50... is scratched beside the dial.";
  const errors = checkPuzzle(pub, sol);
  has(errors, "puzzle open_safe: code answer is not written anywhere");
  has(errors, "puzzle open_safe can never be solved");

  const whole = fresh();
  whole.sol.puzzles.open_safe.answer = "5150";
  whole.pub.items.find((i: Json) => i.id === "full_note").description = "Together they read 51-50.";
  assertEquals(checkPuzzle(whole.pub, whole.sol), []);
});

Deno.test("clue coverage: the code becomes solvable later, once its clue is readable", () => {
  // The safe is attemptable as soon as the cabinet opens, before the notes are joined;
  // coverage is a solve condition, so the simulation waits for join_notes instead of failing.
  const { pub, sol } = fresh();
  const order = ["find_key", "open_cabinet", "open_safe", "find_note_left", "find_note_right", "join_notes", "escape"];
  pub.puzzles = order.map((id) => puzzle(pub, id));
  assertEquals(checkPuzzle(pub, sol), []);
});

Deno.test("negative: code answer that normalizes to an empty string", () => {
  for (const answer of ["--", " . ", "'_'"]) {
    const { pub, sol } = fresh();
    sol.puzzles.open_safe.answer = answer;
    has(checkPuzzle(pub, sol), "code puzzle open_safe needs a non-empty answer");
  }
});

Deno.test("clue coverage: a clue item consumed before the code is solved does not count", () => {
  const { pub, sol } = fresh();
  sol.puzzles.open_cabinet.rewards.consume_items = ["brass_key", "full_note"];
  puzzle(pub, "open_cabinet").requires = ["find_key", "join_notes"];
  has(checkPuzzle(pub, sol), "puzzle open_safe: code answer is not written anywhere");
});

Deno.test("negative: malformed rects", () => {
  const cases: Array<[Json | undefined, string]> = [
    [{ type: "rect", x: 0.8, y: 0.1, w: 0.3, h: 0.1 }, "shape must be normalized"],
    [{ type: "rect", x: 0.1, y: 0.1, w: 0, h: 0.1 }, "shape must be normalized"],
    [{ type: "rect", x: -0.01, y: 0.1, w: 0.2, h: 0.1 }, "shape must be normalized"],
    [{ type: "rect", x: 0.7, y: 0.1, w: 0.30000000000000004, h: 0.1 }, "shape must be normalized"],
    [{ type: "circle", x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, "needs a rect shape"],
    [{ type: "rect", x: "0.1", y: 0.1, w: 0.2, h: 0.1 }, "needs a rect shape"],
    [{ type: "rect", y: 0.1, w: 0.2, h: 0.1 }, "needs a rect shape"],
    [undefined, "needs a rect shape"],
  ];
  for (const [shape, fragment] of cases) {
    const { pub, sol } = fresh();
    if (shape) hotspot(pub, "rug").shape = shape;
    else delete hotspot(pub, "rug").shape;
    has(checkPuzzle(pub, sol), `hotspot rug ${fragment}`);
  }
  const edge = fresh();
  hotspot(edge.pub, "rug").shape = { type: "rect", x: 0.7, y: 0.9, w: 0.3, h: 0.1 };   // exactly touches 1 in decimal
  assertEquals(checkPuzzle(edge.pub, edge.sol), []);
});

Deno.test("negative: bad ids", () => {
  const { pub, sol } = fresh();
  hotspot(pub, "rug").id = "Woven Rug";
  pub.items[0].id = "_key";
  const errors = checkPuzzle(pub, sol);
  has(errors, "invalid hotspot id: Woven Rug");
  has(errors, "invalid item id: _key");

  const dup = fresh();
  dup.pub.puzzles.push({ ...puzzle(dup.pub, "find_key") });
  has(checkPuzzle(dup.pub, dup.sol), "duplicate puzzle id: find_key");

  const long = fresh();
  puzzle(long.pub, "escape").id = "x".repeat(65);
  has(checkPuzzle(long.pub, long.sol), "invalid puzzle id");
});

Deno.test("negative: solution entries out of step with puzzles", () => {
  const { pub, sol } = fresh();
  sol.puzzles.ghost = { message: "boo" };
  delete sol.puzzles.escape;
  const errors = checkPuzzle(pub, sol);
  has(errors, "solution has entry for unknown puzzle ghost");
  has(errors, "puzzle escape has no solution entry");
});

Deno.test("negative: kind-specific solution rules", () => {
  const { pub, sol } = fresh();
  sol.puzzles.open_safe.answer = "   ";
  sol.puzzles.open_cabinet.item_id = "nope";
  sol.puzzles.join_notes.inputs = ["torn_note_left"];
  const errors = checkPuzzle(pub, sol);
  has(errors, "code puzzle open_safe needs a non-empty answer");
  has(errors, "use_item puzzle open_cabinet references unknown item");
  has(errors, "combine puzzle join_notes needs exactly 2 inputs");
});

Deno.test("negative: excess size", () => {
  const { pub, sol } = fresh();
  pub.intro = "x".repeat(262_144);
  has(checkPuzzle(pub, sol), "public definition exceeds 256 KB");
});

Deno.test("generation contract: hints and code leaks", () => {
  const { pub, sol } = fresh();
  // The seed ships hints; generation mode must reject a puzzle without them.
  delete sol.puzzles.find_key.hints;
  const errors = checkPuzzle(pub, sol, { generation: true });
  has(errors, "puzzle find_key needs exactly 3 hint strings");

  for (const s of Object.values(sol.puzzles) as Json[]) s.hints = ["a", "b", "c"];
  assertEquals(checkPuzzle(pub, sol, { generation: true }), []);

  hotspot(pub, "safe").description = "Someone scratched 04-27 beside the dial.";
  has(checkPuzzle(pub, sol, { generation: true }), "code puzzle open_safe answer appears in public text outside item descriptions (hotspot safe.description)");

  sol.puzzles.find_key.hints = ["a", "b", "x".repeat(401)];
  has(checkPuzzle(pub, sol, { generation: true }), "puzzle find_key needs exactly 3 hint strings");
});
