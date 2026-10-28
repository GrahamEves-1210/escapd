// The seeded planner: object inventory + mode -> a schema v2 room (definition
// plus secret), proven by the simulator.
//
//   1. Pick the exit: a real door, else the most door-like object (wardrobe, cabinet).
//   2. Mode skeleton: the finale goes on the exit first (noir: a combination;
//      crime scene: an accusation; paranormal: an ordered ritual). Its inputs
//      become the threads' goals (code digits, accusation answers, ritual positions).
//   3. Grow each thread backwards from its goal with motifs whose archetypes have
//      hosts in the room, preferring objects on photos the thread hasn't used.
//   4. Optional story fragment, at most one removable object, herrings.
//   5. Validate, simulate, check the constraints, score; keep the best candidate.
// Structure is deterministic from `seed`; values and ids are minted with crypto
// randomness (`randomInt`, injectable for tests).
import { type Box1000, boxArea, boxToRect, isValidBox } from "../geometry.ts";
import { cryptoInt, isWeakCode, mintSuffix, type RandomInt, slugId } from "../mint.ts";
import { type ArchetypeId, type ControlDomain, DOOR_FALLBACK_TYPES, hostableArchetypes, isMarkable, SYMBOLS, variantSpec } from "./archetypes.ts";
import {
  ALIBIS, capitalise, describeObject, ITEM_NAMES, KEEPSAKES, type Medium, METHODS, MODE_COPY, MOTIVES, ordinalLine, type Pick, romanMark,
  SUSPECTS, writeCard,
} from "./copy.ts";
import { MOTIFS } from "./motifs.ts";
import { simulate, type SimReport } from "./simulate.ts";
import { categoryOf, type InventoryObject, isPortableType } from "./taxonomy.ts";
import type {
  AccuseOption, CardDef, Condition, Effect, FinaleDef, ItemDef, Mode, MotifId, ObjectDef, RoomDefinitionV2,
  RoomSecretV2, Rule, SlotKind, SlotValue, StateValue, StepDef, Trigger,
} from "./types.ts";
import { validateDefinition } from "./validate.ts";

export interface PlanOptions {
  mode: Mode;
  seed: string | number;          // structure is deterministic from it (use the room id)
  randomInt?: RandomInt;          // minted values and ids; crypto by default
  candidates?: number;            // structural candidates to try and score (default 8)
}

export type PlanFailure = "too_few_objects" | "no_exit" | "no_valid_plan";

export interface PlanSummary {
  threads: number;
  motifs: MotifId[];              // per required step
  objectsUsed: number;
  photos: number;
  score: number;
  candidatesTried: number;
}

export type PlanResult =
  | { ok: true; definition: RoomDefinitionV2; secret: RoomSecretV2; report: SimReport; summary: PlanSummary }
  | { ok: false; reason: PlanFailure; detail: string };

export const STEP_BAND = { min: 6, max: 9 } as const;
export const THREE_THREAD_POOL = 7;     // interactive objects needed to try three threads
export const MIN_SALIENCE = 0.15;
export const MAX_OBJECTS = 14;
export const MIN_POOL = 4;       // interactive objects besides the exit
const DEMANDING: ArchetypeId[] = ["ClockHands", "TuningDial", "CombinationLock"];
const CONTAINERS: ArchetypeId[] = ["Drawer", "LiftUnder", "FrameTilt"];
const CONTAINER_CONTROL: Partial<Record<ArchetypeId, string>> = { Drawer: "open", LiftUnder: "lifted", FrameTilt: "tilted" };
/** The last hint rung's verb for finding something in a container. */
const verb = (b: Bound) => (b.archetype === "Drawer" ? (b.variant === "drawer" ? "Pull out" : "Open") : b.archetype === "LiftUnder" ? "Lift" : "Tilt");
/** "the drawer", or "a drawer of the desk" when the object is the furniture around it. */
const target = (b: Bound) => (b.archetype === "Drawer" && b.variant === "drawer" && !/\bdrawers?\b/i.test(b.inv.label) ? `a drawer of the ${b.inv.label}` : `the ${b.inv.label}`);
/** Kinds whose card lines are whole sentences (crime-scene evidence, ritual fragments). */
const LIST_KINDS: SlotKind[] = ["option", "object"];
const WORDS = ["OAK", "ELM", "ASH", "INK", "OWL", "FOX", "JAM", "ICE", "RYE", "GIN", "VOW", "HEX", "ORE", "SKY", "WAX", "YEW"];

/** Deterministic [0, 1) stream from a string seed (FNV-1a + mulberry32). */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Bound {
  inv: InventoryObject;
  id: string;
  hostable: { archetype: ArchetypeId; variant: string }[];
  archetype: ArchetypeId | null;
  variant?: string;
  roles: number;
  triggers: string[];
  threads: number[];
  initial: Record<string, StateValue>;
}

interface Want {
  trigger: string;
  thread: number;
  accept?: (a: ArchetypeId, v: string) => boolean;
  markable?: boolean;
  preferUsed?: boolean;
  samePhotoAs?: Bound;
  excludeIds?: (string | undefined)[];
}

interface Option { motif: MotifId; min: number; fixed: boolean; run: () => string | null }

interface SlotMeta {
  tag?: string;          // digits: the door wheels' symbols they belong on
  ordinal?: number;      // object: the ritual position (0-based)
  ruleOut?: string;      // option: the finding that rules it out, with {{s}} for its name
}

/** What a step hands over: an item into the hand, or a card to read where it was found. */
type Payload = { item: string } | { card: string };

class Builder {
  slots: Record<string, SlotValue> = {};
  /** How each slot is written on a card: its door wheels' symbols, its lock's alphabet, its ritual position, what rules it out. */
  meta = new Map<string, SlotMeta>();
  items: ItemDef[] = [];
  cards: CardDef[] = [];
  rules: Rule[] = [];
  steps: StepDef[] = [];
  used: Partial<Record<MotifId, number>> = {};
  values = new Set<string>();
  ciphers: { slot: string; of: string[]; offset: string }[] = [];
  removable: Bound | null = null;
  ids = new Set<string>();

  /** Text choices draw from their own stream, so wording never changes a room's structure. */
  pick: Pick;
  names: (typeof ITEM_NAMES)[Mode];

  constructor(public mode: Mode, public pool: Bound[], public exit: Bound, public rng: () => number, public rint: RandomInt, public trng: () => number) {
    this.pick = <T>(xs: readonly T[]): T => xs[Math.floor(this.trng() * xs.length)];
    this.names = ITEM_NAMES[mode];
  }

  /** `n` distinct entries of `xs`, in a seeded order. */
  sample<T>(xs: readonly T[], n: number): T[] {
    const pool = [...xs];
    return Array.from({ length: Math.min(n, pool.length) }, () => pool.splice(Math.floor(this.trng() * pool.length), 1)[0]);
  }

  snap(): () => void {
    const pool = this.pool.map((b) => ({ ...b, triggers: [...b.triggers], threads: [...b.threads], initial: { ...b.initial } }));
    const [slots, used, values, ciphers, ids] = [{ ...this.slots }, { ...this.used }, new Set(this.values), [...this.ciphers], new Set(this.ids)];
    const n = [this.items.length, this.cards.length, this.rules.length, this.steps.length];
    return () => {
      this.pool = pool.map((b) => ({ ...b, triggers: [...b.triggers], threads: [...b.threads], initial: { ...b.initial } }));
      Object.assign(this, { slots: { ...slots }, used: { ...used }, values: new Set(values), ciphers: [...ciphers], ids: new Set(ids) });
      this.items.length = n[0]; this.cards.length = n[1]; this.rules.length = n[2]; this.steps.length = n[3];
    };
  }

  // ---- objects -----------------------------------------------------------
  pickObject(w: Want): { b: Bound; archetype?: ArchetypeId; variant?: string } | null {
    const threadPhotos = new Set(this.pool.filter((b) => b.threads.includes(w.thread)).map((b) => b.inv.photo_index));
    const usedPhotos = new Set(this.pool.filter((b) => b.roles > 0).map((b) => b.inv.photo_index));
    let best: { b: Bound; archetype?: ArchetypeId; variant?: string } | null = null;
    let bestScore = -Infinity;
    for (const b of this.pool) {
      if (b.roles >= 2 || b.triggers.includes(w.trigger) || b === this.removable || w.excludeIds?.includes(b.id)) continue;
      if (w.markable && !isMarkable(b.inv.type)) continue;
      let av: { archetype?: ArchetypeId; variant?: string } = {};
      if (w.accept) {
        if (b.archetype) {
          if (!w.accept(b.archetype, b.variant!)) continue;
          av = { archetype: b.archetype, variant: b.variant };
        } else {
          const fits = b.hostable.filter((h) => w.accept!(h.archetype, h.variant) && (!DEMANDING.includes(h.archetype) || b.inv.fully_visible));
          if (!fits.length) continue;
          av = fits[Math.floor(this.rng() * fits.length)];
        }
      }
      const p = b.inv.photo_index;
      const score = b.inv.salience + this.rng() * 0.8 +
        (w.preferUsed && b.roles > 0 ? 1.5 : 0) + (threadPhotos.has(p) ? 0 : 0.5) + (usedPhotos.has(p) ? 0 : 0.3) +
        (w.samePhotoAs && w.samePhotoAs.inv.photo_index === p ? 0.8 : 0);
      if (score > bestScore) { bestScore = score; best = { b, ...av }; }
    }
    return best;
  }

  bind(p: { b: Bound; archetype?: ArchetypeId; variant?: string }, thread: number, ...triggers: string[]): Bound {
    const b = p.b;
    b.roles++;
    b.triggers.push(...triggers);
    b.threads.push(thread);
    if (p.archetype) { b.archetype = p.archetype; b.variant = p.variant; }
    return b;
  }

  // ---- data --------------------------------------------------------------
  slot(kind: SlotKind, value: string, text?: string, meta?: SlotMeta, from?: string[]): string {
    const name = `${kind}_${Object.keys(this.slots).length + 1}`;
    this.slots[name] = { kind, value, ...(text !== undefined && text !== value ? { text } : {}), ...(from ? { from } : {}) };
    if (meta) this.meta.set(name, meta);
    else this.meta.delete(name);   // a name reused after a rollback
    return name;
  }

  /** A fresh value of a kind, unique in the room. Wheels values are "a|b|c" with text "abc". */
  mint(kind: "time" | "freq" | "page" | "offset" | "letters" | "symbols" | "digits"): { value: string; text?: string } {
    for (;;) {
      let value: string, text: string | undefined;
      const r = this.rint;
      switch (kind) {
        case "time": value = `${1 + r(12)}:${String(5 * r(12)).padStart(2, "0")}`; if (value === "12:00") continue; break;
        case "freq": { const t = 881 + r(199); if (t % 10 === 0) continue; value = (t / 10).toFixed(1); break; }
        case "page": value = String(12 + r(288)); break;
        case "offset": value = String(2 + r(23)); break;
        case "letters": { const w = WORDS[r(WORDS.length)]; value = w.split("").join("|"); text = w; break; }
        case "symbols": { const pool: string[] = [...SYMBOLS]; const s: string[] = []; while (s.length < 3) s.push(pool.splice(r(pool.length), 1)[0]); value = s.join("|"); text = s.join(" "); break; }
        case "digits": { const d = String(r(1000)).padStart(3, "0"); if (isWeakCode(d)) continue; value = d.split("").join("|"); text = d; break; }
      }
      if (this.values.has(`${kind}:${value}`)) continue;
      this.values.add(`${kind}:${value}`);
      return { value, text };
    }
  }

  /** One slot as written in the room: "▲● {{d}}", "p. {{page}}", an alibi, "Second, {{object}}." (`mark`: drawn on an object). */
  phrase(s: string, mark = false, spoken = false): string {
    const m = this.meta.get(s) ?? {};
    const ref = `{{${s}}}`;
    switch (this.slots[s].kind) {
      case "digits": return m.tag ? `${m.tag} ${ref}` : ref;
      case "page": return spoken ? `page ${ref}` : `p. ${ref}`;
      case "offset": return spoken ? `plus ${ref}` : `+${ref}`;
      case "cipher": return mark ? ref : `${ref}, letters that spell nothing`;
      case "option": return mark ? `✗ ${ref}` : (m.ruleOut ?? "{{s}}: ruled out.").replace("{{s}}", ref);
      case "object": return mark ? romanMark(m.ordinal ?? 0, ref) : ordinalLine(m.ordinal ?? 0, ref);
      default: return ref;
    }
  }

  /** What a glow mark says: each slot as written on the object, nothing more. */
  mark(slots: string[]): string {
    return slots.map((s) => this.phrase(s, true)).join("  ");
  }

  /** A card with `slots`, written as a finding in the mode's voice; it never names what a value is for. */
  clue(medium: Medium, slots: string[]): string {
    const list = slots.some((s) => LIST_KINDS.includes(this.slots[s].kind));
    const { title, text } = writeCard(this.mode, medium, slots.map((s) => this.phrase(s, false, medium === "radio")), list, this.pick);
    return this.plainCard(title, text);
  }

  plainCard(title: string, text: string): string {
    const id = `card_${this.cards.length + 1}`;
    this.cards.push({ id, title, text });
    return id;
  }

  item(kind: ItemDef["kind"], name: string, extra: Partial<ItemDef> = {}): string {
    let id: string;
    do id = `${kind === "assembled" ? "item" : kind}_${mintSuffix(this.rint)}`; while (this.ids.has(id));
    this.ids.add(id);
    this.items.push({ id, name, kind, ...extra });
    return id;
  }

  step(motif: MotifId, thread: number | null, object: string | undefined, requires: string[], hints: [string, string, string], optional = false): string {
    const id = `step_${this.steps.length + 1}`;
    this.steps.push({ id, title: STEP_TITLE[motif], thread, motif, ...(object ? { object } : {}), requires, hints, ...(optional ? { optional } : {}) });
    return id;
  }

  rule(trigger: Trigger, when: Condition[], effects: Effect[], step?: string): void {
    this.rules.push({ id: `rule_${this.rules.length + 1}`, ...(step ? { step } : {}), trigger, when, effects });
  }

  /** Writing found in a container: a card to read where it lies, not an item (an item would only repeat it). */
  note(slots: string[]): Payload {
    return { card: this.clue("found", slots) };
  }

  /** What finding a payload does: an item into the hand (its card, if it has one, shown), or a card to read. */
  give(p: Payload): Effect[] {
    if ("card" in p) return [{ do: "show_card", card: p.card }];
    const card = this.items.find((i) => i.id === p.item)?.card;
    return [{ do: "grant", item: p.item }, ...(card ? [{ do: "show_card", card } as Effect] : [])];
  }

  // ---- motif builders -------------------------------------------------------
  choose(options: Option[], budget: number, depth: number): string | null {
    const key = (o: Option) => -Math.log(1 - this.rng()) / (MOTIFS[o.motif as Exclude<MotifId, "finale">]?.weight[this.mode] || 1);
    const ok = options.filter((o) => o.min <= budget && (depth > 0 || !(MOTIFS[o.motif as Exclude<MotifId, "finale">]?.leaf)) &&
      (this.used[o.motif] ?? 0) < (MOTIFS[o.motif as Exclude<MotifId, "finale">]?.maxPerRoom ?? Infinity));
    const fills = (o: Option) => (o.fixed ? o.min === budget : true);
    const ordered = [...ok.filter(fills).map((o) => [key(o), o] as const).sort((a, b) => a[0] - b[0]),
      ...ok.filter((o) => !fills(o)).map((o) => [-o.min, o] as const).sort((a, b) => a[0] - b[0])].map(([, o]) => o);
    for (const o of ordered) {
      const restore = this.snap();
      this.used[o.motif] = (this.used[o.motif] ?? 0) + 1;
      const s = o.run();
      if (s) return s;
      restore();
    }
    return null;
  }

  /** A step whose firing shows a card with `slots`. */
  info(slots: string[], budget: number, thread: number, depth: number): string | null {
    // Sentences (evidence, ritual lines) don't encipher into a readable coded line.
    const codable = !slots.some((s) => LIST_KINDS.includes(this.slots[s].kind));
    return this.choose([
      { motif: "read", min: 1, fixed: true, run: () => this.read(slots, thread) },
      { motif: "contain", min: 1, fixed: true, run: () => this.contain(this.note(slots), thread) },
      { motif: "contain_lock", min: 2, fixed: false, run: () => this.lockedContain(this.note(slots), budget, thread, depth) },
      { motif: "set_state", min: 2, fixed: false, run: () => this.setState(slots, null, budget, thread, depth) },
      { motif: "cross_reference", min: 2, fixed: false, run: () => this.crossReference(slots, budget, thread, depth) },
      { motif: "room_change", min: 2, fixed: true, run: () => this.roomChange(slots, thread) },
      { motif: "tool_reveal", min: 2, fixed: false, run: () => this.toolReveal(slots, budget, thread, depth) },
      { motif: "split", min: 3, fixed: true, run: () => this.split(slots, thread) },
      ...(codable ? [{ motif: "decode" as const, min: 4, fixed: false, run: () => this.decode(slots, budget, thread, depth) }] : []),
    ], budget, depth);
  }

  /** A step whose firing grants `item`. */
  deliver(item: string, budget: number, thread: number, depth: number): string | null {
    return this.choose([
      { motif: "contain", min: 1, fixed: true, run: () => this.contain({ item }, thread) },
      { motif: "contain_lock", min: 2, fixed: false, run: () => this.lockedContain({ item }, budget, thread, depth) },
      { motif: "set_state", min: 2, fixed: false, run: () => this.setState([], { item }, budget, thread, depth) },
    ], budget, depth + 1);
  }

  read(slots: string[], thread: number): string | null {
    const p = this.pickObject({ trigger: "inspect", thread, accept: (a, v) => a === "Readable" && v === "card" });
    if (!p) return null;
    const b = this.bind(p, thread, "inspect");
    const card = this.clue("read", slots);
    const shelf = b.inv.type === "bookshelf" || b.inv.type === "shelf";
    const s = this.step("read", thread, b.id, [], ["Some things here are meant to be read.", `Take a closer look at the ${b.inv.label}.`,
      shelf ? `Search the ${b.inv.label} and read what's tucked in among the books.` : `Read the ${b.inv.label}.`]);
    this.rule({ on: "inspect", object: b.id }, [], [{ do: "show_card", card }], s);
    return s;
  }

  contain(payload: Payload, thread: number, optional = false): string | null {
    const p = this.pickObject({ trigger: "contain", thread, accept: (a) => CONTAINERS.includes(a) });
    if (!p) return null;
    const b = this.bind(p, thread, "contain");
    const control = CONTAINER_CONTROL[b.archetype!]!;
    const label = b.inv.label;
    const s = this.step(optional ? "story_fragment" : "contain", optional ? null : thread, b.id, [],
      ["Not everything is on the surface.", `The ${label} could hide something.`, `${verb(b)} ${target(b)}.`], optional);
    this.rule({ on: "control", target: b.id, control }, [{ if: "control", target: b.id, control, eq: { lit: true } }], this.give(payload), s);
    return s;
  }

  lockedContain(payload: Payload, budget: number, thread: number, depth: number): string | null {
    const byKey = () => {
      const p = this.pickObject({ trigger: "contain", thread, accept: (a) => a === "Drawer" });
      if (!p) return null;
      const b = this.bind(p, thread, "contain", "use");
      b.initial.locked = true;
      const key = this.item("key", this.names.key);
      const up = this.deliver(key, budget - 1, thread, depth);
      if (!up) return null;
      const s = this.step("contain_lock", thread, b.id, [up], ["Something here is locked.", `The ${b.inv.label} is locked; a key must be somewhere.`, `Use the ${this.names.key.toLowerCase()} on the ${b.inv.label}.`]);
      this.rule({ on: "use", item: key, object: b.id }, [], [{ do: "open", object: b.id }, { do: "consume", item: key }, ...this.give(payload)], s);
      return s;
    };
    const byCode = () => {
      const p = this.pickObject({ trigger: "contain", thread, accept: (a) => a === "CombinationLock" });
      if (!p) return null;
      const b = this.bind(p, thread, "contain", "submit");
      const m = this.mint(b.variant as "digits" | "letters" | "symbols");
      const code = this.slot("code", m.value, m.text);
      const up = this.info([code], budget - 1, thread, depth + 1);
      if (!up) return null;
      const s = this.step("contain_lock", thread, b.id, [up], ["One lock here wants a code.", `The ${b.inv.label} has a three-wheel lock; the code is written somewhere.`, `Enter {{${code}}} on the ${b.inv.label}.`]);
      this.rule({ on: "submit", object: b.id }, [{ if: "submitted", eq: { slot: code } }],
        [{ do: "open", object: b.id }, { do: "overlay", object: b.id, overlay: "panel_open" }, ...this.give(payload)], s);
      return s;
    };
    const order = this.rng() < 0.5 ? [byKey, byCode] : [byCode, byKey];
    for (const f of order) {
      const restore = this.snap();
      const s = f();
      if (s) return s;
      restore();
    }
    return null;
  }

  /** Clock hands or a tuning dial set to a value learned upstream. Shows `slots`, or grants `item` (clock only). */
  setState(slots: string[], item: Payload | null, budget: number, thread: number, depth: number): string | null {
    const p = this.pickObject({ trigger: "set", thread, accept: (a) => a === "ClockHands" || (!item && a === "TuningDial") });
    if (!p) return null;
    const b = this.bind(p, thread, "set");
    const clock = b.archetype === "ClockHands";
    const kind = clock ? "time" : "freq";
    const m = this.mint(kind);
    // No "for the clock": which thing a value belongs to is the player's to work out.
    const input = this.slot(kind, m.value);
    if (clock) b.initial.time = this.mint("time").value;
    const up = this.info([input], budget - 1, thread, depth + 1);
    if (!up) return null;
    const control = clock ? "time" : "freq";
    const payload = item ?? (clock ? this.note(slots) : null);
    const effects: Effect[] = clock
      ? [{ do: "set_state", target: b.id, key: "panel", value: true }, { do: "overlay", object: b.id, overlay: "panel_open" }, ...this.give(payload!)]
      : [{ do: "show_card", card: this.clue("radio", slots) }];
    const s = this.step("set_state", thread, b.id, [up], [
      clock ? "A stopped clock is waiting for the right time." : "Something in the room can be tuned.",
      clock ? `The ${b.inv.label}'s hands can be moved.` : `The ${b.inv.label} has a dial; a frequency is written somewhere.`,
      clock ? `Set the ${b.inv.label} to {{${input}}}.` : `Tune the ${b.inv.label} to {{${input}}}.`,
    ]);
    this.rule({ on: "control", target: b.id, control }, [{ if: "control", target: b.id, control, eq: { slot: input } }], effects, s);
    return s;
  }

  crossReference(slots: string[], budget: number, thread: number, depth: number): string | null {
    const p = this.pickObject({ trigger: "set", thread, accept: (a, v) => a === "Readable" && v === "pages" });
    if (!p) return null;
    const b = this.bind(p, thread, "set");
    // No "in the bookshelf": which book a page number belongs to is the player's to work out.
    const page = this.slot("page", this.mint("page").value);
    const up = this.info([page], budget - 1, thread, depth + 1);
    if (!up) return null;
    const s = this.step("cross_reference", thread, b.id, [up], ["One clue points into a book.", `A page number you found belongs to the ${b.inv.label}.`, `Find page {{${page}}} in the ${b.inv.label}.`]);
    this.rule({ on: "control", target: b.id, control: "page" }, [{ if: "control", target: b.id, control: "page", eq: { slot: page } }],
      [{ do: "show_card", card: this.clue("pages", slots) }, { do: "overlay", object: b.id, overlay: "pinned_card" }], s);
    return s;
  }

  roomChange(slots: string[], thread: number): string | null {
    const lp = this.pickObject({ trigger: "set", thread, accept: (a, v) => a === "Light" && v !== "torch" });
    if (!lp) return null;
    const lamp = this.bind(lp, thread, "set");
    const tp = this.pickObject({ trigger: "inspect", thread, markable: true, preferUsed: true, samePhotoAs: lamp, excludeIds: [lamp.id] });
    if (!tp) return null;
    const target = this.bind(tp, thread, "inspect");
    const s1 = this.step("room_change", thread, lamp.id, [], ["The room is darker than it should be.", `The ${lamp.inv.label} still works.`, `Switch on the ${lamp.inv.label}.`]);
    this.rule({ on: "control", target: lamp.id, control: "on" }, [{ if: "control", target: lamp.id, control: "on", eq: { lit: true } }],
      [{ do: "overlay", object: lamp.id, overlay: "light_on" }, { do: "overlay", object: target.id, overlay: "glow_mark", text: this.mark(slots) }], s1);
    const s2 = this.step("room_change", thread, target.id, [s1], ["The light changed something.", `Look at the ${target.inv.label} while the ${lamp.inv.label} is on.`, `With the ${lamp.inv.label} on, inspect the ${target.inv.label}.`]);
    this.rule({ on: "inspect", object: target.id }, [{ if: "state", target: lamp.id, key: "on", eq: { lit: true } }],
      [{ do: "show_card", card: this.clue(lamp.variant === "uv" ? "uv" : "lamp", slots) }], s2);
    return s2;
  }

  toolReveal(slots: string[], budget: number, thread: number, depth: number): string | null {
    // No card: a description would only sit beside the torch, repeating it.
    const torch = this.item("tool", this.names.torch, { archetype: "Light", variant: "torch" });
    const up = this.deliver(torch, budget - 1, thread, depth);
    if (!up) return null;
    const source = this.steps.find((s) => s.id === up)?.object;
    const tp = this.pickObject({ trigger: "use", thread, markable: true, preferUsed: true, excludeIds: [source] });
    if (!tp) return null;
    const target = this.bind(tp, thread, "use");
    const s = this.step("tool_reveal", thread, target.id, [up], ["A tool you found shows what eyes can't.", `Something on the ${target.inv.label} only shows under UV.`, `Switch to the UV flashlight and hold it on the ${target.inv.label}.`]);
    this.rule({ on: "use", item: torch, object: target.id }, [],
      [{ do: "overlay", object: target.id, overlay: "glow_mark", text: this.mark(slots) }, { do: "show_card", card: this.clue("uv", slots) }], s);
    return s;
  }

  split(slots: string[], thread: number): string | null {
    // Two halves, told apart by name; no card each (half a note says nothing worth a second card).
    const halves = this.names.halves.map((name) => this.item("half", name));
    const found = halves.map((h) => this.contain({ item: h }, thread));
    if (found.some((s) => !s)) return null;
    const joined = this.item("assembled", this.names.joined, { archetype: "Assemble", card: this.clue("assembled", slots) });
    const s = this.step("split", thread, undefined, found as string[], ["Two pieces belong together.", "You hold both halves of the same thing.",
      `Put the ${this.names.halves[0].replace(/ \(left\)$/, "").toLowerCase()} halves together.`]);
    this.rule({ on: "combine", items: [halves[0], halves[1]] }, [], [{ do: "consume", item: halves[0] }, { do: "consume", item: halves[1] }, ...this.give({ item: joined })], s);
    return s;
  }

  decode(slots: string[], budget: number, thread: number, depth: number): string | null {
    const wheel = this.item("decoder", this.names.wheel, { archetype: "Decoder", controls: [{ id: "offset", domain: { kind: "offset", max: 25 } }] });
    const offset = this.slot("offset", this.mint("offset").value);
    const enc = this.slot("cipher", "?");
    this.ciphers.push({ slot: enc, of: slots, offset: this.slots[offset].value });
    const encStep = this.info([enc], 1, thread, depth + 1);
    const itemStep = encStep && this.deliver(wheel, 1, thread, depth);
    const offStep = itemStep && this.info([offset], budget - 3, thread, depth + 1);
    if (!encStep || !itemStep || !offStep) return null;
    const s = this.step("decode", thread, undefined, [encStep, itemStep, offStep], ["A coded line and a wheel to read it.", "The cipher wheel's ring needs the right offset.", `Set the cipher wheel to {{${offset}}} and read the coded line.`]);
    this.rule({ on: "control", target: wheel, control: "offset" }, [{ if: "control", target: wheel, control: "offset", eq: { slot: offset } }, { if: "solved", step: encStep }],
      [{ do: "show_card", card: this.clue("decoded", slots) }], s);
    return s;
  }
}

const STEP_TITLE: Record<MotifId, string> = {
  read: "Read it", contain: "Look inside", split: "Piece it together", set_state: "Set the mechanism",
  cross_reference: "Find the page", decode: "Decode it", tool_reveal: "Under the light", room_change: "Change the room",
  ordering: "Perform the ritual", contain_lock: "Open the lock", story_fragment: "A keepsake", finale: "The way out",
};

/** Caesar-shift a value's text with the ring offset (digits map onto letters), for the coded card. */
function encipher(text: string, offset: number): string {
  return [...text.toUpperCase()].map((c) => {
    if (c >= "A" && c <= "Z") return String.fromCharCode(65 + ((c.charCodeAt(0) - 65 + offset) % 26));
    if (c >= "0" && c <= "9") return String.fromCharCode(65 + ((Number(c) + offset) % 26));
    return c;
  }).join("");
}

// ---------------------------------------------------------------------------
// Exit and pool
// ---------------------------------------------------------------------------
function chooseExit(objs: InventoryObject[]): InventoryObject | null {
  const doors = objs.filter((o) => o.type === "door" || o.features.includes("is_door")).sort((a, b) => b.salience - a.salience);
  if (doors.length) return doors[0];
  const rank = (o: InventoryObject) => DOOR_FALLBACK_TYPES.indexOf(o.type);
  const fallback = objs.filter((o) => rank(o) >= 0 && o.features.includes("has_doors"))
    .sort((a, b) => rank(a) - rank(b) || b.salience - a.salience);
  return fallback[0] ?? null;
}

export function usableObjects(inventory: InventoryObject[]): InventoryObject[] {
  return inventory.filter((o) => o.salience >= MIN_SALIENCE && isValidBox(o.box));
}

// ---------------------------------------------------------------------------
// One candidate
// ---------------------------------------------------------------------------
interface Candidate { definition: RoomDefinitionV2; secret: RoomSecretV2; summary: PlanSummary }

function permutations<T>(xs: T[]): T[][] {
  return xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

/** How much of `child`'s box lies inside `parent`'s (0..1). */
function insideShare(child: Box1000, parent: Box1000): number {
  const h = Math.max(0, Math.min(child[2], parent[2]) - Math.max(child[0], parent[0]));
  const w = Math.max(0, Math.min(child[3], parent[3]) - Math.max(child[1], parent[1]));
  const area = (child[2] - child[0]) * (child[3] - child[1]);
  return area > 0 ? (h * w) / area : 0;
}
/** A box this much inside a bigger object's is part of it (a safe in a cabinet): as a herring it would only steal its taps. */
const NESTED = 0.6;

function buildCandidate(
  inv: InventoryObject[], exitObj: InventoryObject, mode: Mode, rng: () => number, rint: RandomInt, nThreads: number, trng: () => number,
): Candidate | string {
  const taken = new Set<string>();
  const mk = (o: InventoryObject): Bound => ({ inv: o, id: slugId(o.label, taken), hostable: hostableArchetypes(o), archetype: null, roles: 0, triggers: [], threads: [], initial: {} });
  const exit = mk(exitObj);
  const pool = inv.filter((o) => o !== exitObj).sort((a, b) => b.salience - a.salience).map(mk);
  const B = new Builder(mode, pool, exit, rng, rint, trng);
  const voice = MODE_COPY[mode];

  // Mode skeleton: the finale's inputs become thread goals.
  const lo = 2 * nThreads + 1;
  const target = Math.max(lo, Math.min(STEP_BAND.max, (mode === "noir" ? 7 : 6) + Math.floor(rng() * 3)));
  const budgets = Array(nThreads).fill(2);
  for (let extra = target - 1 - 2 * nThreads; extra > 0; extra--) {
    const open = budgets.map((b, i) => (b < 4 ? i : -1)).filter((i) => i >= 0);
    if (!open.length) break;
    budgets[open[Math.floor(rng() * open.length)]]++;
  }
  const outputs: string[][] = budgets.map(() => []);
  const dealt = (n: number) => { // which thread gets the k-th of n finale inputs: every thread at least one
    const owner = Array.from({ length: n }, (_, k) => k % nThreads);
    for (let i = owner.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [owner[i], owner[j]] = [owner[j], owner[i]]; }
    return owner;
  };

  const positionOwner: number[] = [];   // ritual: the thread whose card gives each position
  let finale: FinaleDef;
  let answer: string;
  let submit: ControlDomain;
  let finaleHint: string;
  let finaleHow: string;
  if (mode === "noir") {
    const wheels = nThreads === 3 || rng() < 0.5 ? 4 : 3;
    let code: string;
    do code = Array.from({ length: wheels }, () => String(rint(10))).join(""); while (isWeakCode(code));
    // Contiguous groups, one per thread, in wheel order.
    const sizes = Array(nThreads).fill(1);
    for (let i = nThreads; i < wheels; i++) sizes[Math.floor(rng() * nThreads)]++;
    const order = dealt(nThreads);
    let at = 0;
    const parts = sizes.map((n, i) => {
      const digits = code.slice(at, at + n);
      // The door's wheels carry these symbols: the player matches each clue to its wheels (never "wheel 1").
      const tag = SYMBOLS.slice(at, at + n).join("");
      at += n;
      const s = B.slot("digits", digits, undefined, { tag });
      outputs[order[i]].push(s);
      return s;
    });
    answer = B.slot("code", code.split("").join("|"), code, undefined, parts);
    finale = { kind: "combination", object: exit.id, wheels, alphabet: "digits" };
    submit = { kind: "wheels", alphabet: "digits", count: wheels };
    finaleHint = `Enter {{${answer}}} on the ${exit.inv.label}.`;
    finaleHow = `Each number you found has symbols beside it; they match the wheels on the ${exit.inv.label}.`;
  } else if (mode === "crime_scene") {
    // A deduction: three named options per question; the evidence rules two out of each, so exactly
    // one suspect, one motive and one method survive. Each true answer is derived from the two
    // eliminations (never written anywhere), and the accusation from the three answers.
    const alibis = B.sample(ALIBIS, 2);
    const pools = [B.sample(SUSPECTS, 3).map((name) => ({ name, ruleOut: "" })), B.sample(MOTIVES, 3), B.sample(METHODS, 3)];
    const dims = pools.map((pool, i) => {
      const options: AccuseOption[] = pool.map(({ name }) => {
        let id: string;
        do id = `${"smx"[i]}_${mintSuffix(rint)}`; while (B.ids.has(id));
        B.ids.add(id);
        return { id, name };
      });
      const right = rint(3);
      const ruledOut = options.flatMap((o, j) => j === right ? [] : [B.slot("option", o.id, o.name, { ruleOut: i === 0 ? alibis.shift()! : pool[j].ruleOut })]);
      return { options, ruledOut, slot: B.slot("option", options[right].id, options[right].name, undefined, ruledOut) };
    });
    const evidence = dims.flatMap((d) => d.ruledOut);
    dealt(evidence.length).forEach((t, k) => outputs[t].push(evidence[k]));
    answer = B.slot("code", dims.map((d) => B.slots[d.slot].value).join("|"), undefined, undefined, dims.map((d) => d.slot));
    finale = { kind: "accusation", object: exit.id, suspects: dims[0].options, motives: dims[1].options, methods: dims[2].options };
    submit = { kind: "accusation" };
    finaleHint = `At the ${exit.inv.label}, accuse {{${dims[0].slot}}}. Motive: {{${dims[1].slot}}}. Method: {{${dims[2].slot}}}.`;
    finaleHow = "Cross off every suspect, motive and method the evidence rules out. One of each is left.";
  } else {
    const length = 3;
    const positions = Array.from({ length }, (_, k) => B.slot("object", "?", undefined, { ordinal: k }));
    const owner = dealt(length);
    owner.forEach((t, k) => outputs[t].push(positions[k]));
    positionOwner.push(...owner);
    answer = B.slot("code", "?", undefined, undefined, positions);
    finale = { kind: "ritual", object: exit.id, length };
    submit = { kind: "sequence", length };
    finaleHint = "";   // named once the ritual's objects are chosen
    finaleHow = "Each fragment you found names one offering and its place in the order. Match what they describe to things in this room.";
  }

  // Threads, grown backwards from their goals.
  const ends: string[] = [];
  for (let t = 0; t < nThreads; t++) {
    const end = B.info(outputs[t], budgets[t], t, 0);
    if (!end) return `thread ${t + 1}: no motif fits the room's objects`;
    ends.push(end);
  }

  // Paranormal: the ritual's objects, preferring ones the threads already used. Cards describe each
  // by what it is ("the face that keeps the hours"), so the player works out which thing is meant: an
  // object whose description would fit two things in the room is left out, and so, where possible, is
  // the object the naming card is found at (a note in a drawer shouldn't point at the drawer).
  if (finale.kind === "ritual") {
    const counts = new Map<string, number>();
    for (const o of inv) {
      const d = describeObject(o.type, o.label);
      if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    const unclear = B.pool.filter((b) => (counts.get(describeObject(b.inv.type, b.inv.label) ?? "") ?? 0) !== 1).map((b) => b.id);
    const names = Object.keys(B.slots).filter((n) => B.slots[n].kind === "object");
    const foundAt = (name: string): string[] => {
      const at = B.steps.find((s) => s.id === ends[positionOwner[B.meta.get(name)?.ordinal ?? 0]])?.object;
      return at ? [at] : [];
    };
    // Fill the positions strictly first (clear descriptions, none found at its own object), trying every
    // order, since an early position can take the only object a later one could use; then relax.
    const fill = (order: string[], level: number): Map<string, Bound> | null => {
      const picked = new Map<string, Bound>();
      for (const name of order) {
        const taken = [...picked.values()].map((c) => c.id);
        const excludeIds = level === 0 ? [...taken, ...unclear, ...foundAt(name)] : level === 1 ? [...taken, ...unclear] : taken;
        const p = B.pickObject({ trigger: "ritual", thread: -1, preferUsed: true, excludeIds });
        if (!p) return null;
        picked.set(name, B.bind(p, -1, "ritual"));
      }
      return picked;
    };
    let picked: Map<string, Bound> | null = null;
    for (let level = 0; level < 3 && !picked; level++) {
      for (const order of permutations(names)) {
        const restore = B.snap();
        picked = fill(order, level);
        if (picked) break;
        restore();
      }
    }
    if (!picked) return "not enough objects for the ritual";
    const chosen = names.map((n) => picked!.get(n)!);
    for (const [name, b] of picked) {
      const described = unclear.includes(b.id) ? null : describeObject(b.inv.type, b.inv.label);
      B.slots[name] = { kind: "object", value: b.id, text: described ?? `the ${b.inv.label}` };
    }
    B.slots[answer] = { ...B.slots[answer], value: chosen.map((c) => c.id).join("|") };
    // The last rung may give the answer: plainly, by name.
    finaleHint = `At the ${exit.inv.label}, perform the ritual in order: ${chosen.map((c) => `the ${c.inv.label}`).join(", ")}.`;
  }
  for (const c of B.ciphers) B.slots[c.slot].value = encipher(c.of.map((s) => B.slots[s].text ?? B.slots[s].value).join(" "), Number(c.offset));

  const fin = B.step(finale.kind === "ritual" ? "ordering" : "finale", null, exit.id, ends,
    ["Everything you've learned ends at the way out.", finaleHow, finaleHint]);
  B.rule({ on: "submit", object: exit.id }, [{ if: "submitted", eq: { slot: answer } }],
    [{ do: "open", object: exit.id }, { do: "beat", text: voice.beat }, { do: "complete" }], fin);

  // Optional extras: a story fragment, and at most one removable small object.
  if (rng() < 0.6) {
    const restore = B.snap();
    const keepsake = B.pick(KEEPSAKES[mode]);
    if (!B.contain({ card: B.plainCard(keepsake.title, keepsake.lead) }, -2, true)) restore();
  }
  const portable = B.pool.filter((b) => b.roles === 0 && isPortableType(b.inv.type) && categoryOf(b.inv.type) !== "textile" &&
    b.inv.fully_visible && boxArea(b.inv.box) <= 0.08 && b.inv.salience >= 0.2);
  if (portable.length && rng() < 0.75) {
    const b = portable[0];
    B.removable = b;
    b.roles = 1;
    const taken = B.item("taken", capitalise(b.inv.label));
    const s = B.step("story_fragment", null, b.id, [], ["Small things can be taken.", `The ${b.inv.label} looks portable.`, `Take the ${b.inv.label}.`], true);
    B.rule({ on: "control", target: b.id, control: "taken" }, [{ if: "control", target: b.id, control: "taken", eq: { lit: true } }],
      [...B.give({ item: taken }), { do: "overlay", object: b.id, overlay: "object_removed" }, { do: "set_state", target: b.id, key: "removed", value: true }], s);
  }

  // Compile.
  const used = B.pool.filter((b) => b.roles > 0);
  const nested = (b: Bound) => [exit, ...used].some((u) => u.inv.photo_index === b.inv.photo_index && boxArea(u.inv.box) > boxArea(b.inv.box) &&
    insideShare(b.inv.box, u.inv.box) >= NESTED);
  const herrings = B.pool.filter((b) => b.roles === 0 && !nested(b)).slice(0, Math.max(0, MAX_OBJECTS - 1 - used.length));
  for (const h of herrings) {
    const c = h.hostable.find((x) => CONTAINERS.includes(x.archetype));
    if (c) { h.archetype = c.archetype; h.variant = c.variant; }
  }
  exit.archetype = "Door";
  exit.variant = finale.kind;
  const toDef = (b: Bound): ObjectDef => {
    const v = b.archetype ? variantSpec(b.archetype, b.variant) : null;
    const r = boxToRect(b.inv.box);
    const removable = b === B.removable;
    return {
      id: b.id, photo_index: b.inv.photo_index, box: { x: r.x, y: r.y, w: r.w, h: r.h }, label: b.inv.label, type: b.inv.type,
      archetype: b.archetype, ...(b.variant ? { variant: b.variant } : {}),
      controls: [...(v?.controls ?? []), ...(removable ? [{ id: "taken", domain: { kind: "bool" } } as const] : [])],
      ...(b === exit ? { submit, exit: true } : v?.submit ? { submit: v.submit } : {}),
      initial: { ...(v?.initial ?? {}), ...b.initial, ...(removable ? { taken: false } : {}) },
      ...(removable ? { removable: true } : {}),
    };
  };
  const objects = [exit, ...used, ...herrings].map(toDef);
  const definition: RoomDefinitionV2 = {
    schema_version: 2, mode,
    title: B.pick(voice.titles),
    objective: voice.objective(exit.inv.label),
    objects, items: B.items, cards: B.cards, finale,
  };
  const secret: RoomSecretV2 = { schema_version: 2, slots: B.slots, rules: B.rules, steps: B.steps, ending: B.pick(voice.endings) };

  const errors = validateDefinition(definition, secret);
  if (errors.length) return `invalid: ${errors[0]}`;

  // Structural pacing (the simulator later confirms it on the real state space).
  const required = B.steps.filter((s) => !s.optional);
  const perObject = new Map<string, number>();
  for (const s of required) if (s.object) perObject.set(s.object, (perObject.get(s.object) ?? 0) + 1);
  const revisits = [...perObject.values()].filter((k) => k >= 2).length;
  const roomChanges = B.rules.filter((r) => r.step && required.some((s) => s.id === r.step) && r.effects.some((e) => e.do === "overlay")).length;
  if (required.length < STEP_BAND.min || required.length > STEP_BAND.max) return `steps: ${required.length} outside ${STEP_BAND.min}-${STEP_BAND.max}`;
  if (revisits < 1) return "no revisit";
  if (roomChanges < 1) return "no room change";

  const byId = new Map([exit, ...B.pool].map((b) => [b.id, b]));
  const photos = new Set(required.flatMap((s) => (s.object ? [byId.get(s.object)!.inv.photo_index] : []))).size;
  const allPhotos = new Set(inv.map((o) => o.photo_index)).size;
  const motifs = required.map((s) => s.motif);
  const openings = required.filter((s) => s.requires.length === 0).length;
  const score = 2 * (photos / Math.min(allPhotos, 4)) + used.reduce((a, b) => a + b.inv.salience, 0) / Math.max(1, used.length) +
    0.4 * new Set(motifs).size + 0.5 * Math.min(revisits, 2) + 0.3 * Math.min(roomChanges, 3) + 0.3 * Math.min(openings, 3) -
    0.5 * Math.abs(required.length - (mode === "noir" ? 8 : 7));
  return { definition, secret, summary: { threads: nThreads, motifs, objectsUsed: used.length + 1, photos, score, candidatesTried: 0 } };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
/** The exit the planner would use and the objects that can carry a thread (host a mechanism or hold a prop). */
export function analyzeInventory(inventory: InventoryObject[]): { usable: InventoryObject[]; exit: InventoryObject | null; interactive: number } {
  const usable = usableObjects(inventory);
  const exit = chooseExit(usable);
  const interactive = usable.filter((o) => o !== exit && hostableArchetypes(o).some((h) => h.archetype !== "Door")).length;
  return { usable, exit, interactive };
}

export function planRoom(inventory: InventoryObject[], opts: PlanOptions): PlanResult {
  const { usable: objs, exit, interactive: poolSize } = analyzeInventory(inventory);
  if (!exit) return { ok: false, reason: "no_exit", detail: "no door, wardrobe or cabinet with doors to use as the way out" };
  if (poolSize < MIN_POOL) return { ok: false, reason: "too_few_objects", detail: `${poolSize} interactive objects besides the exit; at least ${MIN_POOL} are needed` };

  const rint = opts.randomInt ?? cryptoInt;
  const n = opts.candidates ?? 8;
  const failures = new Map<string, number>();
  const fail = (r: string) => { const k = r.replace(/[0-9]+/g, "#"); failures.set(k, (failures.get(k) ?? 0) + 1); };
  // Build structural candidates, then simulate them best-first; the first that the simulator proves wins.
  for (let round = 0; round < 3; round++) {
    const built: Candidate[] = [];
    for (let c = round * n; c < (round + 1) * n; c++) {
      const rng = seededRandom(`${opts.seed}:${opts.mode}:${c}`);
      const threads = poolSize >= THREE_THREAD_POOL && c % 3 !== 2 ? 3 : 2;
      const r = buildCandidate(objs, exit, opts.mode, rng, rint, threads, seededRandom(`${opts.seed}:${opts.mode}:${c}:text`));
      if (typeof r === "string") fail(r); else built.push(r);
    }
    built.sort((a, b) => b.summary.score - a.summary.score);
    for (const cand of built) {
      const report = simulate(cand.definition, cand.secret);
      if (!report.ok) { fail(`simulation: ${report.errors[0]}`); continue; }
      return { ok: true, ...cand, report, summary: { ...cand.summary, candidatesTried: (round + 1) * n } };
    }
  }
  const top = [...failures].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
  return poolSize < THREE_THREAD_POOL
    ? { ok: false, reason: "too_few_objects", detail: `only ${poolSize} interactive objects besides the exit and no plan fits (${top}); add a close photo of a desk or shelf` }
    : { ok: false, reason: "no_valid_plan", detail: top };
}
