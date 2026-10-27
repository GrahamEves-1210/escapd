// Inventories for v2 tests: hand-written rooms and a seeded synthetic generator.
import type { Box1000 } from "../geometry.ts";
import { ARCHETYPES } from "./archetypes.ts";
import { type PlanResult, seededRandom, STEP_BAND } from "./planner.ts";
import { categoryOf, type Feature, type InventoryObject, isPortableType, type ObjectType } from "./taxonomy.ts";
import type { Mode } from "./types.ts";
import { validateDefinition } from "./validate.ts";

/** Deterministic RandomInt for minting in tests. */
export function seededRandomInt(seed = 42): (max: number) => number {
  let s = seed >>> 0;
  return (max: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return Math.floor((s / 4294967296) * max);
  };
}

/** What perception would typically report for each type. */
export const TYPICAL_FEATURES: Partial<Record<ObjectType, Feature[]>> = {
  desk: ["has_drawers", "holds_items"], nightstand: ["has_drawers", "holds_items"], dresser: ["has_drawers"],
  wardrobe: ["has_doors", "can_open"], cabinet: ["has_doors", "can_open"], sideboard: ["has_doors", "has_drawers"],
  filing_cabinet: ["has_drawers"], bookshelf: ["has_pages", "holds_items"], chest: ["can_open", "holds_items"],
  trunk: ["can_open", "holds_items"], box: ["can_open", "can_lift", "holds_items"], suitcase: ["can_open"],
  pillow: ["can_lift"], cushion: ["can_lift"], rug: ["can_lift"], blanket: ["can_lift"], plant_pot: ["can_lift"],
  vase: ["can_lift"], book: ["has_pages", "can_lift"], book_stack: ["has_pages", "can_lift"], notebook: ["has_pages", "can_lift"],
  framed_picture: ["wall_mounted"], poster: ["wall_mounted"], mirror: ["wall_mounted", "reflective"], calendar: ["wall_mounted"],
  map: ["wall_mounted"], noticeboard: ["wall_mounted"], wall_clock: ["has_hands", "wall_mounted"], alarm_clock: ["has_hands", "can_lift"],
  desk_lamp: ["light_source"], floor_lamp: ["light_source"], string_lights: ["light_source"], radio: ["has_dial"],
  record_player: ["has_dial"], guitar: ["has_strings"], keyboard_instrument: ["has_keys"], door: ["is_door", "can_open"],
  mug: ["can_lift"], trophy: ["can_lift"], figurine: ["can_lift"], jar: ["can_open", "can_lift"], basket: ["can_lift", "holds_items"],
};

let n = 0;
export function obj(type: ObjectType, photo: number, extra: Partial<InventoryObject> = {}): InventoryObject {
  const box: Box1000 = [200 + (n * 37) % 300, 100 + (n * 53) % 500, 420 + (n * 37) % 300, 260 + (n * 53) % 500];
  n++;
  return {
    id: `p${photo}_${n}`, label: type.replace(/_/g, " "), type, features: TYPICAL_FEATURES[type] ?? [],
    box, photo_index: photo, salience: 0.6, fully_visible: true, ...extra,
  };
}

/** The design doc's example bedroom (§4), plus its door. */
export const BEDROOM_WITH_DOOR: InventoryObject[] = [
  obj("wall_clock", 0, { salience: 0.8 }), obj("desk", 0, { salience: 0.9 }), obj("desk_lamp", 0, { salience: 0.6 }),
  obj("bookshelf", 1, { salience: 0.8 }), obj("poster", 1, { label: "framed film poster", salience: 0.7 }),
  obj("bed", 2, { salience: 0.9 }), obj("pillow", 2, { salience: 0.5 }), obj("wardrobe", 3, { salience: 0.9 }),
  obj("guitar", 3, { salience: 0.6 }), obj("plant_pot", 4, { label: "snake plant", salience: 0.5 }),
  obj("speaker", 4, { salience: 0.5 }), obj("rug", 2, { salience: 0.4, fully_visible: false }),
  obj("door", 4, { salience: 0.7, fully_visible: false }),
];
export const BEDROOM_NO_DOOR = BEDROOM_WITH_DOOR.filter((o) => o.type !== "door");

export const SPARSE_5: InventoryObject[] = [
  obj("door", 0, { salience: 0.7 }), obj("desk", 1, { salience: 0.8 }), obj("pillow", 2, { salience: 0.5 }),
  obj("poster", 3, { salience: 0.6 }), obj("desk_lamp", 1, { salience: 0.6 }),
];

export const FULL_15: InventoryObject[] = [
  obj("door", 0), obj("wall_clock", 0, { salience: 0.8 }), obj("desk", 0, { salience: 0.9 }), obj("desk_lamp", 0),
  obj("bookshelf", 1, { salience: 0.8 }), obj("framed_picture", 1), obj("radio", 1), obj("dresser", 2, { salience: 0.8 }),
  obj("mirror", 2), obj("cushion", 2, { salience: 0.4 }), obj("chest", 3), obj("rug", 3, { salience: 0.4 }),
  obj("book", 3, { salience: 0.4 }), obj("floor_lamp", 4), obj("mug", 4, { salience: 0.35 }),
];

const COMMON: ObjectType[] = [
  "desk", "nightstand", "dresser", "wardrobe", "cabinet", "bookshelf", "shelf", "bed", "sofa", "chair", "armchair",
  "table", "chest", "box", "basket", "pillow", "cushion", "rug", "curtain", "blanket", "framed_picture", "poster",
  "mirror", "wall_clock", "calendar", "desk_lamp", "floor_lamp", "radio", "speaker", "record_player", "guitar",
  "plant_pot", "potted_plant", "vase", "book", "book_stack", "notebook", "mug", "trophy", "alarm_clock", "fan", "other",
];

/** A seeded synthetic room: `count` objects over 5 photos; a door with probability `doorRate`. */
export function syntheticInventory(seed: number, count: number, doorRate = 0.8): InventoryObject[] {
  const rng = seededRandom(`inv:${seed}`);
  const out: InventoryObject[] = [];
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  for (let i = 0; i < count; i++) {
    const type = pick(COMMON);
    const features = (TYPICAL_FEATURES[type] ?? []).filter(() => rng() > 0.1);   // perception misses ~10%
    const y = Math.floor(rng() * 600), x = Math.floor(rng() * 700);
    out.push({
      id: `s${seed}_${i}`, label: type.replace(/_/g, " "), type, features,
      box: [y, x, y + 80 + Math.floor(rng() * 300), x + 60 + Math.floor(rng() * 250)],
      photo_index: Math.floor(rng() * 5), salience: Math.round((0.1 + rng() * 0.9) * 100) / 100, fully_visible: rng() > 0.15,
    });
  }
  if (rng() < doorRate) out.push({ id: `s${seed}_door`, label: "door", type: "door", features: ["is_door", "can_open"], box: [100, 400, 900, 700], photo_index: Math.floor(rng() * 5), salience: 0.7, fully_visible: rng() > 0.5 });
  return out;
}

const FINALE: Record<Mode, string> = { noir: "combination", crime_scene: "accusation", paranormal: "ritual" };

/** Every invariant a planned room must hold. Returns the problems found (empty: good). */
export function planProblems(r: PlanResult, mode: Mode): string[] {
  if (!r.ok) return [`not ok: ${r.reason} ${r.detail}`];
  const p: string[] = [];
  const { definition: def, secret, report, summary } = r;
  p.push(...validateDefinition(def, secret));
  if (!report.ok) p.push(...report.errors);
  const m = report.metrics;
  if (m.requiredSteps < STEP_BAND.min || m.requiredSteps > STEP_BAND.max) p.push(`steps ${m.requiredSteps}`);
  if (m.revisits < 1) p.push("no revisit");
  if (m.roomChanges < 1) p.push("no room change");
  if (summary.threads < 2 || summary.threads > 3) p.push(`threads ${summary.threads}`);
  const threads = new Set(secret.steps.filter((s) => s.thread !== null).map((s) => s.thread));
  if (threads.size !== summary.threads) p.push(`steps span ${threads.size} threads, summary says ${summary.threads}`);
  if (secret.steps.filter((s) => s.motif === "contain_lock").length > 1) p.push("more than one contain-lock");
  if (def.finale.kind !== FINALE[mode]) p.push(`finale ${def.finale.kind}`);
  // An object in at most two roles: steps acted on it plus ritual membership.
  const roles = new Map<string, number>();
  for (const s of secret.steps) if (s.object && s.object !== def.finale.object) roles.set(s.object, (roles.get(s.object) ?? 0) + 1);
  for (const v of Object.values(secret.slots)) if (v.kind === "object") roles.set(v.value, (roles.get(v.value) ?? 0) + 1);
  for (const [id, n] of roles) if (n > 2) p.push(`${id} has ${n} roles`);
  const removable = def.objects.filter((o) => o.removable);
  if (removable.length > 1) p.push("several removable objects");
  for (const o of removable) if (!isPortableType(o.type) || categoryOf(o.type) === "textile") p.push(`removable ${o.type}`);
  // Story props only ever come out of an object that can hold them (or are assembled / taken).
  for (const rule of secret.rules) for (const e of rule.effects) {
    if (e.do !== "grant") continue;
    const t = rule.trigger;
    const host = def.objects.find((o) => ("object" in t && o.id === t.object) || (t.on === "control" && o.id === t.target));
    if (t.on !== "combine" && !host?.removable && !(host?.archetype && ARCHETYPES[host.archetype].holdsItems)) p.push(`${e.item} appears from nowhere`);
  }
  // No answer in the public cards.
  const cards = JSON.stringify(def.cards);
  for (const [name, v] of Object.entries(secret.slots)) {
    const shown = v.text ?? v.value;
    if (["time", "freq", "cipher", "code"].includes(v.kind) && shown.length >= 3 && cards.includes(shown)) p.push(`card text leaks {{${name}}}`);
  }
  return p;
}
