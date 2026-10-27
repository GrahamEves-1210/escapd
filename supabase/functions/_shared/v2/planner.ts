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
import { boxArea, boxToRect, isValidBox } from "../geometry.ts";
import { cryptoInt, isWeakCode, mintSuffix, type RandomInt, slugId } from "../mint.ts";
import { type ArchetypeId, type ControlDomain, DOOR_FALLBACK_TYPES, hostableArchetypes, isMarkable, SYMBOLS, variantSpec } from "./archetypes.ts";
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
const VERB: Partial<Record<ArchetypeId, string>> = { Drawer: "Open", LiftUnder: "Lift", FrameTilt: "Tilt" };
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

class Builder {
  slots: Record<string, SlotValue> = {};
  labels = new Map<string, string>();
  items: ItemDef[] = [];
  cards: CardDef[] = [];
  rules: Rule[] = [];
  steps: StepDef[] = [];
  used: Partial<Record<MotifId, number>> = {};
  values = new Set<string>();
  ciphers: { slot: string; of: string[]; offset: string }[] = [];
  removable: Bound | null = null;
  ids = new Set<string>();

  constructor(public mode: Mode, public pool: Bound[], public exit: Bound, public rng: () => number, public rint: RandomInt) {}

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
  pick(w: Want): { b: Bound; archetype?: ArchetypeId; variant?: string } | null {
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
  slot(kind: SlotKind, value: string, text?: string, label?: string, from?: string[]): string {
    const name = `${kind}_${Object.keys(this.slots).length + 1}`;
    this.slots[name] = { kind, value, ...(text !== undefined && text !== value ? { text } : {}), ...(from ? { from } : {}) };
    if (label) this.labels.set(name, label);
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

  /** What a glow mark says: each slot as written on the object (its door symbol first, if any), nothing more. */
  mark(slots: string[]): string {
    return slots.map((s) => `${this.labels.has(s) && /^[^A-Za-z]+$/.test(this.labels.get(s)!) ? `${this.labels.get(s)} ` : ""}{{${s}}}`).join("  ");
  }

  card(title: string, slots: string[], flavour?: string): string {
    const id = `card_${this.cards.length + 1}`;
    const text = slots.length ? slots.map((s) => `${this.labels.get(s) ?? LABEL[this.slots[s].kind]}: {{${s}}}`).join("\n") : flavour ?? "";
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

  note(slots: string[]): string {
    return this.item("prop", "note", { card: this.card("Note", slots) });
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
    const title = depth === 0 ? "A lead" : "A clue";
    return this.choose([
      { motif: "read", min: 1, fixed: true, run: () => this.read(slots, thread, title) },
      { motif: "contain", min: 1, fixed: true, run: () => this.contain(this.note(slots), thread) },
      { motif: "contain_lock", min: 2, fixed: false, run: () => this.lockedContain(this.note(slots), budget, thread, depth) },
      { motif: "set_state", min: 2, fixed: false, run: () => this.setState(slots, null, budget, thread, depth) },
      { motif: "cross_reference", min: 2, fixed: false, run: () => this.crossReference(slots, budget, thread, depth) },
      { motif: "room_change", min: 2, fixed: true, run: () => this.roomChange(slots, thread) },
      { motif: "tool_reveal", min: 2, fixed: false, run: () => this.toolReveal(slots, budget, thread, depth) },
      { motif: "split", min: 3, fixed: true, run: () => this.split(slots, thread) },
      { motif: "decode", min: 4, fixed: false, run: () => this.decode(slots, budget, thread, depth) },
    ], budget, depth);
  }

  /** A step whose firing grants `item`. */
  deliver(item: string, budget: number, thread: number, depth: number): string | null {
    return this.choose([
      { motif: "contain", min: 1, fixed: true, run: () => this.contain(item, thread) },
      { motif: "contain_lock", min: 2, fixed: false, run: () => this.lockedContain(item, budget, thread, depth) },
      { motif: "set_state", min: 2, fixed: false, run: () => this.setState([], item, budget, thread, depth) },
    ], budget, depth + 1);
  }

  read(slots: string[], thread: number, title: string): string | null {
    const p = this.pick({ trigger: "inspect", thread, accept: (a, v) => a === "Readable" && v === "card" });
    if (!p) return null;
    const b = this.bind(p, thread, "inspect");
    const card = this.card(title, slots);
    const s = this.step("read", thread, b.id, [], ["Some things here are meant to be read.", `Take a closer look at the ${b.inv.label}.`, `Read the ${b.inv.label}.`]);
    this.rule({ on: "inspect", object: b.id }, [], [{ do: "show_card", card }], s);
    return s;
  }

  contain(item: string, thread: number, optional = false): string | null {
    const p = this.pick({ trigger: "contain", thread, accept: (a) => CONTAINERS.includes(a) });
    if (!p) return null;
    const b = this.bind(p, thread, "contain");
    const control = CONTAINER_CONTROL[b.archetype!]!;
    const label = b.inv.label;
    const s = this.step(optional ? "story_fragment" : "contain", optional ? null : thread, b.id, [],
      ["Not everything is on the surface.", `The ${label} could hide something.`, `${VERB[b.archetype!]} the ${label}.`], optional);
    this.rule({ on: "control", target: b.id, control }, [{ if: "control", target: b.id, control, eq: { lit: true } }], this.grant(item), s);
    return s;
  }

  grant(item: string): Effect[] {
    const card = this.items.find((i) => i.id === item)?.card;
    return [{ do: "grant", item }, ...(card ? [{ do: "show_card", card } as Effect] : [])];
  }

  lockedContain(item: string, budget: number, thread: number, depth: number): string | null {
    const byKey = () => {
      const p = this.pick({ trigger: "contain", thread, accept: (a) => a === "Drawer" });
      if (!p) return null;
      const b = this.bind(p, thread, "contain", "use");
      b.initial.locked = true;
      const key = this.item("key", "small key");
      const up = this.deliver(key, budget - 1, thread, depth);
      if (!up) return null;
      const s = this.step("contain_lock", thread, b.id, [up], ["Something here is locked.", `The ${b.inv.label} is locked; a key must be somewhere.`, `Use the small key on the ${b.inv.label}.`]);
      this.rule({ on: "use", item: key, object: b.id }, [], [{ do: "open", object: b.id }, { do: "consume", item: key }, ...this.grant(item)], s);
      return s;
    };
    const byCode = () => {
      const p = this.pick({ trigger: "contain", thread, accept: (a) => a === "CombinationLock" });
      if (!p) return null;
      const b = this.bind(p, thread, "contain", "submit");
      const m = this.mint(b.variant as "digits" | "letters" | "symbols");
      const code = this.slot("code", m.value, m.text, `Lock on the ${b.inv.label}`);
      const up = this.info([code], budget - 1, thread, depth + 1);
      if (!up) return null;
      const s = this.step("contain_lock", thread, b.id, [up], ["One lock here wants a code.", `The ${b.inv.label} has a three-wheel lock; the code is written somewhere.`, `Enter {{${code}}} on the ${b.inv.label}.`]);
      this.rule({ on: "submit", object: b.id }, [{ if: "submitted", eq: { slot: code } }],
        [{ do: "open", object: b.id }, { do: "overlay", object: b.id, overlay: "panel_open" }, ...this.grant(item)], s);
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
  setState(slots: string[], item: string | null, budget: number, thread: number, depth: number): string | null {
    const p = this.pick({ trigger: "set", thread, accept: (a) => a === "ClockHands" || (!item && a === "TuningDial") });
    if (!p) return null;
    const b = this.bind(p, thread, "set");
    const clock = b.archetype === "ClockHands";
    const kind = clock ? "time" : "freq";
    const m = this.mint(kind);
    const input = this.slot(kind, m.value, undefined, clock ? `Time for the ${b.inv.label}` : `Frequency for the ${b.inv.label}`);
    if (clock) b.initial.time = this.mint("time").value;
    const up = this.info([input], budget - 1, thread, depth + 1);
    if (!up) return null;
    const control = clock ? "time" : "freq";
    const payload = item ?? (clock ? this.note(slots) : null);
    const effects: Effect[] = clock
      ? [{ do: "set_state", target: b.id, key: "panel", value: true }, { do: "overlay", object: b.id, overlay: "panel_open" }, ...this.grant(payload!)]
      : [{ do: "show_card", card: this.card("On the air", slots) }];
    const s = this.step("set_state", thread, b.id, [up], [
      clock ? "A stopped clock is waiting for the right time." : "Something in the room can be tuned.",
      clock ? `The ${b.inv.label}'s hands can be moved.` : `The ${b.inv.label} has a dial; a frequency is written somewhere.`,
      clock ? `Set the ${b.inv.label} to {{${input}}}.` : `Tune the ${b.inv.label} to {{${input}}}.`,
    ]);
    this.rule({ on: "control", target: b.id, control }, [{ if: "control", target: b.id, control, eq: { slot: input } }], effects, s);
    return s;
  }

  crossReference(slots: string[], budget: number, thread: number, depth: number): string | null {
    const p = this.pick({ trigger: "set", thread, accept: (a, v) => a === "Readable" && v === "pages" });
    if (!p) return null;
    const b = this.bind(p, thread, "set");
    const page = this.slot("page", this.mint("page").value, undefined, `Page in the ${b.inv.label}`);
    const up = this.info([page], budget - 1, thread, depth + 1);
    if (!up) return null;
    const s = this.step("cross_reference", thread, b.id, [up], ["One clue points into a book.", `A page number matters in the ${b.inv.label}.`, `Turn the ${b.inv.label} to page {{${page}}}.`]);
    this.rule({ on: "control", target: b.id, control: "page" }, [{ if: "control", target: b.id, control: "page", eq: { slot: page } }],
      [{ do: "show_card", card: this.card("Between the pages", slots) }, { do: "overlay", object: b.id, overlay: "pinned_card" }], s);
    return s;
  }

  roomChange(slots: string[], thread: number): string | null {
    const lp = this.pick({ trigger: "set", thread, accept: (a, v) => a === "Light" && v !== "torch" });
    if (!lp) return null;
    const lamp = this.bind(lp, thread, "set");
    const tp = this.pick({ trigger: "inspect", thread, markable: true, preferUsed: true, samePhotoAs: lamp, excludeIds: [lamp.id] });
    if (!tp) return null;
    const target = this.bind(tp, thread, "inspect");
    const s1 = this.step("room_change", thread, lamp.id, [], ["The room is darker than it should be.", `The ${lamp.inv.label} still works.`, `Switch on the ${lamp.inv.label}.`]);
    this.rule({ on: "control", target: lamp.id, control: "on" }, [{ if: "control", target: lamp.id, control: "on", eq: { lit: true } }],
      [{ do: "overlay", object: lamp.id, overlay: "light_on" }, { do: "overlay", object: target.id, overlay: "glow_mark", text: this.mark(slots) }], s1);
    const s2 = this.step("room_change", thread, target.id, [s1], ["The light changed something.", `Look at the ${target.inv.label} while the ${lamp.inv.label} is on.`, `With the ${lamp.inv.label} on, inspect the ${target.inv.label}.`]);
    this.rule({ on: "inspect", object: target.id }, [{ if: "state", target: lamp.id, key: "on", eq: { lit: true } }],
      [{ do: "show_card", card: this.card("In the light", slots) }], s2);
    return s2;
  }

  toolReveal(slots: string[], budget: number, thread: number, depth: number): string | null {
    const torch = this.item("tool", "UV flashlight", { archetype: "Light", variant: "torch", card: this.card("UV flashlight", [], "A small flashlight with a violet bulb. Tap it to switch your light over, then sweep the room.") });
    const up = this.deliver(torch, budget - 1, thread, depth);
    if (!up) return null;
    const source = this.steps.find((s) => s.id === up)?.object;
    const tp = this.pick({ trigger: "use", thread, markable: true, preferUsed: true, excludeIds: [source] });
    if (!tp) return null;
    const target = this.bind(tp, thread, "use");
    const s = this.step("tool_reveal", thread, target.id, [up], ["A tool you found shows what eyes can't.", `Something on the ${target.inv.label} only shows under UV.`, `Switch to the UV flashlight and hold it on the ${target.inv.label}.`]);
    this.rule({ on: "use", item: torch, object: target.id }, [],
      [{ do: "overlay", object: target.id, overlay: "glow_mark", text: this.mark(slots) }, { do: "show_card", card: this.card("Under UV", slots) }], s);
    return s;
  }

  split(slots: string[], thread: number): string | null {
    const halves = [0, 1].map(() => this.item("half", "torn half", { card: this.card("Torn half", [], "Half of something. The other half can't be far.") }));
    const found = halves.map((h) => this.contain(h, thread));
    if (found.some((s) => !s)) return null;
    const joined = this.item("assembled", "joined halves", { archetype: "Assemble", card: this.card("Pieced together", slots) });
    const s = this.step("split", thread, undefined, found as string[], ["Two pieces belong together.", "You hold both halves of the same thing.", "Combine the two torn halves."]);
    this.rule({ on: "combine", items: [halves[0], halves[1]] }, [], [{ do: "consume", item: halves[0] }, { do: "consume", item: halves[1] }, ...this.grant(joined)], s);
    return s;
  }

  decode(slots: string[], budget: number, thread: number, depth: number): string | null {
    const wheel = this.item("decoder", "cipher wheel", { archetype: "Decoder", controls: [{ id: "offset", domain: { kind: "offset", max: 25 } }] });
    const offset = this.slot("offset", this.mint("offset").value, undefined, "Cipher ring");
    const enc = this.slot("cipher", "?", undefined, "Coded line");
    this.ciphers.push({ slot: enc, of: slots, offset: this.slots[offset].value });
    const encStep = this.info([enc], 1, thread, depth + 1);
    const itemStep = encStep && this.deliver(wheel, 1, thread, depth);
    const offStep = itemStep && this.info([offset], budget - 3, thread, depth + 1);
    if (!encStep || !itemStep || !offStep) return null;
    const s = this.step("decode", thread, undefined, [encStep, itemStep, offStep], ["A coded line and a wheel to read it.", "The cipher wheel's ring needs the right offset.", `Set the cipher wheel to {{${offset}}} and read the coded line.`]);
    this.rule({ on: "control", target: wheel, control: "offset" }, [{ if: "control", target: wheel, control: "offset", eq: { slot: offset } }, { if: "solved", step: encStep }],
      [{ do: "show_card", card: this.card("Decoded", slots) }], s);
    return s;
  }
}

const LABEL: Record<SlotKind, string> = {
  time: "Time", freq: "Frequency", page: "Page", offset: "Offset", digits: "Digits", letters: "Word", symbols: "Symbols",
  cipher: "Coded line", option: "Evidence", object: "Ritual", code: "Code",
};

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

function buildCandidate(inv: InventoryObject[], exitObj: InventoryObject, mode: Mode, rng: () => number, rint: RandomInt, nThreads: number): Candidate | string {
  const taken = new Set<string>();
  const mk = (o: InventoryObject): Bound => ({ inv: o, id: slugId(o.label, taken), hostable: hostableArchetypes(o), archetype: null, roles: 0, triggers: [], threads: [], initial: {} });
  const exit = mk(exitObj);
  const pool = inv.filter((o) => o !== exitObj).sort((a, b) => b.salience - a.salience).map(mk);
  const B = new Builder(mode, pool, exit, rng, rint);

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

  let finale: FinaleDef;
  let answer: string;
  let submit: ControlDomain;
  let finaleHint: string;
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
      const label = SYMBOLS.slice(at, at + n).join("");
      at += n;
      const s = B.slot("digits", digits, undefined, label);
      outputs[order[i]].push(s);
      return s;
    });
    answer = B.slot("code", code.split("").join("|"), code, undefined, parts);
    finale = { kind: "combination", object: exit.id, wheels, alphabet: "digits" };
    submit = { kind: "wheels", alphabet: "digits", count: wheels };
    finaleHint = `Enter {{${answer}}} on the ${exit.inv.label}.`;
  } else if (mode === "crime_scene") {
    const dims = (["suspect", "motive", "method"] as const).map((d, i) => {
      const options: AccuseOption[] = ["A", "B", "C"].map((x) => {
        let id: string;
        do id = `${"smx"[i]}_${mintSuffix(rint)}`; while (B.ids.has(id));
        B.ids.add(id);
        return { id, name: `${d[0].toUpperCase()}${d.slice(1)} ${x}` };
      });
      const right = options[rint(3)];
      return { options, slot: B.slot("option", right.id, right.name, d[0].toUpperCase() + d.slice(1)) };
    });
    dealt(3).forEach((t, k) => outputs[t].push(dims[k].slot));
    answer = B.slot("code", dims.map((d) => B.slots[d.slot].value).join("|"), undefined, undefined, dims.map((d) => d.slot));
    finale = { kind: "accusation", object: exit.id, suspects: dims[0].options, motives: dims[1].options, methods: dims[2].options };
    submit = { kind: "accusation" };
    finaleHint = `Accuse {{${dims[0].slot}}}, for {{${dims[1].slot}}}, by {{${dims[2].slot}}}.`;
  } else {
    const length = 3;
    const positions = Array.from({ length }, (_, k) => B.slot("object", "?", undefined, `Ritual, step ${k + 1}`));
    dealt(length).forEach((t, k) => outputs[t].push(positions[k]));
    answer = B.slot("code", "?", undefined, undefined, positions);
    finale = { kind: "ritual", object: exit.id, length };
    submit = { kind: "sequence", length };
    finaleHint = `At the ${exit.inv.label}, perform the ritual in order: {{${positions[0]}}}, {{${positions[1]}}}, {{${positions[2]}}}.`;
  }

  // Threads, grown backwards from their goals.
  const ends: string[] = [];
  for (let t = 0; t < nThreads; t++) {
    const end = B.info(outputs[t], budgets[t], t, 0);
    if (!end) return `thread ${t + 1}: no motif fits the room's objects`;
    ends.push(end);
  }

  // Paranormal: the ritual's objects, preferring ones the threads already used.
  if (finale.kind === "ritual") {
    const chosen: Bound[] = [];
    for (const name of Object.keys(B.slots).filter((n) => B.slots[n].kind === "object")) {
      const p = B.pick({ trigger: "ritual", thread: -1, preferUsed: true, excludeIds: chosen.map((c) => c.id) });
      if (!p) return "not enough objects for the ritual";
      const b = B.bind(p, -1, "ritual");
      chosen.push(b);
      B.slots[name] = { kind: "object", value: b.id, text: `the ${b.inv.label}` };
    }
    B.slots[answer] = { ...B.slots[answer], value: chosen.map((c) => c.id).join("|") };
  }
  for (const c of B.ciphers) B.slots[c.slot].value = encipher(c.of.map((s) => B.slots[s].text ?? B.slots[s].value).join(" "), Number(c.offset));

  const fin = B.step(finale.kind === "ritual" ? "ordering" : "finale", null, exit.id, ends,
    ["Everything you've learned ends at the way out.", `The ${exit.inv.label} needs one answer from every lead.`, finaleHint]);
  B.rule({ on: "submit", object: exit.id }, [{ if: "submitted", eq: { slot: answer } }],
    [{ do: "open", object: exit.id }, { do: "beat", text: "The way out gives." }, { do: "complete" }], fin);

  // Optional extras: a story fragment, and at most one removable small object.
  if (rng() < 0.6) {
    const restore = B.snap();
    const frag = B.item("prop", "keepsake", { card: B.card("Keepsake", [], "Something personal, kept out of sight.") });
    if (!B.contain(frag, -2, true)) restore();
  }
  const portable = B.pool.filter((b) => b.roles === 0 && isPortableType(b.inv.type) && categoryOf(b.inv.type) !== "textile" &&
    b.inv.fully_visible && boxArea(b.inv.box) <= 0.08 && b.inv.salience >= 0.2);
  if (portable.length && rng() < 0.75) {
    const b = portable[0];
    B.removable = b;
    b.roles = 1;
    const taken = B.item("taken", b.inv.label, { card: B.card(b.inv.label, [], "You pocket it. It might mean something to someone.") });
    const s = B.step("story_fragment", null, b.id, [], ["Small things can be taken.", `The ${b.inv.label} looks portable.`, `Take the ${b.inv.label}.`], true);
    B.rule({ on: "control", target: b.id, control: "taken" }, [{ if: "control", target: b.id, control: "taken", eq: { lit: true } }],
      [...B.grant(taken), { do: "overlay", object: b.id, overlay: "object_removed" }, { do: "set_state", target: b.id, key: "removed", value: true }], s);
  }

  // Compile.
  const used = B.pool.filter((b) => b.roles > 0);
  const herrings = B.pool.filter((b) => b.roles === 0).slice(0, Math.max(0, MAX_OBJECTS - 1 - used.length));
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
    title: MODE_TEXT[mode].title,
    objective: MODE_TEXT[mode].objective(exit.inv.label),
    objects, items: B.items, cards: B.cards, finale,
  };
  const secret: RoomSecretV2 = { schema_version: 2, slots: B.slots, rules: B.rules, steps: B.steps, ending: MODE_TEXT[mode].ending };

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

const MODE_TEXT: Record<Mode, { title: string; objective: (exit: string) => string; ending: string }> = {
  noir: { title: "The Locked Room", objective: (e) => `Find the combination and open the ${e}.`, ending: "The lock gives. Case closed." },
  crime_scene: { title: "The Scene", objective: (e) => `Work out who did it, why and how, and name them at the ${e}.`, ending: "The accusation holds. Case closed." },
  paranormal: { title: "The Presence", objective: (e) => `Learn the ritual's order and perform it at the ${e}.`, ending: "The room goes still. It's over." },
};

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
      const r = buildCandidate(objs, exit, opts.mode, rng, rint, threads);
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
