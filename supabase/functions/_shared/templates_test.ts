import { assert, assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert@1";
import { assembleDefinition } from "./prose.ts";
import { checkPuzzle, ID_RE } from "./puzzle-check.ts";
import { AFFORDANCES } from "./schemas.ts";
import {
  assignRoles,
  compileTemplate,
  isWeakCode,
  MAX_HERRINGS,
  mintCode,
  selectAndCompile,
  slugId,
  TEMPLATES,
  validateTemplateSpec,
} from "./templates.ts";
import { FAKE_OBJECTS, fakeObject, seededRandomInt } from "./test_fixtures.ts";

const PHOTO_IDS = ["photo-a", "photo-b", "photo-c"];

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
