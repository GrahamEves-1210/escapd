import { assert, assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert@1";
import { ACCUSE_DIMENSIONS, GENRES, HOTSPOT_EFFECTS } from "./contract.ts";
import { assembleDefinition } from "./prose.ts";
import { checkPuzzle, ID_RE, OPTION_LISTS, provesOption } from "./puzzle-check.ts";
import { AFFORDANCES } from "./schemas.ts";
import {
  assignRoles,
  compileTemplate,
  CRIME_SCENE_TEMPLATES,
  genreOf,
  isWeakCode,
  MAX_HERRINGS,
  mintCode,
  PARANORMAL_TEMPLATES,
  selectAndCompile,
  slugId,
  type TemplateSpec,
  TEMPLATES,
  TEMPLATES_BY_GENRE,
  validateTemplateSpec,
} from "./templates.ts";
import { FAKE_OBJECTS, fakeObject, seededRandomInt } from "./test_fixtures.ts";

const PHOTO_IDS = ["photo-a", "photo-b", "photo-c"];

type Json = Record<string, unknown>;
type Option = { id: string; name: string; role?: string; alibi?: string };

/** Compiles a template on the fake object set with up to two herrings, then assembles it with fallback prose. */
function build(spec: TemplateSpec, seed = spec.name.length) {
  const fit = assignRoles(spec, FAKE_OBJECTS);
  assert(fit, `${spec.name}: roles should fit the fake object set`);
  const used = new Set([...fit.assignment.values()].map((o) => o.id));
  assertEquals(used.size, spec.roles.length, `${spec.name}: one distinct object per role`);
  const herrings = FAKE_OBJECTS.filter((o) => !used.has(o.id)).slice(0, MAX_HERRINGS);
  const room = compileTemplate(spec, fit.assignment, herrings, { randomInt: seededRandomInt(seed) });
  return { room, ...assembleDefinition(room, null, PHOTO_IDS) };
}

Deno.test("at least six templates, each structurally sound", () => {
  assert(TEMPLATES.length >= 6);
  assertEquals(new Set(TEMPLATES.map((t) => t.name)).size, TEMPLATES.length);
  for (const t of TEMPLATES) assertEquals(validateTemplateSpec(t), [], t.name);
});

Deno.test("every template compiles to a definition that passes puzzle-check", () => {
  for (const spec of TEMPLATES) {
    const fit = assignRoles(spec, FAKE_OBJECTS);
    assert(fit, `${spec.name}: roles should fit the fake object set`);
    const used = new Set([...fit.assignment.values()].map((o) => o.id));
    assertEquals(used.size, spec.roles.length, `${spec.name}: one distinct object per role`);
    const herrings = FAKE_OBJECTS.filter((o) => !used.has(o.id)).slice(0, MAX_HERRINGS);
    const room = compileTemplate(spec, fit.assignment, herrings, { randomInt: seededRandomInt(spec.name.length) });
    const { publicDefinition, solution } = assembleDefinition(room, null, PHOTO_IDS);

    assertEquals(checkPuzzle(publicDefinition, solution, { photoIds: PHOTO_IDS, generation: true }), [], spec.name);

    const required = room.puzzles.filter((p) => !p.herring);
    assert(required.length >= 4 && required.length <= 6, `${spec.name}: 4-6 required steps`);
    const exit = room.puzzles.find((p) => p.id === room.exitPuzzleId)!;
    assert(exit.kind === "inspect" || exit.kind === "code", `${spec.name}: exit is an inspect or code`);
    // herrings: at most two, last in the array (hints target the first attemptable puzzle), grant nothing
    const herringIdx = room.puzzles.map((p, i) => (p.herring ? i : -1)).filter((i) => i >= 0);
    assert(herringIdx.length <= MAX_HERRINGS);
    assert(herringIdx.every((i) => i >= required.length), `${spec.name}: herrings come last`);
    for (const h of room.puzzles.filter((p) => p.herring)) {
      assertEquals(h.rewards, { items: [], consume_items: [], reveal_hotspots: [] });
    }
    // minted ids and code
    for (const id of [...room.items.map((i) => i.id), ...room.hotspots.map((h) => h.id), ...room.puzzles.map((p) => p.id)]) {
      assertMatch(id, ID_RE);
    }
    assertMatch(room.code, /^\d{4}$/);
    const codePuzzle = room.puzzles.find((p) => p.kind === "code")!;
    const clue = (publicDefinition.items as Array<{ id: string; description: string }>).find((i) => i.id === codePuzzle.clueItemId)!;
    assert(clue.description.includes(room.code), `${spec.name}: clue item carries the literal`);
    assertEquals((publicDefinition.puzzles as Array<Record<string, unknown>>).find((p) => p.id === codePuzzle.id)!.answer_format,
      { kind: "digits", length: 4 });
  }
});

Deno.test("the universal template fits any four objects, whatever their affordance", () => {
  for (const affordance of AFFORDANCES) {
    const objects = [0, 1, 2, 3].map((i) => fakeObject(`o${i}`, `thing ${i}`, affordance, i % 3));
    const room = selectAndCompile(objects, { random: () => 0.5, randomInt: seededRandomInt(1) });
    assert(room, affordance);
    const { publicDefinition, solution } = assembleDefinition(room, null, PHOTO_IDS);
    assertEquals(checkPuzzle(publicDefinition, solution, { photoIds: PHOTO_IDS, generation: true }), [], affordance);
  }
});

Deno.test("fewer objects than roles: no template fits", () => {
  assertEquals(selectAndCompile(FAKE_OBJECTS.slice(0, 3), { random: () => 0 }), null);
});

Deno.test("role assignment prefers spread across photos and kinds of object", () => {
  const fit = assignRoles(TEMPLATES.find((t) => t.name === "cabinet_keypad")!, FAKE_OBJECTS)!;
  const chosen = [...fit.assignment.values()];
  assert(new Set(chosen.map((o) => o.photoIndex)).size >= 2);
  assert(new Set(chosen.map((o) => o.affordance)).size >= 3);
});

Deno.test("selection covers several templates across random draws", () => {
  const names = new Set<string>();
  for (let i = 0; i < 40; i++) {
    names.add(selectAndCompile(FAKE_OBJECTS, { random: () => i / 40, randomInt: seededRandomInt(i) })!.template);
  }
  assert(names.size >= 4, [...names].join(","));
});

Deno.test("codes: four digits, never trivially guessable", () => {
  for (const weak of ["0000", "7777", "1234", "6789", "9876", "3210"]) assert(isWeakCode(weak), weak);
  for (const fine of ["0427", "5150", "1243"]) assert(!isWeakCode(fine), fine);
  for (let i = 0; i < 500; i++) {
    const code = mintCode();
    assertMatch(code, /^\d{4}$/);
    assert(!isWeakCode(code));
  }
  // deterministic source: a weak draw is rejected and the next one is used
  const draws = [1234, 427];
  assertEquals(mintCode(() => draws.shift()!), "0427");
});

Deno.test("item ids are minted per room", () => {
  const spec = TEMPLATES[0];
  const fit = assignRoles(spec, FAKE_OBJECTS)!;
  const a = compileTemplate(spec, fit.assignment);
  const b = compileTemplate(spec, fit.assignment);
  assertNotEquals(a.items.map((i) => i.id).join(), b.items.map((i) => i.id).join());
});

Deno.test("slugId produces unique schema-v1 ids", () => {
  const taken = new Set<string>();
  assertEquals(slugId("Desk Lamp", taken), "desk_lamp");
  assertEquals(slugId("desk lamp", taken), "desk_lamp_2");
  assertEquals(slugId("--", taken), "object");
  assertMatch(slugId("x".repeat(90), taken), ID_RE);
});

// ---------------------------------------------------------------------------
// Genres
// ---------------------------------------------------------------------------
Deno.test("per genre: at least three templates, each sound under its genre's rules", () => {
  assertEquals(TEMPLATES_BY_GENRE.noir, TEMPLATES);
  const names = GENRES.flatMap((g) => TEMPLATES_BY_GENRE[g].map((t) => t.name));
  assertEquals(new Set(names).size, names.length, "template names are unique across genres");
  for (const genre of GENRES) {
    const list = TEMPLATES_BY_GENRE[genre];
    assert(list.length >= 3, genre);
    for (const t of list) {
      assertEquals(genreOf(t), genre);
      assertEquals(validateTemplateSpec(t, genre), [], `${genre}/${t.name}`);
    }
  }
});

Deno.test("every genre's templates compile to definitions that pass puzzle-check", () => {
  for (const genre of GENRES) {
    for (const spec of TEMPLATES_BY_GENRE[genre]) {
      const { room, publicDefinition, solution } = build(spec);
      const label = `${genre}/${spec.name}`;
      assertEquals(checkPuzzle(publicDefinition, solution, { photoIds: PHOTO_IDS, generation: true }), [], label);
      assertEquals(room.genre, genre);
      assertEquals(publicDefinition.genre, genre, label);

      const required = room.puzzles.filter((p) => !p.herring);
      assert(required.length >= 4 && required.length <= 6, `${label}: 4-6 required steps`);
      assertEquals(room.exitPuzzleId, required[required.length - 1].id, `${label}: the exit is the last required step`);
      assert(room.puzzles.every((p, i) => !p.herring || i >= required.length), `${label}: herrings come last`);
      for (const id of [...room.items.map((i) => i.id), ...room.hotspots.map((h) => h.id), ...room.puzzles.map((p) => p.id)]) {
        assertMatch(id, ID_RE);
      }
      for (const h of publicDefinition.hotspots as Json[]) {
        if ("effect" in h) assert((HOTSPOT_EFFECTS as readonly unknown[]).includes(h.effect), label);
      }
    }
  }
});

Deno.test("crime scene: one accusation, the exit, deducible from three evidence items that are never consumed", () => {
  for (const spec of CRIME_SCENE_TEMPLATES) {
    const { room, publicDefinition, solution } = build(spec);
    const label = spec.name;
    const accusations = room.puzzles.filter((p) => p.kind === "accuse");
    assertEquals(accusations.length, 1, label);
    const accuse = accusations[0];
    assertEquals(room.exitPuzzleId, accuse.id, label);

    // Evidence: three different items, each granted exactly once by a step the accusation requires, never consumed.
    const evidence = ACCUSE_DIMENSIONS.map((d) => accuse.evidence![d]);
    assertEquals(new Set(evidence).size, 3, label);
    for (const item of evidence) {
      const givers = room.puzzles.filter((p) => p.rewards.items.includes(item));
      assertEquals(givers.length, 1, `${label}: ${item} granted once`);
      assert(accuse.requires.includes(givers[0].id), `${label}: the accusation requires ${givers[0].id}`);
      assert(!room.puzzles.some((p) => p.rewards.consume_items.includes(item)), `${label}: ${item} never consumed`);
    }

    // Public options: 3 per list, minted ids unique across the definition; the answer is secret.
    const pub = (publicDefinition.puzzles as Json[]).find((p) => p.id === accuse.id)!;
    assertEquals(pub.hotspot_id, undefined);
    const definitionIds = [
      ...(publicDefinition.items as Json[]).map((i) => i.id),
      ...(publicDefinition.hotspots as Json[]).map((h) => h.id),
      ...(publicDefinition.puzzles as Json[]).map((p) => p.id),
    ];
    const optionIds = ACCUSE_DIMENSIONS.flatMap((d) => (pub[OPTION_LISTS[d]] as Option[]).map((o) => o.id));
    assertEquals(optionIds.length, 9);
    assertEquals(new Set([...definitionIds, ...optionIds]).size, definitionIds.length + 9, `${label}: option ids unique`);
    for (const id of optionIds) assertMatch(id, ID_RE);
    const secret = (solution as { puzzles: Record<string, Json> }).puzzles[accuse.id];
    assertEquals(secret.answer, accuse.accusation);
    assertEquals(secret.evidence, accuse.evidence);
    assert(!JSON.stringify(publicDefinition).includes('"evidence"'));

    // Each evidence description names the right option and neither of the others (fallback prose here).
    for (const d of ACCUSE_DIMENSIONS) {
      const options = pub[OPTION_LISTS[d]] as Option[];
      const right = options.find((o) => o.id === accuse.accusation![d])!;
      const item = (publicDefinition.items as Json[]).find((i) => i.id === accuse.evidence![d])!;
      assert(provesOption(String(item.description), right.name, options.filter((o) => o !== right).map((o) => o.name)), `${label}: ${d}`);
    }
  }
});

Deno.test("crime scene: the answer is drawn per room from the minted options", () => {
  const spec = CRIME_SCENE_TEMPLATES[0];
  const fit = assignRoles(spec, FAKE_OBJECTS)!;
  const picks = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) {
    const accuse = compileTemplate(spec, fit.assignment, [], { randomInt: seededRandomInt(seed) }).puzzles.find((p) => p.kind === "accuse")!;
    for (const d of ACCUSE_DIMENSIONS) {
      assertEquals(accuse.options![d].length, 3);
      assert(accuse.options![d].includes(accuse.accusation![d]));
    }
    picks.add(ACCUSE_DIMENSIONS.map((d) => accuse.options![d].indexOf(accuse.accusation![d])).join(""));
  }
  assert(picks.size > 3, [...picks].join(","));
});

Deno.test("paranormal: a strict three-step banishing ends the case, and roles carry effects", () => {
  for (const spec of PARANORMAL_TEMPLATES) {
    const { room, publicDefinition } = build(spec);
    const label = spec.name;
    const [a, b, c] = room.puzzles.filter((p) => !p.herring).slice(-3);
    assert([a, b, c].every((p) => p.kind === "inspect" || p.kind === "use_item"), label);
    assert(b.requires.includes(a.id) && c.requires.includes(b.id), `${label}: each step requires the one before`);
    assertEquals(c.kind, "inspect", label);
    assertEquals(room.exitPuzzleId, c.id, label);
    assert(room.puzzles.every((p) => p.kind !== "code" && p.kind !== "accuse"), `${label}: no code or accusation`);
    const effects = (publicDefinition.hotspots as Json[]).filter((h) => "effect" in h);
    assert(effects.length >= 1, label);
    // effects come from the template roles only (never on herrings)
    for (const h of room.hotspots) assertEquals(h.effect, spec.roles.find((r) => r.key === h.role)?.effect, `${label}: ${h.id}`);
  }
});

Deno.test("paranormal: the candle is set down, never lit at one of the player's real objects", () => {
  for (const spec of PARANORMAL_TEMPLATES) {
    const words = [spec.summary, ...spec.roles.map((r) => r.purpose), ...spec.items.map((i) => i.purpose), ...spec.steps.map((s) => s.key)];
    for (const text of words) assert(!/\blit\b|\blight(ed|ing|s)?\b|\blight_/i.test(text), `${spec.name}: ${text}`);
  }
});

Deno.test("per genre: the universal template fits any four objects, whatever their affordance", () => {
  for (const genre of GENRES) {
    for (const affordance of AFFORDANCES) {
      const objects = [0, 1, 2, 3].map((i) => fakeObject(`o${i}`, `thing ${i}`, affordance, i % 3));
      const room = selectAndCompile(objects, { random: () => 0.5, randomInt: seededRandomInt(1), templates: TEMPLATES_BY_GENRE[genre] });
      assert(room, `${genre}/${affordance}`);
      assertEquals(room.genre, genre);
      const { publicDefinition, solution } = assembleDefinition(room, null, PHOTO_IDS);
      assertEquals(checkPuzzle(publicDefinition, solution, { photoIds: PHOTO_IDS, generation: true }), [], `${genre}/${affordance}`);
    }
  }
});

Deno.test("per genre: selection covers every template across random draws", () => {
  for (const genre of ["crime_scene", "paranormal"] as const) {
    const names = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const templates = TEMPLATES_BY_GENRE[genre];
      names.add(selectAndCompile(FAKE_OBJECTS, { random: () => i / 40, randomInt: seededRandomInt(i), templates })!.template);
    }
    assertEquals(names.size, TEMPLATES_BY_GENRE[genre].length, `${genre}: ${[...names].join(",")}`);
  }
});

Deno.test("template invariants: broken accusations and banishings are caught", () => {
  const crime = CRIME_SCENE_TEMPLATES[0];
  const withSteps = (spec: TemplateSpec, steps: TemplateSpec["steps"]): TemplateSpec => ({ ...spec, steps });
  const has = (errors: string[], fragment: string) =>
    assert(errors.some((e) => e.includes(fragment)), `expected "${fragment}" in ${JSON.stringify(errors)}`);

  // evidence consumed by a use_item before the accusation
  const consumed = withSteps(crime, crime.steps.map((s) => (s.key === "open_lock" ? { ...s, item: "alibi_evidence" } : s)));
  has(validateTemplateSpec(consumed, "crime_scene"), "evidence alibi_evidence must never be consumed");

  // the accusation does not wait for one of its evidence steps
  const early = withSteps(crime, crime.steps.map((s) => (s.kind === "accuse" ? { ...s, requires: ["find_timeline", "open_lock"] } : s)));
  has(validateTemplateSpec(early, "crime_scene"), "must require the step granting its method evidence");

  // the accusation is not the exit
  has(validateTemplateSpec({ ...crime, exit: "find_trace" }, "crime_scene"), "an accusation must be the exit");
  has(validateTemplateSpec({ ...crime, exit: "find_trace" }, "crime_scene"), "a crime-scene case ends in exactly one accusation");

  // two dimensions proved by the same item
  const shared = withSteps(crime, crime.steps.map((s) =>
    s.kind === "accuse" ? { ...s, evidence: { ...s.evidence!, method: "alibi_evidence" } } : s
  ));
  has(validateTemplateSpec(shared, "crime_scene"), "needs a different evidence item per dimension");

  // a noir template is not a crime-scene case
  has(validateTemplateSpec(TEMPLATES[0], "crime_scene"), "a crime-scene case ends in exactly one accusation");

  const ghost = PARANORMAL_TEMPLATES[0];
  // the chain is broken when the last step stops requiring the one before it
  const loose = withSteps(ghost, ghost.steps.map((s) => (s.key === ghost.exit ? { ...s, requires: [] } : s)));
  has(validateTemplateSpec(loose, "paranormal"), "the last three steps must form a strict chain");
  // a code finale is not a banishing
  has(validateTemplateSpec(TEMPLATES[0], "paranormal"), "the banishing uses only inspect and use_item steps");
  // effects come from the closed list
  const odd = { ...ghost, roles: ghost.roles.map((r, i) => (i === 0 ? { ...r, effect: "scream" as never } : r)) };
  has(validateTemplateSpec(odd, "paranormal"), "role candle_spot has an unknown effect");
  const plain = { ...ghost, roles: ghost.roles.map(({ effect: _effect, ...r }) => r) };
  has(validateTemplateSpec(plain, "paranormal"), "a paranormal case needs at least one role with an effect");
});
