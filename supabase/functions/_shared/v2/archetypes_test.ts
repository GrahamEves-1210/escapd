import { assert, assertEquals } from "jsr:@std/assert@1";
import { ARCHETYPES, type ArchetypeId, hostableArchetypes, normalize } from "./archetypes.ts";
import { categoryOf, type Feature, OBJECT_TYPES, type ObjectType } from "./taxonomy.ts";
import { TYPICAL_FEATURES } from "./test_fixtures.ts";

const can = (type: ObjectType, features: Feature[] = TYPICAL_FEATURES[type] ?? []) =>
  new Set(hostableArchetypes({ type, features }).map((h) => h.archetype));
const ALL_FEATURES: Feature[] = [
  "has_drawers", "has_doors", "has_hands", "has_dial", "has_strings", "has_keys", "can_open", "can_lift",
  "wall_mounted", "light_source", "reflective", "has_pages", "holds_items", "is_door",
];

Deno.test("textiles host only LiftUnder, whatever perception claims", () => {
  for (const t of OBJECT_TYPES.filter((t) => categoryOf(t) === "textile")) {
    for (const a of can(t, ALL_FEATURES)) assertEquals(a, "LiftUnder", `${t} hosted ${a}`);
  }
  assert(can("pillow").has("LiftUnder"));
});

Deno.test("no lock, clock or dial on absurd hosts", () => {
  for (const t of ["pillow", "cushion", "rug", "plant_pot", "poster", "mug", "bed", "guitar"] as ObjectType[]) {
    assert(!can(t, ALL_FEATURES).has("CombinationLock"), `${t} took a lock`);
  }
  for (const t of ["mirror", "framed_picture", "desk", "speaker"] as ObjectType[]) assert(!can(t, ALL_FEATURES).has("ClockHands"), t);
  for (const t of ["guitar", "desk_lamp", "wall_clock"] as ObjectType[]) assert(!can(t, ALL_FEATURES).has("TuningDial"), t);
});

Deno.test("hosts need features, not just types", () => {
  assert(can("wall_clock").has("ClockHands"));
  assert(!can("wall_clock", ["wall_mounted"]).has("ClockHands"), "a clock perception wasn't sure has hands");
  assert(can("desk").has("Drawer") && !can("desk", []).has("Drawer"));
  assert(can("framed_picture").has("FrameTilt") && !can("framed_picture", []).has("FrameTilt"));
  assert(can("desk_lamp").has("Light") && !can("desk_lamp", []).has("Light"));
  assert(can("bookshelf").has("Readable"));
});

Deno.test("the exit: doors, else door-like furniture only", () => {
  assert(can("door").has("Door"));
  assert(can("wardrobe").has("Door") && can("cabinet").has("Door"));
  for (const t of ["desk", "chest", "box", "poster", "pillow"] as ObjectType[]) assert(!can(t, ALL_FEATURES).has("Door"), t);
});

Deno.test("inventory archetypes never attach to photo objects", () => {
  for (const t of OBJECT_TYPES) {
    const a = can(t, ALL_FEATURES);
    assert(!a.has("Assemble") && !a.has("Decoder"), t);
  }
  for (const id of ["Assemble", "Decoder"] as ArchetypeId[]) {
    assert(Object.values(ARCHETYPES[id].variants).every((v) => v.hosts === null));
  }
});

Deno.test("control domains normalize values and reject everything else", () => {
  assertEquals(normalize({ kind: "time" }, "11:40"), "11:40");
  assertEquals(normalize({ kind: "time" }, "1:05"), "1:05");
  for (const bad of ["13:00", "0:10", "11:42", "11:60", "1140", 1140]) assertEquals(normalize({ kind: "time" }, bad), null, String(bad));
  assertEquals(normalize({ kind: "freq" }, 96.3), "96.3");
  assertEquals(normalize({ kind: "freq" }, "88"), "88.0");
  for (const bad of [87.9, 108.1, 96.35, "x"]) assertEquals(normalize({ kind: "freq" }, bad), null, String(bad));
  assertEquals(normalize({ kind: "page", max: 300 }, 47), "47");
  assertEquals(normalize({ kind: "page", max: 300 }, 301), null);
  assertEquals(normalize({ kind: "wheels", alphabet: "digits", count: 4 }, ["7", "2", "9", "4"]), "7|2|9|4");
  assertEquals(normalize({ kind: "wheels", alphabet: "digits", count: 4 }, ["7", "2", "9"]), null);
  assertEquals(normalize({ kind: "wheels", alphabet: "letters", count: 3 }, ["L", "E", "O"]), "L|E|O");
  assertEquals(normalize({ kind: "wheels", alphabet: "symbols", count: 3 }, ["▲", "●", "x"]), null);
  assertEquals(normalize({ kind: "accusation" }, ["s_a", "m_b", "x_c"]), "s_a|m_b|x_c");
  assertEquals(normalize({ kind: "sequence", length: 3 }, ["a", "b|c", "d"]), null);
  assertEquals(normalize({ kind: "bool" }, "true"), null);
});
