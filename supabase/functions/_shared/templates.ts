// Hand-authored puzzle graphs (stage 7). Templates own causality; the model
// only writes prose for a graph chosen and bound here. Each template declares
// roles (which affordances may fill them) and steps that compile to the four
// schema-v1 kinds: inspect, use_item, combine, code.
//
// Rules every template follows (checked by templates_test.ts):
//   * 4-6 required steps; exit.requires is the final inspect or code.
//   * every item is granted exactly once; use_item consumes its item, combine its two inputs.
//   * a code step `requires` the step that grants its clue, and the clue is never consumed,
//     so the clue is in inventory whenever the code becomes solvable (clue coverage).
//   * one role = one distinct real object (one hotspot); hidden roles are revealed by a step.
// Code answers (4 digits) and item ids are minted here with crypto randomness.
// Up to two red-herring inspects are added on unused objects; they grant nothing,
// so a herring can never hold the last copy of a required item.
import type { VerifiedObject } from "./perception.ts";
import { AFFORDANCES, type Affordance } from "./schemas.ts";

export type ItemKind = "key" | "part" | "tool" | "lens" | "clue_full" | "clue_first" | "clue_second";

export interface RoleSpec {
  key: string;
  accepts: readonly Affordance[];   // preference order; affordances not listed cannot fill the role
  hidden?: boolean;
  purpose: string;                  // told to the prose model
}

export interface ItemSpec {
  key: string;
  kind: ItemKind;
  purpose: string;
}

export interface StepSpec {
  key: string;                      // becomes the puzzle id
  kind: "inspect" | "use_item" | "combine" | "code";
  role?: string;                    // hotspot role (every kind except combine)
  item?: string;                    // use_item: consumed
  inputs?: [string, string];        // combine: consumed
  clue?: string;                    // code: item whose description carries the answer
  grants?: string[];
  reveals?: string[];               // hidden role keys
  requires?: string[];              // step keys
}

export interface TemplateSpec {
  name: string;
  summary: string;
  roles: RoleSpec[];
  items: ItemSpec[];
  steps: StepSpec[];
  exit: string;
}

const ANY = AFFORDANCES;
const CACHE: Affordance[] = ["container_candidate", "surface", "textile", "readable_prop", "plant", "other", "instrument", "wall_hanging", "electronic"];
const LOCK: Affordance[] = ["container_candidate", "instrument", "electronic", "surface", "other", "wall_hanging"];
const KEYPAD: Affordance[] = ["container_candidate", "instrument", "electronic", "wall_hanging", "other", "surface"];
const CLUE: Affordance[] = ["readable_prop", "wall_hanging", "surface", "textile", "plant", "other", "container_candidate"];
const FINALE: Affordance[] = ["wall_hanging", "other", "plant", "container_candidate", "instrument", "surface", "readable_prop", "textile", "electronic"];

export const TEMPLATES: readonly TemplateSpec[] = [
  {
    name: "cabinet_keypad",
    summary: "A key opens a lock that exposes a hidden keypad; a written clue elsewhere gives its code.",
    roles: [
      { key: "hiding_place", accepts: CACHE, purpose: "inspecting it finds the small key" },
      { key: "note_spot", accepts: CLUE, purpose: "inspecting it finds the written clue with the code" },
      { key: "lock", accepts: LOCK, purpose: "locked; the key opens it and exposes the keypad" },
      { key: "keypad", accepts: KEYPAD, hidden: true, purpose: "a four-digit lock, hidden until the lock is opened; the code ends the case" },
    ],
    items: [
      { key: "key", kind: "key", purpose: "opens the lock" },
      { key: "clue", kind: "clue_full", purpose: "carries the four-digit code" },
    ],
    steps: [
      { key: "find_key", kind: "inspect", role: "hiding_place", grants: ["key"] },
      { key: "find_clue", kind: "inspect", role: "note_spot", grants: ["clue"] },
      { key: "open_lock", kind: "use_item", role: "lock", item: "key", reveals: ["keypad"] },
      { key: "enter_code", kind: "code", role: "keypad", clue: "clue", requires: ["open_lock", "find_clue"] },
    ],
    exit: "enter_code",
  },
  {
    name: "torn_note_safe",
    summary: "Two torn halves of a note combine into the code for a safe that a key reveals.",
    roles: [
      { key: "hiding_place", accepts: CACHE, purpose: "inspecting it finds the small key" },
      { key: "left_spot", accepts: CLUE, purpose: "inspecting it finds the first half of a torn note" },
      { key: "right_spot", accepts: CLUE, purpose: "inspecting it finds the second half of a torn note" },
      { key: "lock", accepts: LOCK, purpose: "locked; the key opens it and reveals the safe" },
      { key: "safe", accepts: KEYPAD, hidden: true, purpose: "a four-digit safe, hidden until the lock is opened; the code ends the case" },
    ],
    items: [
      { key: "key", kind: "key", purpose: "opens the lock" },
      { key: "left", kind: "clue_first", purpose: "first half of the note: the first two digits" },
      { key: "right", kind: "clue_second", purpose: "second half of the note: the last two digits" },
      { key: "note", kind: "clue_full", purpose: "the joined note with all four digits" },
    ],
    steps: [
      { key: "find_key", kind: "inspect", role: "hiding_place", grants: ["key"] },
      { key: "find_left", kind: "inspect", role: "left_spot", grants: ["left"] },
      { key: "find_right", kind: "inspect", role: "right_spot", grants: ["right"] },
      { key: "open_lock", kind: "use_item", role: "lock", item: "key", reveals: ["safe"] },
      { key: "join_halves", kind: "combine", inputs: ["left", "right"], grants: ["note"] },
      { key: "enter_code", kind: "code", role: "safe", clue: "note", requires: ["open_lock", "join_halves"] },
    ],
    exit: "enter_code",
  },
  {
    name: "assembled_tool",
    summary: "Two parts assemble into a tool; the tool opens a mechanism holding the code to a hidden lock.",
    roles: [
      { key: "first_part_spot", accepts: CACHE, purpose: "inspecting it finds the first part of a tool" },
      { key: "second_part_spot", accepts: CACHE, purpose: "inspecting it finds the second part of a tool" },
      { key: "mechanism", accepts: LOCK, purpose: "only the assembled tool opens it; inside is the code, and a hidden lock appears" },
      { key: "keypad", accepts: KEYPAD, hidden: true, purpose: "a four-digit lock, hidden until the mechanism opens; the code ends the case" },
    ],
    items: [
      { key: "part_a", kind: "part", purpose: "first part of the tool" },
      { key: "part_b", kind: "part", purpose: "second part of the tool" },
      { key: "tool", kind: "tool", purpose: "the assembled tool; opens the mechanism" },
      { key: "clue", kind: "clue_full", purpose: "found inside the mechanism; carries the four-digit code" },
    ],
    steps: [
      { key: "find_part_a", kind: "inspect", role: "first_part_spot", grants: ["part_a"] },
      { key: "find_part_b", kind: "inspect", role: "second_part_spot", grants: ["part_b"] },
      { key: "assemble", kind: "combine", inputs: ["part_a", "part_b"], grants: ["tool"] },
      { key: "use_tool", kind: "use_item", role: "mechanism", item: "tool", grants: ["clue"], reveals: ["keypad"] },
      { key: "enter_code", kind: "code", role: "keypad", clue: "clue", requires: ["use_tool"] },
    ],
    exit: "enter_code",
  },
  {
    // Universal: every role accepts every affordance, so any four verified objects fit.
    name: "code_box_key",
    summary: "A written code opens a lock that holds a key; the key reveals the final hiding place.",
    roles: [
      { key: "note_spot", accepts: CLUE.concat(ANY.filter((a) => !CLUE.includes(a))), purpose: "inspecting it finds the written clue with the code" },
      { key: "coded_lock", accepts: KEYPAD.concat(ANY.filter((a) => !KEYPAD.includes(a))), purpose: "a four-digit lock; the code opens it and gives the key" },
      { key: "lock", accepts: LOCK.concat(ANY.filter((a) => !LOCK.includes(a))), purpose: "locked; the key opens it and reveals the final hiding place" },
      { key: "final_spot", accepts: FINALE, hidden: true, purpose: "hidden until the lock opens; inspecting it ends the case" },
    ],
    items: [
      { key: "clue", kind: "clue_full", purpose: "carries the four-digit code" },
      { key: "key", kind: "key", purpose: "found behind the coded lock; opens the lock" },
    ],
    steps: [
      { key: "find_clue", kind: "inspect", role: "note_spot", grants: ["clue"] },
      { key: "enter_code", kind: "code", role: "coded_lock", clue: "clue", requires: ["find_clue"], grants: ["key"] },
      { key: "open_lock", kind: "use_item", role: "lock", item: "key", reveals: ["final_spot"] },
      { key: "final_look", kind: "inspect", role: "final_spot", requires: ["open_lock"] },
    ],
    exit: "final_look",
  },
  {
    name: "chain_of_custody",
    summary: "Key, then code, then a lens: each step hands over the means to the next.",
    roles: [
      { key: "hiding_place", accepts: CACHE, purpose: "inspecting it finds the small key" },
      { key: "lock", accepts: LOCK, purpose: "locked; the key opens it and inside is the written code" },
      { key: "coded_lock", accepts: KEYPAD, purpose: "a four-digit lock; the code opens it and gives a lens" },
      { key: "viewer", accepts: FINALE, purpose: "the lens shows what is hidden here; inspecting it afterwards ends the case" },
    ],
    items: [
      { key: "key", kind: "key", purpose: "opens the lock" },
      { key: "clue", kind: "clue_full", purpose: "found in the lock; carries the four-digit code" },
      { key: "lens", kind: "lens", purpose: "found behind the coded lock; used on the viewer" },
    ],
    steps: [
      { key: "find_key", kind: "inspect", role: "hiding_place", grants: ["key"] },
      { key: "open_lock", kind: "use_item", role: "lock", item: "key", grants: ["clue"] },
      { key: "enter_code", kind: "code", role: "coded_lock", clue: "clue", requires: ["open_lock"], grants: ["lens"] },
      { key: "use_lens", kind: "use_item", role: "viewer", item: "lens" },
      { key: "final_look", kind: "inspect", role: "viewer", requires: ["use_lens"] },
    ],
    exit: "final_look",
  },
  {
    name: "split_cipher",
    summary: "Two strips align into a code; the code reveals the final hiding place.",
    roles: [
      { key: "first_strip_spot", accepts: CLUE, purpose: "inspecting it finds the first strip (first two digits)" },
      { key: "second_strip_spot", accepts: CLUE, purpose: "inspecting it finds the second strip (last two digits)" },
      { key: "coded_lock", accepts: KEYPAD, purpose: "a four-digit lock; the code reveals the final hiding place" },
      { key: "final_spot", accepts: FINALE, hidden: true, purpose: "hidden until the code is entered; inspecting it ends the case" },
    ],
    items: [
      { key: "strip_a", kind: "clue_first", purpose: "first strip: the first two digits" },
      { key: "strip_b", kind: "clue_second", purpose: "second strip: the last two digits" },
      { key: "card", kind: "clue_full", purpose: "the aligned strips with all four digits" },
    ],
    steps: [
      { key: "find_strip_a", kind: "inspect", role: "first_strip_spot", grants: ["strip_a"] },
      { key: "find_strip_b", kind: "inspect", role: "second_strip_spot", grants: ["strip_b"] },
      { key: "align_strips", kind: "combine", inputs: ["strip_a", "strip_b"], grants: ["card"] },
      { key: "enter_code", kind: "code", role: "coded_lock", clue: "card", requires: ["align_strips"], reveals: ["final_spot"] },
      { key: "final_look", kind: "inspect", role: "final_spot", requires: ["enter_code"] },
    ],
    exit: "final_look",
  },
  {
    name: "quiet_heist",
    summary: "Half a note is in plain sight; the other half is behind a lock, next to a hidden safe.",
    roles: [
      { key: "left_spot", accepts: CLUE, purpose: "inspecting it finds the first half of a torn note" },
      { key: "hiding_place", accepts: CACHE, purpose: "inspecting it finds the small key" },
      { key: "lock", accepts: LOCK, purpose: "locked; the key opens it, inside is the second half, and the safe appears" },
      { key: "safe", accepts: KEYPAD, hidden: true, purpose: "a four-digit safe, hidden until the lock is opened; the code ends the case" },
    ],
    items: [
      { key: "left", kind: "clue_first", purpose: "first half of the note: the first two digits" },
      { key: "key", kind: "key", purpose: "opens the lock" },
      { key: "right", kind: "clue_second", purpose: "second half of the note: the last two digits" },
      { key: "note", kind: "clue_full", purpose: "the joined note with all four digits" },
    ],
    steps: [
      { key: "find_left", kind: "inspect", role: "left_spot", grants: ["left"] },
      { key: "find_key", kind: "inspect", role: "hiding_place", grants: ["key"] },
      { key: "open_lock", kind: "use_item", role: "lock", item: "key", grants: ["right"], reveals: ["safe"] },
      { key: "join_halves", kind: "combine", inputs: ["left", "right"], grants: ["note"] },
      { key: "enter_code", kind: "code", role: "safe", clue: "note", requires: ["open_lock", "join_halves"] },
    ],
    exit: "enter_code",
  },
];

export const MAX_HERRINGS = 2;

// ---------------------------------------------------------------------------
// Minting (crypto randomness only)
// ---------------------------------------------------------------------------
export type RandomInt = (maxExclusive: number) => number;

/** Uniform integer in [0, max) from crypto.getRandomValues (rejection sampling, no modulo bias). */
export const cryptoInt: RandomInt = (max) => {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
};

/** Codes a player could guess without the clue. */
export function isWeakCode(code: string): boolean {
  const d = [...code].map(Number);
  const steps = d.slice(1).map((v, i) => v - d[i]);
  return steps.every((s) => s === 0) || steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

export function mintCode(randomInt: RandomInt = cryptoInt): string {
  for (;;) {
    const code = String(randomInt(10_000)).padStart(4, "0");
    if (!isWeakCode(code)) return code;
  }
}

const SUFFIX_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function mintSuffix(randomInt: RandomInt = cryptoInt, length = 4): string {
  let out = "";
  for (let i = 0; i < length; i++) out += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  return out;
}

const ITEM_PREFIX: Record<ItemKind, string> = {
  key: "key", part: "part", tool: "tool", lens: "lens", clue_full: "note", clue_first: "scrap", clue_second: "scrap",
};

/** ^[a-z0-9][a-z0-9_-]{0,63}$ slug of a label, unique within `taken`. */
export function slugId(label: string, taken: Set<string>, fallback = "object"): string {
  let base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40).replace(/_+$/, "");
  if (!/^[a-z0-9]/.test(base)) base = fallback;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  taken.add(id);
  return id;
}

// ---------------------------------------------------------------------------
// Compiled room (structure only; prose.ts adds text)
// ---------------------------------------------------------------------------
export interface CompiledHotspot {
  id: string;
  object: VerifiedObject;
  hidden: boolean;
  role: string | null;              // null for red herrings
  purpose: string;
}

export interface CompiledItem {
  id: string;
  key: string;
  kind: ItemKind;
  purpose: string;
  clue?: { part: "full" | "first" | "second"; literal: string };
}

export interface CompiledPuzzle {
  id: string;
  kind: "inspect" | "use_item" | "combine" | "code";
  hotspotId?: string;
  requires: string[];
  itemId?: string;
  inputs?: [string, string];
  answer?: string;
  clueItemId?: string;
  rewards: { items: string[]; consume_items: string[]; reveal_hotspots: string[] };
  herring: boolean;
}

export interface CompiledRoom {
  template: string;
  summary: string;
  code: string;
  hotspots: CompiledHotspot[];
  items: CompiledItem[];
  puzzles: CompiledPuzzle[];
  exitPuzzleId: string;
}

export interface CompileOptions {
  randomInt?: RandomInt;
  code?: string;                    // tests only; production always mints
}

/** Binds roles to objects and mints answers and ids. `assignment` maps role key -> object. */
export function compileTemplate(
  spec: TemplateSpec,
  assignment: ReadonlyMap<string, VerifiedObject>,
  herrings: readonly VerifiedObject[] = [],
  opts: CompileOptions = {},
): CompiledRoom {
  const randomInt = opts.randomInt ?? cryptoInt;
  const code = opts.code ?? mintCode(randomInt);

  const hotspotIds = new Set<string>();
  const hotspotByRole = new Map<string, CompiledHotspot>();
  const hotspots: CompiledHotspot[] = [];
  for (const role of spec.roles) {
    const object = assignment.get(role.key);
    if (!object) throw new Error(`template ${spec.name}: role ${role.key} is unassigned`);
    const hotspot = { id: slugId(object.label, hotspotIds), object, hidden: role.hidden === true, role: role.key, purpose: role.purpose };
    hotspots.push(hotspot);
    hotspotByRole.set(role.key, hotspot);
  }

  const itemIds = new Set<string>();
  const itemByKey = new Map<string, CompiledItem>();
  const items: CompiledItem[] = spec.items.map((item) => {
    let id: string;
    do id = `${ITEM_PREFIX[item.kind]}_${mintSuffix(randomInt)}`; while (itemIds.has(id));
    itemIds.add(id);
    const clue = item.kind === "clue_full" ? { part: "full" as const, literal: code }
      : item.kind === "clue_first" ? { part: "first" as const, literal: code.slice(0, 2) }
      : item.kind === "clue_second" ? { part: "second" as const, literal: code.slice(2) }
      : undefined;
    const compiled: CompiledItem = { id, key: item.key, kind: item.kind, purpose: item.purpose, ...(clue ? { clue } : {}) };
    itemByKey.set(item.key, compiled);
    return compiled;
  });
  const itemId = (key: string) => {
    const item = itemByKey.get(key);
    if (!item) throw new Error(`template ${spec.name}: unknown item ${key}`);
    return item.id;
  };
  const hotspotId = (role: string) => {
    const hotspot = hotspotByRole.get(role);
    if (!hotspot) throw new Error(`template ${spec.name}: unknown role ${role}`);
    return hotspot.id;
  };

  const puzzles: CompiledPuzzle[] = spec.steps.map((step) => {
    const consumed = step.kind === "use_item" ? [itemId(step.item!)]
      : step.kind === "combine" ? step.inputs!.map(itemId)
      : [];
    return {
      id: step.key,
      kind: step.kind,
      ...(step.kind !== "combine" ? { hotspotId: hotspotId(step.role!) } : {}),
      requires: [...(step.requires ?? [])],
      ...(step.kind === "use_item" ? { itemId: itemId(step.item!) } : {}),
      ...(step.kind === "combine" ? { inputs: [itemId(step.inputs![0]), itemId(step.inputs![1])] as [string, string] } : {}),
      ...(step.kind === "code" ? { answer: code, clueItemId: itemId(step.clue!) } : {}),
      rewards: {
        items: (step.grants ?? []).map(itemId),
        consume_items: consumed,
        reveal_hotspots: (step.reveals ?? []).map(hotspotId),
      },
      herring: false,
    };
  });

  herrings.slice(0, MAX_HERRINGS).forEach((object, i) => {
    const hotspot: CompiledHotspot = {
      id: slugId(object.label, hotspotIds), object, hidden: false, role: null,
      purpose: "a red herring: inspecting it gives atmosphere and nothing needed",
    };
    hotspots.push(hotspot);
    puzzles.push({
      id: `look_${i + 1}`, kind: "inspect", hotspotId: hotspot.id, requires: [],
      rewards: { items: [], consume_items: [], reveal_hotspots: [] }, herring: true,
    });
  });

  return { template: spec.name, summary: spec.summary, code, hotspots, items, puzzles, exitPuzzleId: spec.exit };
}

// ---------------------------------------------------------------------------
// Role assignment and template selection
// ---------------------------------------------------------------------------
function roleFit(role: RoleSpec, object: VerifiedObject): number | null {
  const rank = role.accepts.indexOf(object.affordance);
  if (rank < 0) return null;
  return 1 - rank * 0.12 + 0.3 * object.confidence + 0.08 * object.clarity;
}

/** Best one-to-one role binding, rewarding fit plus spread across photos and kinds of object. */
export function assignRoles(
  spec: TemplateSpec,
  objects: readonly VerifiedObject[],
): { assignment: Map<string, VerifiedObject>; score: number } | null {
  if (objects.length < spec.roles.length) return null;
  const options = spec.roles.map((role) => ({
    role,
    choices: objects.map((o) => ({ o, fit: roleFit(role, o) }))
      .filter((c): c is { o: VerifiedObject; fit: number } => c.fit !== null)
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 8),
  })).sort((a, b) => a.choices.length - b.choices.length);
  if (options.some((o) => o.choices.length === 0)) return null;

  let best: { assignment: Map<string, VerifiedObject>; score: number } | null = null;
  const chosen: Array<{ role: RoleSpec; o: VerifiedObject; fit: number }> = [];
  const used = new Set<string>();
  const search = (depth: number) => {
    if (depth === options.length) {
      const photos = new Set(chosen.map((c) => c.o.photoIndex)).size;
      const kinds = new Set(chosen.map((c) => c.o.affordance)).size;
      const score = chosen.reduce((s, c) => s + c.fit, 0) + 0.2 * photos + 0.15 * kinds;
      if (!best || score > best.score) {
        best = { assignment: new Map(chosen.map((c) => [c.role.key, c.o])), score };
      }
      return;
    }
    for (const choice of options[depth].choices) {
      if (used.has(choice.o.id)) continue;
      used.add(choice.o.id);
      chosen.push({ role: options[depth].role, ...choice });
      search(depth + 1);
      chosen.pop();
      used.delete(choice.o.id);
    }
  };
  search(0);
  return best;
}

/** Herrings: clearest unused objects, preferring photos that have the fewest hotspots so far. */
export function pickHerrings(objects: readonly VerifiedObject[], used: ReadonlySet<string>, assigned: readonly VerifiedObject[]): VerifiedObject[] {
  const perPhoto = new Map<number, number>();
  for (const o of assigned) perPhoto.set(o.photoIndex, (perPhoto.get(o.photoIndex) ?? 0) + 1);
  return objects.filter((o) => !used.has(o.id))
    .sort((a, b) =>
      (perPhoto.get(a.photoIndex) ?? 0) - (perPhoto.get(b.photoIndex) ?? 0) ||
      b.clarity - a.clarity || b.confidence - a.confidence)
    .slice(0, MAX_HERRINGS);
}

/**
 * Chooses among templates whose roles fit, weighted toward better fits and
 * richer graphs, then compiles it. Returns null if no template fits.
 */
export function selectAndCompile(
  objects: readonly VerifiedObject[],
  opts: CompileOptions & { random?: () => number; templates?: readonly TemplateSpec[] } = {},
): CompiledRoom | null {
  const feasible = (opts.templates ?? TEMPLATES).map((spec) => ({ spec, fit: assignRoles(spec, objects) }))
    .filter((t): t is { spec: TemplateSpec; fit: { assignment: Map<string, VerifiedObject>; score: number } } => t.fit !== null)
    .map((t) => ({ ...t, weight: t.fit.score / t.spec.roles.length + 0.1 * t.spec.steps.length }));
  if (!feasible.length) return null;

  const random = opts.random ?? (() => cryptoInt(1_000_000) / 1_000_000);
  const total = feasible.reduce((s, t) => s + t.weight, 0);
  let pick = random() * total;
  let chosen = feasible[feasible.length - 1];
  for (const t of feasible) {
    pick -= t.weight;
    if (pick < 0) {
      chosen = t;
      break;
    }
  }
  const assigned = [...chosen.fit.assignment.values()];
  const herrings = pickHerrings(objects, new Set(assigned.map((o) => o.id)), assigned);
  return compileTemplate(chosen.spec, chosen.fit.assignment, herrings, opts);
}

/** Structural self-check of a template spec (used by tests). */
export function validateTemplateSpec(spec: TemplateSpec): string[] {
  const errors: string[] = [];
  const roles = new Set(spec.roles.map((r) => r.key));
  const items = new Map(spec.items.map((i) => [i.key, i]));
  const steps = new Map(spec.steps.map((s) => [s.key, s]));
  if (roles.size !== spec.roles.length) errors.push("duplicate role key");
  if (items.size !== spec.items.length) errors.push("duplicate item key");
  if (steps.size !== spec.steps.length) errors.push("duplicate step key");
  if (spec.steps.length < 4 || spec.steps.length > 6) errors.push(`needs 4-6 required steps, has ${spec.steps.length}`);
  const exit = steps.get(spec.exit);
  if (!exit || (exit.kind !== "inspect" && exit.kind !== "code")) errors.push("exit must be an inspect or code step");
  const granted = new Map<string, number>();
  const consumed = new Map<string, number>();
  const revealed = new Set<string>();
  for (const s of spec.steps) {
    if (s.kind !== "combine" && !roles.has(s.role ?? "")) errors.push(`${s.key}: unknown role`);
    for (const g of s.grants ?? []) granted.set(g, (granted.get(g) ?? 0) + 1);
    const uses = s.kind === "use_item" ? [s.item ?? ""] : s.kind === "combine" ? [...(s.inputs ?? [])] : [];
    for (const u of uses) consumed.set(u, (consumed.get(u) ?? 0) + 1);
    for (const r of s.reveals ?? []) revealed.add(r);
    for (const r of s.requires ?? []) if (!steps.has(r)) errors.push(`${s.key}: requires unknown step ${r}`);
    if (s.kind === "combine" && s.inputs?.length !== 2) errors.push(`${s.key}: combine needs two inputs`);
    if (s.kind === "code") {
      const clue = items.get(s.clue ?? "");
      if (clue?.kind !== "clue_full") errors.push(`${s.key}: clue must be a clue_full item`);
      const giver = spec.steps.find((g) => g.grants?.includes(s.clue ?? ""));
      if (!giver || !(s.requires ?? []).includes(giver.key)) errors.push(`${s.key}: must require the step granting its clue`);
      if (consumed.has(s.clue ?? "") || spec.steps.some((o) => o.inputs?.includes(s.clue ?? "") || o.item === s.clue)) {
        errors.push(`${s.key}: clue must never be consumed`);
      }
    }
  }
  for (const key of items.keys()) {
    if (granted.get(key) !== 1) errors.push(`item ${key} must be granted exactly once`);
    if ((consumed.get(key) ?? 0) > 1) errors.push(`item ${key} consumed more than once`);
  }
  for (const r of spec.roles) {
    if (r.hidden && !revealed.has(r.key)) errors.push(`hidden role ${r.key} is never revealed`);
    if (r.accepts.length === 0) errors.push(`role ${r.key} accepts nothing`);
  }
  return errors;
}
