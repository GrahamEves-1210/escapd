import { assert, assertEquals } from "jsr:@std/assert@1";
import { HOTSPOT_EFFECTS } from "./contract.ts";
import { assembleDefinition } from "./prose.ts";
import { checkPuzzle, namesAny, namesDistinct, normalizeAnswer, provesOption, revealsAnswer } from "./puzzle-check.ts";
import { assignRoles, compileTemplate, CRIME_SCENE_TEMPLATES } from "./templates.ts";
import { FAKE_OBJECTS, loadSeed, seededRandomInt } from "./test_fixtures.ts";

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
  // \s, as in the SQL regex under the usual locales: Unicode spaces go too.
  assertEquals(normalizeAnswer("a b　c d"), "abcd");
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

// ---------------------------------------------------------------------------
// Genres: genre, hotspot effect, accuse
// ---------------------------------------------------------------------------
Deno.test("genre: absent or one of the three; anything else is rejected", () => {
  for (const genre of ["noir", "crime_scene", "paranormal"]) {
    const { pub, sol } = fresh();
    pub.genre = genre;
    assertEquals(checkPuzzle(pub, sol), [], genre);
  }
  for (const genre of ["horror", "Noir", "", null, 1]) {
    const { pub, sol } = fresh();
    pub.genre = genre;
    has(checkPuzzle(pub, sol), "public.genre must be one of noir, crime_scene, paranormal");
  }
});

Deno.test("effect: the five known effects pass; anything else is rejected", () => {
  for (const effect of HOTSPOT_EFFECTS) {
    const { pub, sol } = fresh();
    hotspot(pub, "rug").effect = effect;
    assertEquals(checkPuzzle(pub, sol), [], effect);
  }
  for (const effect of ["scream", "", null, ["cold"], "COLD"]) {
    const { pub, sol } = fresh();
    hotspot(pub, "rug").effect = effect;
    has(checkPuzzle(pub, sol), "hotspot rug has an unknown effect");
  }
});

/** A crime-scene room built by the generator (fallback prose), and handles on its accusation. */
function crimeScene() {
  const spec = CRIME_SCENE_TEMPLATES[0];   // broken_alibi: find_timeline, find_key, open_lock, find_trace, accuse
  const fit = assignRoles(spec, FAKE_OBJECTS)!;
  const room = compileTemplate(spec, fit.assignment, [], { randomInt: seededRandomInt(5) });
  const built = assembleDefinition(room, null, ["a", "b", "c"]);
  const pub = structuredClone(built.publicDefinition) as Json;
  const sol = structuredClone(built.solution) as Json;
  const accuse = puzzle(pub, "accuse");
  const secret = sol.puzzles.accuse;
  const item = (id: string) => pub.items.find((i: Json) => i.id === id);
  const right = (list: string, dimension: string) => accuse[list].find((o: Json) => o.id === secret.answer[dimension]);
  const wrong = (list: string, dimension: string) => accuse[list].find((o: Json) => o.id !== secret.answer[dimension]);
  return { pub, sol, accuse, secret, item, right, wrong };
}

Deno.test("accuse: a generated crime-scene room passes, with no hotspot on the accusation", () => {
  const { pub, sol, accuse } = crimeScene();
  assertEquals(checkPuzzle(pub, sol), []);
  assertEquals(checkPuzzle(pub, sol, { photoIds: ["a", "b", "c"], generation: true }), []);
  assertEquals(accuse.hotspot_id, undefined);
  assertEquals(accuse.kind, "accuse");
});

Deno.test("accuse: deducibility waits for the evidence, like clue coverage", () => {
  // The accusation listed first is still attemptable only once its requires are solved.
  const { pub, sol } = crimeScene();
  pub.puzzles = [puzzle(pub, "accuse"), ...pub.puzzles.filter((p: Json) => p.id !== "accuse")];
  assertEquals(checkPuzzle(pub, sol), []);
});

Deno.test("negative: an accusation the evidence cannot settle", () => {
  const cases: Array<[string, (c: ReturnType<typeof crimeScene>) => void]> = [
    ["evidence omits the culprit", (c) => {
      c.item(c.secret.evidence.suspect).description = "Pencilled times, one underlined.";
    }],
    ["evidence names two suspects", (c) => {
      c.item(c.secret.evidence.suspect).description += ` ${c.wrong("suspects", "suspect").name} was seen too.`;
    }],
    ["evidence names a wrong motive instead", (c) => {
      c.item(c.secret.evidence.motive).description = `It gives the reason: ${c.wrong("motives", "motive").name}.`;
    }],
    ["the answer is not what the evidence shows", (c) => {
      c.secret.answer.method = c.wrong("methods", "method").id;
    }],
    ["the evidence is consumed before accusing", (c) => {
      c.sol.puzzles.find_trace.rewards.consume_items = [c.secret.evidence.suspect];
    }],
    ["the evidence is never granted", (c) => {
      c.sol.puzzles.open_lock.rewards.items = [];
    }],
  ];
  for (const [name, mutate] of cases) {
    const c = crimeScene();
    mutate(c);
    const errors = checkPuzzle(c.pub, c.sol);
    has(errors, "accusation accuse cannot be worked out from the clues");
    has(errors, "puzzle accuse can never be solved");
    has(errors, "exit puzzle accuse is not reachable");
    assert(errors.length >= 3, name);
  }
});

Deno.test("negative: malformed accusation options and secrets", () => {
  const cases: Array<[string, (c: ReturnType<typeof crimeScene>) => void]> = [
    ["accuse puzzle accuse needs exactly 3 suspects", (c) => c.accuse.suspects.pop()],
    ["accuse puzzle accuse needs exactly 3 methods", (c) => delete c.accuse.methods],
    ["accuse puzzle accuse has an invalid option id: S Ivy", (c) => (c.accuse.suspects[0].id = "S Ivy")],
    ["duplicate option id: ", (c) => (c.accuse.motives[0].id = c.pub.items[0].id)],
    ["duplicate option id: ", (c) => (c.accuse.methods[1].id = c.accuse.suspects[0].id)],
    ["needs a name of 1-60 characters", (c) => (c.accuse.motives[2].name = "")],
    ["needs a name of 1-60 characters", (c) => (c.accuse.motives[2].name = "   ")],
    ["needs a name of 1-60 characters", (c) => (c.accuse.suspects[1].name = "x".repeat(61))],
    ["needs a name of 1-60 characters", (c) => (c.accuse.methods[0].name = 7)],
    ["needs a role of 1-60 characters", (c) => delete c.accuse.suspects[0].role],
    ["needs an alibi of 1-200 characters", (c) => (c.accuse.suspects[2].alibi = "y".repeat(201))],
    ["accuse puzzle accuse: motive names must be distinct and none may contain another", (c) => {
      c.accuse.motives[1].name = `${c.accuse.motives[0].name.slice(0, 6)}`;
    }],
    ["accuse puzzle accuse: suspect names must be distinct and none may contain another", (c) => {
      c.accuse.suspects[1].name = c.accuse.suspects[0].name.toUpperCase();
    }],
    ["accuse puzzle accuse: answer.suspect must be one of its suspects", (c) => (c.secret.answer.suspect = "s_nobody")],
    ["accuse puzzle accuse: answer.method must be one of its methods", (c) => delete c.secret.answer],
    ["accuse puzzle accuse: evidence.motive references unknown item", (c) => (c.secret.evidence.motive = "nope")],
    ["accuse puzzle accuse: evidence.suspect references unknown item", (c) => delete c.secret.evidence],
  ];
  for (const [fragment, mutate] of cases) {
    const c = crimeScene();
    mutate(c);
    has(checkPuzzle(c.pub, c.sol), fragment);
  }
});

Deno.test("negative: evidence is a solution-only key", () => {
  const { pub, sol, secret } = crimeScene();
  puzzle(pub, "accuse").evidence = secret.evidence;
  has(checkPuzzle(pub, sol), "public definition contains solution-only keys (answer/rewards/inputs/solution/hints)");
});

Deno.test("generation contract: an accusation's answer stays in its evidence", () => {
  const leaks: Array<[string, (c: ReturnType<typeof crimeScene>) => void]> = [
    ["title", (c) => (c.pub.title = `The Case of ${c.right("suspects", "suspect").name}`)],
    ["intro", (c) => (c.pub.intro = `It began with ${c.right("motives", "motive").name.toLowerCase()}.`)],
    ["exit.message", (c) => (c.pub.exit.message = `${c.right("suspects", "suspect").name} did it.`)],
    ["hotspot $h.description", (c) => (c.pub.hotspots[0].description = `It smells of ${c.right("methods", "method").name}.`)],
    ["puzzle accuse.prompt", (c) => (c.accuse.prompt = `Was it ${c.right("suspects", "suspect").name}?`)],
    ["item $i.name", (c) => (c.pub.items.find((i: Json) => !Object.values(c.secret.evidence).includes(i.id)).name =
      `${c.right("suspects", "suspect").name}'s key`)],
  ];
  for (const [where, mutate] of leaks) {
    const c = crimeScene();
    mutate(c);
    const plain = c.pub.items.find((i: Json) => !Object.values(c.secret.evidence).includes(i.id));
    const at = where.replace("$h", c.pub.hotspots[0].id).replace("$i", plain.id);
    has(checkPuzzle(c.pub, c.sol, { generation: true }), `accusation accuse answer appears in public text outside the evidence (${at})`);
    assertEquals(checkPuzzle(c.pub, c.sol), [], "a generator rule, not the SQL validator's");
  }

  // A list of all three singles nobody out; the options, the evidence, solved messages and hints may name the answer.
  const c = crimeScene();
  c.pub.intro = `Three guests: ${c.accuse.suspects.map((o: Json) => o.name).join(", ")}.`;
  c.secret.message = `${c.right("suspects", "suspect").name} is led away.`;
  c.secret.hints[1] = `Think about ${c.right("methods", "method").name}.`;
  assertEquals(checkPuzzle(c.pub, c.sol, { generation: true }), []);
  delete c.secret.hints;
  has(checkPuzzle(c.pub, c.sol, { generation: true }), "puzzle accuse needs exactly 3 hint strings");
});

Deno.test("generation contract: the evidence names no wrong option of any list", () => {
  const c = crimeScene();
  // The motive's evidence blames a wrong suspect: deducible per list (the SQL rule), but it contradicts the answer.
  c.item(c.secret.evidence.motive).description += ` ${c.wrong("suspects", "suspect").name} wrote it.`;
  c.item(c.secret.evidence.method).name = `${c.wrong("motives", "motive").name} papers`;
  assertEquals(checkPuzzle(c.pub, c.sol), []);
  const errors = checkPuzzle(c.pub, c.sol, { generation: true });
  has(errors, `accusation accuse evidence names a wrong option (item ${c.secret.evidence.motive}.description)`);
  has(errors, `accusation accuse evidence names a wrong option (item ${c.secret.evidence.method}.name)`);
});

Deno.test("namesDistinct and provesOption follow normalize_answer", () => {
  assert(namesDistinct(["Ivy Marsh", "Tobias Reed", "Clara Finch"]));
  assert(!namesDistinct(["Ivy Marsh", "ivy-marsh", "Clara Finch"]));
  assert(!namesDistinct(["Ivy", "Ivy Marsh", "Clara Finch"]));
  assert(!namesDistinct(["--", "Tobias Reed", "Clara Finch"]));
  assert(provesOption("Seen at 9: IVY MARSH, not home.", "Ivy Marsh", ["Tobias Reed", "Clara Finch"]));
  assert(!provesOption("Seen at 9: Ivy Marsh and Tobias Reed.", "Ivy Marsh", ["Tobias Reed", "Clara Finch"]));
  assert(!provesOption("Nobody in particular.", "Ivy Marsh", ["Tobias Reed"]));
  assert(!provesOption("Anything at all.", "", []));
  assert(namesAny("Tobias-Reed's coat.", ["Ivy Marsh", "Tobias Reed"]));
  assert(!namesAny("A coat.", ["Ivy Marsh", "", "Tobias Reed"]));
  const suspects = { right: "Ivy Marsh", names: ["Ivy Marsh", "Tobias Reed", "Clara Finch"] };
  assert(revealsAnswer("Everyone suspects IVY MARSH.", [suspects]));
  assert(revealsAnswer("Ivy Marsh and Tobias Reed argued.", [suspects]));
  assert(!revealsAnswer("Ivy Marsh, Tobias Reed and Clara Finch were here.", [suspects]));
  assert(!revealsAnswer("Tobias Reed was here.", [suspects]), "a wrong option gives nothing away");
});
