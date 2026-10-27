import { assert, assertEquals } from "jsr:@std/assert@1";
import { planRoom } from "./planner.ts";
import { BEDROOM_NO_DOOR, BEDROOM_WITH_DOOR, FULL_15, obj, planProblems, seededRandomInt, SPARSE_5 } from "./test_fixtures.ts";
import { MODES } from "./types.ts";

const ROOMS = { BEDROOM_WITH_DOOR, BEDROOM_NO_DOOR, SPARSE_5, FULL_15 };

for (const [name, inv] of Object.entries(ROOMS)) {
  for (const mode of MODES) {
    Deno.test(`planner: ${name} plans a valid ${mode} room`, () => {
      const r = planRoom(inv, { mode, seed: name, randomInt: seededRandomInt(7) });
      assertEquals(planProblems(r, mode), []);
    });
  }
}

Deno.test("planner: the exit is the real door when there is one", () => {
  for (const mode of MODES) {
    const r = planRoom(BEDROOM_WITH_DOOR, { mode, seed: "door" });   // crypto minting
    assert(r.ok);
    const exit = r.definition.objects.find((o) => o.exit)!;
    assertEquals([exit.type, exit.archetype, exit.variant], ["door", "Door", r.definition.finale.kind]);
  }
});

Deno.test("planner: no door falls back to the wardrobe", () => {
  for (const mode of MODES) {
    const r = planRoom(BEDROOM_NO_DOOR, { mode, seed: "nodoor", randomInt: seededRandomInt(3) });
    assert(r.ok);
    assertEquals(r.definition.objects.find((o) => o.exit)!.type, "wardrobe");
  }
});

Deno.test("planner: no door and nothing door-like fails with no_exit", () => {
  const inv = BEDROOM_NO_DOOR.filter((o) => o.type !== "wardrobe");
  const r = planRoom(inv, { mode: "noir", seed: "x" });
  assert(!r.ok && r.reason === "no_exit", JSON.stringify(r));
});

Deno.test("planner: a sparse room plans two threads; a bare one fails with too_few_objects", () => {
  for (const mode of MODES) {
    const r = planRoom(SPARSE_5, { mode, seed: "sparse", randomInt: seededRandomInt(5) });
    assert(r.ok);
    assertEquals(r.summary.threads, 2);
  }
  const bare = planRoom([obj("door", 0), obj("desk", 1), obj("bed", 2), obj("pillow", 3)], { mode: "noir", seed: "bare" });
  assert(!bare.ok && bare.reason === "too_few_objects" && bare.detail.length > 0, JSON.stringify(bare));
});

Deno.test("planner: the same seed and minting stream give the same room", () => {
  const a = planRoom(FULL_15, { mode: "noir", seed: "room-1", randomInt: seededRandomInt(11) });
  const b = planRoom(FULL_15, { mode: "noir", seed: "room-1", randomInt: seededRandomInt(11) });
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});

Deno.test("planner: crime scene accusation and paranormal ritual are well formed", () => {
  const crime = planRoom(FULL_15, { mode: "crime_scene", seed: "c", randomInt: seededRandomInt(2) });
  assert(crime.ok && crime.definition.finale.kind === "accusation");
  const f = crime.definition.finale;
  const answers = Object.values(crime.secret.slots).filter((s) => s.kind === "option").map((s) => s.value);
  assertEquals(answers.length, 3);
  [f.suspects, f.motives, f.methods].forEach((opts, i) => assert(opts.some((o) => o.id === answers[i])));

  const para = planRoom(FULL_15, { mode: "paranormal", seed: "p", randomInt: seededRandomInt(2) });
  assert(para.ok && para.definition.finale.kind === "ritual");
  const ritual = Object.values(para.secret.slots).filter((s) => s.kind === "object").map((s) => s.value);
  assertEquals(new Set(ritual).size, para.definition.finale.length);
  for (const id of ritual) assert(para.definition.objects.some((o) => o.id === id && !o.exit && !o.removable), id);
});

Deno.test("planner: threads spread across photos and the room keeps herrings", () => {
  const r = planRoom(BEDROOM_WITH_DOOR, { mode: "noir", seed: "spread", randomInt: seededRandomInt(9) });
  assert(r.ok);
  assert(r.summary.photos >= 3, `${r.summary.photos} photos`);
  const stepObjects = new Set(r.secret.steps.map((s) => s.object));
  assert(r.definition.objects.some((o) => !stepObjects.has(o.id) && !o.exit), "no herring");
});
