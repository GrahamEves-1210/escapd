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
  ALIBIS, capitalise, caseLabel, describeObject, DURATIONS, type Evidence, type Frame, ITEM_NAMES, KEEPSAKES, type Medium, METHODS, MODE_COPY, MOTIVES,
  NARROWED_DEATH, optionEvidence, orderLine, orderMark, PARTIAL_ALIBIS, partialEvidence, type Pick, placeLine, suspectEvidence, SUSPECTS, TIME_DOCS, TIME_OF_DEATH, TIME_REL_LEAD,
  type TimeDoc, TRACE_BEATS, TRACE_HERRINGS, TRACE_LABELS, TRACE_REPORTS, TRACE_VALUE, VICTIMS, writeCard,
} from "./copy.ts";
import { MOTIFS } from "./motifs.ts";
import { simulate, type SimReport } from "./simulate.ts";
import { TRACE_SURFACES, traceSiteOk } from "./traces.ts";
import { categoryOf, type InventoryObject, isPortableType, type ObjectCategory } from "./taxonomy.ts";
import {
  type AccuseOption, type CardDef, type Condition, type Effect, type FinaleDef, type ItemDef, type Mode, type MotifId, type ObjectDef, ORDER_RULES,
  orderHolds, type OrderRule, type Rect, type RoomDefinitionV2, type RoomSecretV2, type Rule, type SlotKind, type SlotValue, type StateValue, type StepDef,
  type TraceKind, type TraceSpec, type Trigger,
} from "./types.ts";
import { slotRefs, validateDefinition, wordClashes } from "./validate.ts";

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
/** What a flashlight can't hide under: an ornament, a mug, a plant pot. */
const SMALL_UNDER: ObjectCategory[] = ["decor", "plant"];
const CONTAINER_CONTROL: Partial<Record<ArchetypeId, string>> = { Drawer: "open", LiftUnder: "lifted", FrameTilt: "tilted" };
/** The last hint rung's verb for finding something in a container. */
const verb = (b: Bound) => (b.archetype === "Drawer" ? (b.variant === "drawer" ? "Pull out" : "Open") : b.archetype === "LiftUnder" ? "Lift" : "Tilt");
/** "the drawer", or "a drawer of the desk" when the object is the furniture around it. */
const target = (b: Bound) => (b.archetype === "Drawer" && b.variant === "drawer" && !/\bdrawers?\b/i.test(b.inv.label) ? `a drawer of the ${b.inv.label}` : `the ${b.inv.label}`);
/** Kinds whose card lines are whole sentences (crime-scene evidence, ritual fragments). */
const LIST_KINDS: SlotKind[] = ["option", "object"];
/** Crime scene: the hours around a death "close to midnight". */
const DEATH_HOURS = [10, 11, 12, 1];
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
  /** Beyond the archetype: whether this object, hosting it, makes sense for what it holds. */
  fits?: (b: Bound, a: ArchetypeId) => boolean;
  /** Only objects like this (a mirror), whatever they host. */
  where?: (b: Bound) => boolean;
}

interface Option { motif: MotifId; min: number; fixed: boolean; run: () => string | null }

interface SlotMeta {
  tag?: string;          // digits: the door wheels' symbols they belong on
  ordinal?: number;      // object: the ritual position (0-based)
  order?: OrderRule;     // object: what its fragment says about that position
  evidence?: Evidence;   // option: the document (or UV forensics) that rules it out, with {{s}} for its name
  time?: TimeDoc;        // time: the document it is written on (a ticket), and how it reads elsewhere
  after?: string;        // a sentence the card showing this slot ends with (a time's second fact, when on the same card)
}

/** A UV trace placed on the photo: on or beside a real object (`anchor`), or on the floor by it. */
interface Trace {
  id: string;
  kind: TraceKind;
  anchor: string;            // the anchor's id (Bounds are copied on rollback, so never held by reference)
  photo: number;
  surface: TraceSpec["surface"];
  rect: Rect;
  where: string;             // "the wall beside the bookshelf"
  label: string;
  seed: number;
  /** It carries a value (else it leads nowhere). */
  lead: boolean;
}

const TRACE_SIZE: Record<TraceKind, [number, number]> = {
  prints: [0.12, 0.09], palm: [0.13, 0.14], writing: [0.28, 0.09], stain: [0.18, 0.11], footprints: [0.36, 0.2],
};
/** At most this many traces carry one step's values (one each); more and the plain glow mark is used. */
const MAX_TRACES = 3;

const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const listOf = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * What a step hands over: an item into the hand, or a card to read where it was found (`note`: writing
 * with these slots, `plain`: a fixed card such as a keepsake; both written once the place is known, so
 * the card can say where it was).
 */
type Payload = { item: string } | { card: string } | { note: string[] } | { plain: Frame };

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
  /** UV traces on the photos. */
  traces: Trace[] = [];
  /** Objects waiting on the value an info step is being built for: a trace's report must not name them. */
  consumers: Bound[] = [];
  /** Ritual positions whose card names an object (a trace's "the floor by the rug"): never that object. */
  namedAt = new Map<string, string[]>();

  /** Text choices draw from their own stream, so wording never changes a room's structure. */
  pick: Pick;
  /** `pick`, preferring an entry no card has used yet. */
  fresh: Pick;
  /** UV finds glow on objects rather than as traces on the photo (the last round of candidates). */
  glowFirst = false;
  /** The room's one reveal tool (seeded per room, so UV is one tool among several): "any" lifts the limit. */
  tool: RevealTool | "any" = "any";
  names: (typeof ITEM_NAMES)[Mode];

  constructor(public mode: Mode, public pool: Bound[], public exit: Bound, public rng: () => number, public rint: RandomInt, public trng: () => number) {
    this.pick = <T>(xs: readonly T[]): T => xs[Math.floor(this.trng() * xs.length)];
    this.names = ITEM_NAMES[mode];
    // Card words prefer what the room hasn't said yet: no two cards with one title, no place line twice.
    this.fresh = <T>(xs: readonly T[]): T => {
      const said = (x: T) => typeof x === "string" ? this.cards.some((c) => c.text.includes(x))
        : typeof (x as { title?: unknown })?.title === "string" && this.cards.some((c) => c.title === (x as { title: string }).title);
      const unsaid = xs.filter((x) => !said(x));
      return this.pick(unsaid.length ? unsaid : xs);
    };
  }

  /** `n` distinct entries of `xs`, in a seeded order. */
  sample<T>(xs: readonly T[], n: number): T[] {
    const pool = [...xs];
    return Array.from({ length: Math.min(n, pool.length) }, () => pool.splice(Math.floor(this.trng() * pool.length), 1)[0]);
  }

  snap(): () => void {
    const pool = this.pool.map((b) => ({ ...b, triggers: [...b.triggers], threads: [...b.threads], initial: { ...b.initial } }));
    const [slots, used, values, ciphers, ids] = [{ ...this.slots }, { ...this.used }, new Set(this.values), [...this.ciphers], new Set(this.ids)];
    const n = [this.items.length, this.rules.length, this.steps.length, this.traces.length];
    const named = new Map(this.namedAt);
    const meta = new Map(this.meta);
    // Cards are copied whole: a time's second fact may be added to a card written earlier.
    const cards = this.cards.map((c) => ({ ...c }));
    return () => {
      this.pool = pool.map((b) => ({ ...b, triggers: [...b.triggers], threads: [...b.threads], initial: { ...b.initial } }));
      Object.assign(this, { slots: { ...slots }, used: { ...used }, values: new Set(values), ciphers: [...ciphers], ids: new Set(ids), namedAt: new Map(named), meta: new Map(meta) });
      this.cards.splice(0, this.cards.length, ...cards.map((c) => ({ ...c })));
      this.items.length = n[0]; this.rules.length = n[1]; this.steps.length = n[2]; this.traces.length = n[3];
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
      if (w.where && !w.where(b)) continue;
      let av: { archetype?: ArchetypeId; variant?: string } = {};
      if (w.accept) {
        if (b.archetype) {
          if (!w.accept(b.archetype, b.variant!) || (w.fits && !w.fits(b, b.archetype))) continue;
          av = { archetype: b.archetype, variant: b.variant };
        } else {
          const fits = b.hostable.filter((h) => w.accept!(h.archetype, h.variant) && (!w.fits || w.fits(b, h.archetype)) &&
            (!DEMANDING.includes(h.archetype) || b.inv.fully_visible));
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
        case "time": value = `${1 + r(12)}:${String(5 * r(12)).padStart(2, "0")}`; if (value === "12:00" || !this.timeOk(value)) continue; break;
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

  /** Crime scene: no lock's time falls in the hours around the death, where it would read as testimony. */
  timeOk(value: string): boolean {
    return this.mode !== "crime_scene" || !DEATH_HOURS.includes(Number(value.split(":")[0]));
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
      // On a surface, only the inspector's question; on a card, the evidence itself (never "ruled out").
      case "option": return mark ? `${ref}?` : (m.evidence?.line ?? "{{s}}").replace(/\{\{s\}\}/g, ref);
      case "object": return mark ? orderMark(m.order ?? "first", ref) : orderLine(m.order ?? "first", ref);
      // A time away from its own document says what it is ("the last train, {{t}}").
      case "time": return m.time ? m.time.brief.replace("{v}", ref) : ref;
      default: return ref;
    }
  }

  /** What a glow mark says: each slot as written on the object, nothing more. */
  mark(slots: string[]): string {
    return slots.map((s) => this.phrase(s, true)).join("  ");
  }

  /**
   * A card with `slots`, written as a finding in the mode's voice; it never names what a value is for.
   * `host`: the object it was found in, under, behind or on (found and read): the card says where.
   */
  clue(medium: Medium, slots: string[], host?: Bound): string {
    const place = host && (medium === "found" || medium === "read") ? this.placeOf(host) : undefined;
    const at = place ? `${place} ` : "";
    // One piece of crime-scene evidence found on its own is the document itself (a hotel register, a coroner's note).
    const ev = slots.length === 1 ? this.meta.get(slots[0])?.evidence : undefined;
    let card: { title: string; text: string };
    if (ev && (medium === "found" || medium === "read" || medium === "pages")) {
      card = { title: ev.title, text: `${medium === "pages" ? "Folded in at that page. " : at}${ev.text.replace(/\{\{s\}\}/g, `{{${slots[0]}}}`)}` };
    } else {
      const list = slots.some((s) => LIST_KINDS.includes(this.slots[s].kind));
      const kind = slots.length === 1 ? this.slots[slots[0]].kind : undefined;
      // A lone time found or read is its own document (the ticket says "Departure: {{t}}").
      const doc = slots.length === 1 && (medium === "found" || medium === "read") ? this.meta.get(slots[0])?.time : undefined;
      const values = doc ? [`{{${slots[0]}}}`] : slots.map((s) => this.phrase(s, false, medium === "radio"));
      card = writeCard(this.mode, medium, values, list, this.fresh, kind, doc, place);
    }
    const after = slots.map((s) => this.meta.get(s)?.after).filter((a): a is string => !!a);
    const text = after.length ? `${card.text}${card.text.includes("\n") ? "\n" : " "}${after.join(" ")}` : card.text;
    return this.plainCard(card.title, text);
  }

  /** Where a card was found, as a sentence: never naming an object the values being built are for. */
  placeOf(host: Bound): string {
    const avoid = [this.exit, ...this.consumers].map((c) => c.inv.label);
    return placeLine({ archetype: host.archetype ?? "", variant: host.variant, type: host.inv.type, label: host.inv.label }, this.fresh, avoid);
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

  step(motif: MotifId, thread: number | null, object: string | undefined, requires: string[], hints: [string, string, string], optional = false, title?: string): string {
    const id = `step_${this.steps.length + 1}`;
    const b = object ? [this.exit, ...this.pool].find((o) => o.id === object) : undefined;
    const why = this.why(motif, b, optional);
    this.steps.push({ id, title: title ?? STEP_TITLE[motif], thread, motif, ...(object ? { object } : {}), requires, hints, ...(optional ? { optional } : {}), ...(why ? { why } : {}) });
    return id;
  }

  /** The in-world reason for a step (StepDef.why), by motif and the object it happens at. */
  why(motif: MotifId, b: Bound | undefined, optional: boolean): string | undefined {
    const l = b?.inv.label ?? "room";
    switch (motif) {
      case "read": return `Somebody left it on the ${l} to be read by whoever looked closely.`;
      case "contain": return `Hidden in the ${l} so that only someone who searched would find it.`;
      case "story_fragment": return optional && b?.archetype ? `A keepsake left in the ${l}: it tells the story, not the way out.` : undefined;
      case "contain_lock": return `The ${l} was locked, and what opens it was hidden apart from it.`;
      case "set_state": return b?.archetype === "TuningDial" ? `The message on the ${l} only comes through on one frequency, and someone wrote it down.` : undefined;
      case "cross_reference": return `Something was pressed between the pages of the ${l}, and only the page number leads to it.`;
      case "room_change": return b?.archetype === "Light" ? `The writing was made to show only when the ${l} is on.` : `The writing on the ${l} only shows in that light.`;
      case "tool_reveal": return "Left in ink or traces that only show under ultraviolet light.";
      case "split": return "Torn in two and hidden apart, so neither half says anything alone.";
      case "decode": return "Written in a cipher so that a stranger reading it learns nothing.";
      case "warm_reveal": return "Written in lemon juice, which dries invisible and only shows when it's warmed.";
      case "mirror_reveal": return "Written backwards, so only someone who thought to use a mirror could read it.";
      case "finale": return this.mode === "noir" ? "Whoever locked the door left its combination in pieces around the room."
        : "The accusation is made here, and only the evidence decides it.";
      case "ordering": return "The presence lets go only when its offerings are made in the right order; each fragment remembers one part of it.";
    }
  }

  /** Hint rung one for a find: points at a kind of place in the room, not at nothing. */
  nudge(b: Bound): string {
    const t = b.inv.type, cat = categoryOf(t);
    if (b.archetype === "Drawer") return b.variant === "drawer" ? "One of the drawers in this room isn't empty." : "Something here with a door or a lid is worth opening.";
    if (b.archetype === "FrameTilt") return "One of the things on the walls hangs slightly crooked.";
    if (b.archetype === "Readable") return ["bookshelf", "shelf", "book", "book_stack", "magazine", "notebook"].includes(t) ? "The books and papers here are worth a closer look." : "Something pinned or hung up here has writing on it.";
    if (cat === "textile") return "Something soft in this room sits a little higher than it should.";
    if (cat === "plant") return "Look under the green things.";
    return "Something small here could be lifted.";
  }

  rule(trigger: Trigger, when: Condition[], effects: Effect[], step?: string): void {
    this.rules.push({ id: `rule_${this.rules.length + 1}`, ...(step ? { step } : {}), trigger, when, effects });
  }

  /** Writing found in a container: a card to read where it lies, not an item (an item would only repeat it). */
  note(slots: string[]): Payload {
    return { note: slots };
  }

  /** What finding a payload at `host` does: an item into the hand (its card, if it has one, shown), or a card to read. */
  give(p: Payload, host?: Bound): Effect[] {
    if ("note" in p) return [{ do: "show_card", card: this.clue("found", p.note, host) }];
    if ("plain" in p) return [{ do: "show_card", card: this.plainCard(p.plain.title, host ? `${this.placeOf(host)} ${p.plain.lead}` : p.plain.lead) }];
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
      ...(this.tool === "uv" || this.tool === "any" ? [{ motif: "tool_reveal" as const, min: 2, fixed: false, run: () => this.toolReveal(slots, budget, thread, depth) }] : []),
      ...(this.tool === "warm" || this.tool === "any" ? [{ motif: "warm_reveal" as const, min: 2, fixed: false, run: () => this.warmReveal(slots, budget, thread, depth) }] : []),
      ...(this.tool === "mirror" || this.tool === "any" ? [{ motif: "mirror_reveal" as const, min: 2, fixed: false, run: () => this.mirrorReveal(slots, budget, thread, depth) }] : []),
      { motif: "split", min: 3, fixed: true, run: () => this.split(slots, thread) },
      ...(codable ? [{ motif: "decode" as const, min: 4, fixed: false, run: () => this.decode(slots, budget, thread, depth) }] : []),
    ], budget, depth);
  }

  /** A step whose firing grants `item`. */
  deliver(item: string, budget: number, thread: number, depth: number): string | null {
    return this.choose([
      { motif: "contain", min: 1, fixed: true, run: () => this.contain({ item }, thread) },
      { motif: "contain_lock", min: 2, fixed: false, run: () => this.lockedContain({ item }, budget, thread, depth) },
      // Never a flashlight behind a clock face.
      ...(this.items.find((i) => i.id === item)?.kind === "tool" ? [] : [{ motif: "set_state" as const, min: 2, fixed: false, run: () => this.setState([], { item }, budget, thread, depth) }]),
    ], budget, depth + 1);
  }

  read(slots: string[], thread: number): string | null {
    const p = this.pickObject({ trigger: "inspect", thread, accept: (a, v) => a === "Readable" && v === "card" });
    if (!p) return null;
    const b = this.bind(p, thread, "inspect");
    const card = this.clue("read", slots, b);
    const shelf = b.inv.type === "bookshelf" || b.inv.type === "shelf";
    const s = this.step("read", thread, b.id, [], [this.nudge(b), `Take a closer look at the ${b.inv.label}.`,
      shelf ? `Search the ${b.inv.label} and read what's tucked in among the books.` : `Read the ${b.inv.label}.`]);
    this.rule({ on: "inspect", object: b.id }, [], [{ do: "show_card", card }], s);
    return s;
  }

  contain(payload: Payload, thread: number, optional = false): string | null {
    // A flashlight goes in a drawer or a cupboard, taped behind a frame, or under a cushion or a book; never under a mug or a pot.
    const bulky = "item" in payload && this.items.find((i) => i.id === payload.item)?.kind === "tool";
    const p = this.pickObject({
      trigger: "contain", thread, accept: (a) => CONTAINERS.includes(a),
      fits: bulky ? (b, a) => a !== "LiftUnder" || !SMALL_UNDER.includes(categoryOf(b.inv.type)) : undefined,
    });
    if (!p) return null;
    const b = this.bind(p, thread, "contain");
    const control = CONTAINER_CONTROL[b.archetype!]!;
    const label = b.inv.label;
    const s = this.step(optional ? "story_fragment" : "contain", optional ? null : thread, b.id, [],
      [this.nudge(b), `The ${label} could hide something.`, `${verb(b)} ${target(b)}.`], optional);
    this.rule({ on: "control", target: b.id, control }, [{ if: "control", target: b.id, control, eq: { lit: true } }], this.give(payload, b), s);
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
      const s = this.step("contain_lock", thread, b.id, [up], ["Something here is locked.", `The ${b.inv.label} is locked, and the ${this.names.key.toLowerCase()} you found is small enough to fit it.`, `Use the ${this.names.key.toLowerCase()} on the ${b.inv.label}.`]);
      this.rule({ on: "use", item: key, object: b.id }, [], [{ do: "open", object: b.id }, { do: "consume", item: key }, ...this.give(payload, b)], s);
      return s;
    };
    const byCode = () => {
      const p = this.pickObject({ trigger: "contain", thread, accept: (a) => a === "CombinationLock" });
      if (!p) return null;
      const b = this.bind(p, thread, "contain", "submit");
      const m = this.mint(b.variant as "digits" | "letters" | "symbols");
      const code = this.slot("code", m.value, m.text);
      const up = this.waitingOn(b, () => this.info([code], budget - 1, thread, depth + 1));
      if (!up) return null;
      const what = b.variant === "letters" ? "letters" : b.variant === "symbols" ? "symbols" : "digits";
      const s = this.step("contain_lock", thread, b.id, [up], ["One lock here wants a code.",
        `The ${b.inv.label} has a lock with three wheels of ${what}, and ${this.sourceOf(up) ?? "a clue you found"} has three ${what} on it.`, `Enter {{${code}}} on the ${b.inv.label}.`]);
      this.rule({ on: "submit", object: b.id }, [{ if: "submitted", eq: { slot: code } }],
        [{ do: "open", object: b.id }, { do: "overlay", object: b.id, overlay: "panel_open" }, ...this.give(payload, b)], s);
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

  /**
   * Clock hands or a tuning dial set to a value learned upstream. Shows `slots`, or grants `item` (clock only).
   * A clock's time is worked out, never copied: a document gives a time and a second fact says how far
   * off the moment that matters was. Where it can, that second fact is on a card of another thread (a
   * braid: neither card alone sets the clock).
   */
  setState(slots: string[], item: Payload | null, budget: number, thread: number, depth: number): string | null {
    const p = this.pickObject({ trigger: "set", thread, accept: (a) => a === "ClockHands" || (!item && a === "TuningDial") });
    if (!p) return null;
    const b = this.bind(p, thread, "set");
    const clock = b.archetype === "ClockHands";
    const control = clock ? "time" : "freq";
    const label = b.inv.label;
    let input: string, up: string | null, requires: string[], connection: string;
    if (clock) {
      const t = this.timeFacts(thread, b);
      if (!t) return null;
      b.initial.time = this.mint("time").value;
      input = t.target;
      up = this.waitingOn(b, () => this.info([t.base], budget - 1, thread, depth + 1));
      if (!up) return null;
      requires = [up, ...(t.carrier ? [t.carrier.step] : [])];
      const baseCard = this.cards.find((c) => c.text.includes(`{{${t.base}}}`));
      const what = baseCard ? `the ${baseCard.title.toLowerCase()}` : "one clue";
      connection = t.carrier
        ? `The time on ${what} is only half of it: the ${this.cards.find((c) => c.id === t.carrier!.card)!.title.toLowerCase()} says how far off it was. The ${label} wants the real moment.`
        : `${capitalise(what)} gives a time, and a second line on it says how far off it was. The ${label} wants the real moment.`;
    } else {
      input = this.slot("freq", this.mint("freq").value);
      up = this.waitingOn(b, () => this.info([input], budget - 1, thread, depth + 1));
      if (!up) return null;
      requires = [up];
      connection = `The ${label} has a dial, and ${this.sourceOf(up) ?? "a clue you found"} gives a frequency.`;
    }
    const payload = item ?? (clock ? this.note(slots) : null);
    const effects: Effect[] = clock
      ? [{ do: "set_state", target: b.id, key: "panel", value: true }, { do: "overlay", object: b.id, overlay: "panel_open" }, ...this.give(payload!, b)]
      : [{ do: "show_card", card: this.clue("radio", slots) }];
    const s = this.step("set_state", thread, b.id, requires, [
      clock ? "A stopped clock is waiting for the right time." : "Something in the room can be tuned.",
      connection,
      clock ? `Set the ${label} to {{${input}}}.` : `Tune the ${label} to {{${input}}}.`,
    ]);
    this.rule({ on: "control", target: b.id, control }, [{ if: "control", target: b.id, control, eq: { slot: input } }], effects, s);
    if (clock) this.steps[this.steps.length - 1].why = `The ${label} was stopped at the real moment, not the time written down; set to it, its back panel opens.`;
    return s;
  }

  /**
   * The two facts behind a clock's time: a written time (`base`, shown) and how far off the real moment
   * was, in words. `target` (derived, never shown) is the moment. The second fact goes on a card another
   * thread already gives (`carrier`) when there is one, else on the same card as the base time.
   */
  timeFacts(thread: number, clock: Bound): { base: string; target: string; carrier?: { card: string; step: string } } | null {
    const doc = this.fresh(TIME_DOCS[this.mode]);
    const toMin = (v: string) => { const [h, m] = v.split(":").map(Number); return (h % 12) * 60 + m; };
    const fromMin = (x: number) => { const t = ((x % 720) + 720) % 720; return `${Math.floor(t / 60) || 12}:${String(t % 60).padStart(2, "0")}`; };
    for (let tries = 0; tries < 12; tries++) {
      const target = this.mint("time").value;
      const [mins, words] = DURATIONS[this.rint(DURATIONS.length)];
      const base = fromMin(toMin(target) - doc.sign * mins);
      if (base === "12:00" || !this.timeOk(base) || this.values.has(`time:${base}`)) continue;
      this.values.add(`time:${base}`);
      const rel = doc.rel.replace("{d}", words);
      const baseSlot = this.slot("time", base, undefined, { time: doc });
      const carrier = this.carrierCard(thread, clock);
      if (carrier) {
        const c = this.cards.find((x) => x.id === carrier.card)!;
        c.text = `${c.text}${c.text.includes("\n") ? "\n" : " "}${TIME_REL_LEAD[this.mode].carrier.replace("{r}", rel)}`;
        const on = slotRefs(c.text)[0];
        return { base: baseSlot, target: this.slot("time", target, undefined, undefined, [baseSlot, on]), carrier };
      }
      this.meta.set(baseSlot, { time: doc, after: TIME_REL_LEAD[this.mode].same.replace("{r}", rel) });
      return { base: baseSlot, target: this.slot("time", target, undefined, undefined, [baseSlot]) };
    }
    return null;
  }

  /** A card another thread gives on solving a step, that can carry one more line: never evidence, never a keepsake. */
  carrierCard(thread: number, clock: Bound): { card: string; step: string } | null {
    const out: { card: string; step: string }[] = [];
    // Nor a card that names the clock (a trace "on the wall above the wall clock"): it would point at it.
    const names = (t: string) => [clock, this.exit].some((o) => new RegExp(`\\b${o.inv.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t));
    for (const r of this.rules) {
      const st = r.step ? this.steps.find((x) => x.id === r.step) : undefined;
      if (!st || st.thread === null || st.thread === thread || st.optional || st.object === clock.id) continue;
      for (const e of r.effects) {
        const card = e.do === "show_card" ? e.card : e.do === "grant" ? this.items.find((i) => i.id === e.item)?.card : undefined;
        const c = card ? this.cards.find((x) => x.id === card) : undefined;
        const refs = c ? slotRefs(c.text) : [];
        // Never evidence (it must read as a document), and never a card that already says how far off a time was.
        const timed = Object.values(TIME_REL_LEAD[this.mode]).some((l) => c?.text.includes(l.split("{r}")[0]));
        if (!c || !refs.length || timed || names(c.text) || refs.some((n) => this.slots[n]?.kind === "option" || this.slots[n]?.kind === "time" || this.slots[n]?.from)) continue;
        out.push({ card: c.id, step: st.id });
      }
    }
    return out.length && this.rng() < 0.85 ? out[Math.floor(this.rng() * out.length)] : null;
  }

  /** The card a step shows, as a hint names it ("the train ticket from the desk"), or null. */
  sourceOf(step: string): string | null {
    const st = this.steps.find((x) => x.id === step);
    for (const r of this.rules.filter((x) => x.step === step)) {
      for (const e of r.effects) {
        const card = e.do === "show_card" ? e.card : e.do === "grant" ? this.items.find((i) => i.id === e.item)?.card : undefined;
        const c = card ? this.cards.find((x) => x.id === card) : undefined;
        if (!c) continue;
        const at = st?.object ? [this.exit, ...this.pool].find((o) => o.id === st.object)?.inv.label : undefined;
        const title = c.title.toLowerCase();
        return `the ${title}${at && !at.toLowerCase().includes(title) && !title.includes(at.toLowerCase()) ? ` from the ${at}` : ""}`;
      }
    }
    return null;
  }

  crossReference(slots: string[], budget: number, thread: number, depth: number): string | null {
    const p = this.pickObject({ trigger: "set", thread, accept: (a, v) => a === "Readable" && v === "pages" });
    if (!p) return null;
    const b = this.bind(p, thread, "set");
    // No "in the bookshelf": which book a page number belongs to is the player's to work out.
    const page = this.slot("page", this.mint("page").value);
    const up = this.waitingOn(b, () => this.info([page], budget - 1, thread, depth + 1));
    if (!up) return null;
    const s = this.step("cross_reference", thread, b.id, [up], ["One clue points into a book.",
      `${capitalise(this.sourceOf(up) ?? "a clue you found")} gives a page number, and the ${b.inv.label} has pages.`, `Find page {{${page}}} in the ${b.inv.label}.`]);
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

  /** `f` builds what `b` waits on: no trace report written meanwhile may name `b`. */
  waitingOn<T>(b: Bound, f: () => T): T {
    this.consumers.push(b);
    try {
      return f();
    } finally {
      this.consumers.pop();
    }
  }

  toolReveal(slots: string[], budget: number, thread: number, depth: number): string | null {
    // Traces on the photo itself when there's room for both steps (light it, then lift it); else a glow on an object.
    // (In a last round of candidates, the glow lands on something already seen instead: a revisit, for rooms short of one.)
    if (budget >= 2 && slots.length <= MAX_TRACES && !this.glowFirst) {
      const restore = this.snap();
      const s = this.traceReveal(slots, budget, thread, depth, budget >= 3);
      if (s) return s;
      restore();
    }
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

  // ---- Notes that read only with something in the room ------------------------
  /**
   * A blank letter written in lemon juice (found somewhere), warmed at a lamp the player switches on: the
   * writing browns in. The letter says it smells of lemons when found; the lamp may be one another
   * thread lights (a braid). Shows `slots`.
   */
  warmReveal(slots: string[], budget: number, thread: number, depth: number): string | null {
    const lp = this.pickObject({ trigger: "warm", thread, preferUsed: true, accept: (a, v) => a === "Light" && v !== "torch" });
    if (!lp) return null;
    const lamp = this.bind(lp, thread, "warm");
    const n = this.names.letter;
    const letter = this.item("prop", n.title, { card: this.plainCard(n.title, n.lead) });
    const up = this.deliver(letter, budget - 1, thread, depth);
    if (!up) return null;
    const card = this.clue("heat", slots);
    this.cards.find((c) => c.id === card)!.reveal = "heat";
    const name = n.title.toLowerCase(), l = lamp.inv.label;
    const s = this.step("warm_reveal", thread, lamp.id, [up], [
      "Some writing only shows when it's warmed.",
      `The ${name} smells of lemons: lemon juice dries invisible and turns brown with heat, and the ${l} gets warm once it's on.`,
      `Switch on the ${l}, then hold the ${name} to it.`,
    ]);
    this.rule({ on: "use", item: letter, object: lamp.id }, [{ if: "control", target: lamp.id, control: "on", eq: { lit: true } }],
      [{ do: "consume", item: letter }, { do: "show_card", card }, { do: "beat", text: "Brown letters creep up out of the blank paper." }], s);
    return s;
  }

  /** A note in mirror writing (found somewhere), held up to the room's own mirror: it reads plainly. Shows `slots`. */
  mirrorReveal(slots: string[], budget: number, thread: number, depth: number): string | null {
    const mp = this.pickObject({ trigger: "mirror", thread, preferUsed: true, where: (b) => b.inv.type === "mirror" || (b.inv.features.includes("reflective") && categoryOf(b.inv.type) !== "textile") });
    if (!mp) return null;
    const mirror = this.bind(mp, thread, "mirror");
    const n = this.names.backwards;
    const note = this.item("prop", n.title, { card: this.plainCard(n.title, n.lead) });
    const up = this.deliver(note, budget - 1, thread, depth);
    if (!up) return null;
    const card = this.clue("mirror", slots);
    this.cards.find((c) => c.id === card)!.reveal = "mirror";
    const name = n.title.toLowerCase(), l = mirror.inv.label;
    const s = this.step("mirror_reveal", thread, mirror.id, [up], [
      "Some writing is meant to be read the other way round.",
      `The ${name} is written back to front, and the ${l} would turn it round.`,
      `Hold the ${name} up to the ${l}.`,
    ]);
    this.rule({ on: "use", item: note, object: mirror.id }, [],
      [{ do: "consume", item: note }, { do: "show_card", card }, { do: "beat", text: "In the glass the backwards letters come right." }], s);
    return s;
  }

  // ---- UV traces -------------------------------------------------------------
  /** Kinds of trace that can carry a slot, in a seeded order of preference. */
  traceKinds(slot: string | null): TraceKind[] {
    const shuffle = <T>(xs: T[]): T[] => xs.map((x) => [this.rng(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
    if (slot === null) return shuffle(Object.keys(TRACE_HERRINGS[this.mode]) as TraceKind[]);
    const ev = this.meta.get(slot)?.evidence;
    const kinds = ev ? (Object.keys(ev.traces) as TraceKind[]) : (Object.keys(TRACE_VALUE[this.mode]) as TraceKind[]);
    const fresh = (k: TraceKind) => (this.traces.some((t) => t.kind === k) ? 1 : 0);
    // Writing first in noir (it carries the code's look); otherwise kinds not yet in the room first.
    return shuffle(kinds).sort((a, b) => fresh(a) - fresh(b) || (this.mode === "noir" ? (b === "writing" ? 1 : 0) - (a === "writing" ? 1 : 0) : 0));
  }

  /** Where a trace of `kind` fits on or by `b` on its photo, clear of other traces: the rect and the surface. */
  fitTrace(kind: TraceKind, b: Bound): { surface: TraceSpec["surface"]; rect: Rect; where: string } | null {
    const a = boxToRect(b.inv.box, { padding: 0 });
    const [w, h] = TRACE_SIZE[kind];
    const photo = b.inv.photo_index;
    const others = [this.exit, ...this.pool].filter((o) => o.id !== b.id && o.inv.photo_index === photo).map((o) => boxToRect(o.inv.box, { padding: 0 }));
    const placed = this.traces.filter((t) => t.photo === photo).map((t) => t.rect);
    const label = b.inv.label;
    const rug = b.inv.type === "rug";
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    const tryRect = (x: number, y: number, maxOverlap: number, clearOfSelf: boolean): Rect | null => {
      const r = { x: r3(Math.min(0.99 - w, Math.max(0.01, x))), y: r3(Math.min(0.99 - h, Math.max(0.01, y))), w, h };
      if (Math.abs(r.x - x) > 0.04 || Math.abs(r.y - y) > 0.04) return null;   // pushed far off where it belongs
      if (placed.some((p) => overlapArea(p, r) > 0)) return null;
      if (others.some((o) => overlapArea(o, r) > maxOverlap * w * h)) return null;
      // Beside or by an object is off it: footprints "by the bed" are never drawn across the bed.
      if (clearOfSelf && overlapArea(a, r) > 0.02 * w * h) return null;
      return r;
    };
    // Only where this kind of trace physically goes (traces.ts): never footprints on a bed or prints on a cushion.
    for (const surface of TRACE_SURFACES[kind].filter((s) => traceSiteOk(kind, s, b.inv.type))) {
      const spots: { x: number; y: number; max: number; where: string }[] = [];
      if (surface === "on" && a.w >= w * 1.25 && a.h >= h * 1.25) {
        const where = /\bdrawers?\b/i.test(label) ? `the front of the ${label}` : b.inv.type === "door" && kind === "prints" ? `the ${label}, by the handle` : `the ${label}`;
        const at = (fx: number, fy: number) => spots.push({ x: a.x + a.w * fx - w / 2, y: a.y + a.h * fy - h / 2, max: 0.5, where });
        if (b.inv.type === "door") at(kind === "prints" ? 0.78 : 0.5, kind === "palm" ? 0.35 : 0.48);
        else if (/\bdrawers?\b/i.test(label)) at(0.5, 0.35);
        else { at(0.5, 0.3); at(0.3, 0.55); at(0.7, 0.5); }
      } else if (surface === "wall") {
        const y = a.y + Math.min(0.15, a.h * 0.2);
        spots.push({ x: a.x - w - 0.02, y, max: 0.1, where: `the wall beside the ${label}` });
        spots.push({ x: a.x + a.w + 0.02, y, max: 0.1, where: `the wall beside the ${label}` });
        spots.push({ x: a.x + a.w / 2 - w / 2, y: a.y - h - 0.03, max: 0.1, where: `the wall above the ${label}` });
      } else if (surface === "floor") {
        if (rug && a.w >= w * 1.1 && a.h >= h * 0.9) spots.push({ x: a.x + a.w / 2 - w / 2, y: a.y + a.h / 2 - h / 2, max: 0.15, where: `the ${label}` });
        else if (!rug && a.y + a.h >= 0.55) {
          const y = Math.min(0.97 - h, Math.max(0.62, a.y + a.h + 0.01));
          for (const fx of [0.5, 0.2, 0.8]) spots.push({ x: a.x + a.w * fx - w / 2, y, max: 0.05, where: `the floor by the ${label}` });
        }
      }
      for (const p of spots) {
        if (surface === "wall" && p.y + h > 0.72) continue;   // a wall is above the floor
        const rect = tryRect(p.x, p.y, p.max, surface !== "on" && !rug);
        if (rect) return { surface, rect, where: p.where };
      }
    }
    return null;
  }

  /** A trace for `slot` (null: one that leads nowhere), on the best object that has room for it. */
  placeTrace(slot: string | null, thread: number, exclude: (string | undefined)[]): Trace | null {
    const photos = new Set(this.traces.map((t) => t.photo));
    const ranked = [...(slot === null ? [this.exit] : []), ...this.pool]
      .filter((b) => b !== this.removable && !exclude.includes(b.id))
      .map((b) => [b.inv.salience * 0.5 + this.rng() * 0.8 + (b.threads.includes(thread) ? 0.6 : 0) + (b.roles > 0 ? 0.3 : 0) +
        (photos.has(b.inv.photo_index) ? 0 : 0.5), b] as const)
      .sort((x, y) => y[0] - x[0]).map(([, b]) => b);
    for (const kind of this.traceKinds(slot)) {
      for (const b of ranked) {
        const fit = this.fitTrace(kind, b);
        if (!fit) continue;
        let id: string;
        do id = `trace_${mintSuffix(this.rint)}`; while (this.ids.has(id));
        this.ids.add(id);
        const t: Trace = { id, kind, anchor: b.id, photo: b.inv.photo_index, ...fit, label: TRACE_LABELS[this.mode][kind], seed: Math.floor(this.rng() * 1e6), lead: slot !== null };
        this.traces.push(t);
        return t;
      }
    }
    return null;
  }

  /** The report on a trace: the forensics (crime scene), or what it says (a value), or the room's story (a herring). */
  traceCard(t: Trace, slot: string | null): string {
    const title = TRACE_REPORTS[this.mode][t.kind];
    const where = (s: string) => s.split("{where}").join(t.where);
    if (slot === null) return this.plainCard(title, where(TRACE_HERRINGS[this.mode][t.kind]!));
    const ev = this.meta.get(slot)?.evidence;
    if (ev) return this.plainCard(title, where(ev.traces[t.kind]!).replace(/\{\{s\}\}/g, `{{${slot}}}`));
    const lead = where(this.pick(TRACE_VALUE[this.mode][t.kind]!));
    const v = this.phrase(slot);
    const list = LIST_KINDS.includes(this.slots[slot].kind);
    const after = this.meta.get(slot)?.after;
    return this.plainCard(title, `${list ? `${lead}\n${v}` : `${lead} ${/[.!?]$/.test(v) ? v : `${v}.`}`}${after ? `${list ? "\n" : " "}${after}` : ""}`);
  }

  /**
   * Traces on the photo (prints, a stain, footprints, writing), one per slot, seen only under the UV
   * flashlight: shining it on one shows it (and, for writing, what it says); dragging the magnifier onto
   * it then reads its report. Two steps after the torch: light them all, then read them all.
   */
  traceReveal(slots: string[], budget: number, thread: number, depth: number, twoSteps: boolean): string | null {
    const torch = this.item("tool", this.names.torch, { archetype: "Light", variant: "torch" });
    const up = this.deliver(torch, budget - (twoSteps ? 2 : 1), thread, depth);
    if (!up) return null;
    const source = this.steps.find((s) => s.id === up)?.object;
    // A report names where it was lifted: never the object its value goes to (nor the way out).
    // (By label too: a report on "the wall beside the desk lamp" would name the desk.)
    const named = [this.exit, ...this.consumers].map((c) => new RegExp(`\\b${c.inv.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"));
    const exclude = [source, ...[this.exit, ...this.pool].filter((b) => named.some((re) => re.test(b.inv.label))).map((b) => b.id)];
    const traces: { t: Trace; slot: string }[] = [];
    for (const slot of slots) {
      const t = this.placeTrace(slot, thread, exclude);
      if (!t) return null;
      traces.push({ t, slot });
      if (this.slots[slot].kind === "object") this.namedAt.set(slot, [...(this.namedAt.get(slot) ?? []), t.anchor]);
    }
    const reveal = (t: Trace, slot: string | null): Effect[] => [
      { do: "overlay", object: t.id, overlay: "glow_mark", ...(t.kind === "writing" && slot ? { text: this.mark([slot]) } : {}) },
      { do: "set_state", target: t.id, key: "revealed", value: true },
      { do: "beat", text: TRACE_BEATS[t.kind].replace("{where}", t.where) },
    ];
    const revealed = (t: Trace): Condition => ({ if: "state", target: t.id, key: "revealed", eq: { lit: true } });
    const lifted = (t: Trace): Condition => ({ if: "state", target: t.id, key: "lifted", eq: { lit: true } });
    const one = traces.length === 1;
    const first = traces[0].t;
    const wheres = listOf([...new Set(traces.map(({ t }) => t.where))]);
    const anchors = listOf([...new Set(traces.map(({ t }) => this.labelOf(t.anchor)))].map((l) => `the ${l}`));
    const names = listOf([...new Set(traces.map(({ t }) => t.label.toLowerCase()))]);
    const each = listOf(traces.map(({ t }) => `the ${t.label.toLowerCase()} on ${t.where}`));
    const reports = one ? "the report" : "each report";
    // Two steps (light it, then read it), or, short of room, one that asks for both.
    const lit = twoSteps
      ? this.step("tool_reveal", thread, first.id, [up], [
        "Some things in here only show under ultraviolet.",
        `Something on or near ${anchors} only shows under UV.`,
        `Switch to the UV flashlight and hold the beam on ${wheres} until it glows.`,
      ], false, "Under the light")
      : undefined;
    const read = this.step("tool_reveal", thread, first.id, [lit ?? up], twoSteps
      ? [
        "What glows under the UV light can be looked at closely.",
        `Drag the magnifier onto the ${names} you found under the UV light.`,
        `Drag the magnifier onto ${each}, and read ${reports}.`,
      ]
      : [
        "Some things in here only show under ultraviolet.",
        `Sweep the UV flashlight over ${anchors}; what glows can be looked at closely.`,
        `With the UV flashlight on, hold the beam on ${wheres} until it glows, then drag the magnifier onto it and read ${reports}.`,
      ], false, twoSteps ? "Send it to forensics" : "Under the light");
    // Lighting any of them solves "under the light" (the first glow is the discovery); reading is done once all are read.
    for (const { t, slot } of traces) {
      this.rule({ on: "use", item: torch, object: t.id }, [], reveal(t, slot), lit);
      this.rule({ on: "inspect", object: t.id }, [revealed(t)],
        [{ do: "show_card", card: this.traceCard(t, slot) }, { do: "set_state", target: t.id, key: "lifted", value: true }], one ? read : undefined);
    }
    if (!one) this.rule({ on: "auto" }, traces.map(({ t }) => lifted(t)), [], read);
    // Now and then a trace that leads nowhere (the victim's own prints, a cleaner's polish), for a sweep to turn up.
    const h = this.rng() < 0.6 ? this.placeTrace(null, thread, [source]) : null;
    if (h) {
      this.rule({ on: "use", item: torch, object: h.id }, [], reveal(h, null));
      this.rule({ on: "inspect", object: h.id }, [revealed(h)], [{ do: "show_card", card: this.traceCard(h, null) }]);
    }
    return read;
  }

  labelOf(id: string): string {
    return [this.exit, ...this.pool].find((b) => b.id === id)?.inv.label ?? id;
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
    const s = this.step("decode", thread, undefined, [encStep, itemStep, offStep], ["A coded line and a wheel to read it.",
      `The letters on ${this.sourceOf(encStep) ?? "the coded card"} spell nothing until the cipher wheel's ring is turned; ${this.sourceOf(offStep) ?? "another clue"} gives the setting.`,
      `Set the cipher wheel to {{${offset}}} and read the coded line.`]);
    this.rule({ on: "control", target: wheel, control: "offset" }, [{ if: "control", target: wheel, control: "offset", eq: { slot: offset } }, { if: "solved", step: encStep }],
      [{ do: "show_card", card: this.clue("decoded", slots) }], s);
    return s;
  }
}

const STEP_TITLE: Record<MotifId, string> = {
  read: "Read it", contain: "Look inside", split: "Piece it together", set_state: "Set the mechanism",
  cross_reference: "Find the page", decode: "Decode it", tool_reveal: "Under the light", room_change: "Change the room",
  ordering: "Perform the ritual", contain_lock: "Open the lock", story_fragment: "A keepsake", finale: "The way out",
  warm_reveal: "Warm it", mirror_reveal: "In the mirror",
};

/** The reveal tools a room can be given (UV traces and glows; a letter in lemon juice; a note in mirror writing), or none. */
export type RevealTool = "uv" | "warm" | "mirror" | "none";

/**
 * The room's one reveal tool. UV, the lemon-juice letter (needs a lamp) and the mirror note (needs a mirror)
 * weigh the same, and "none" makes up the rest, so UV is in about a third of rooms that have a lamp.
 */
export function revealTool(objs: InventoryObject[], rng: () => number): RevealTool {
  const lamp = objs.some((o) => hostableArchetypes(o).some((h) => h.archetype === "Light" && h.variant !== "torch"));
  const mirror = objs.some((o) => o.type === "mirror" || (o.features.includes("reflective") && categoryOf(o.type) !== "textile"));
  const tools: [RevealTool, number][] = [["uv", 1], ...(lamp ? [["warm", 1] as [RevealTool, number]] : []), ...(mirror ? [["mirror", 1] as [RevealTool, number]] : [])];
  // No tool at all only where a lamp can still change the room (and give it a revisit); a room with
  // neither a lamp nor a mirror has nothing else that reveals, so it gets the UV light.
  if (lamp) tools.push(["none", Math.max(0, 3 - tools.length)]);
  let r = rng() * tools.reduce((a, [, w]) => a + w, 0);
  for (const [t, w] of tools) if ((r -= w) < 0) return t;
  return "uv";
}

/**
 * What each of `n` ritual fragments says about its offering's place, so that exactly one order fits all
 * of them and no single fragment gives more than one place outright: at most one says "first" or "last"
 * or "neither first nor last"; the others only rule places out.
 */
export function orderPuzzle(n: number, rng: () => number): OrderRule[] {
  const perms = permutations(Array.from({ length: n }, (_, i) => i));
  const absolute: OrderRule[] = ["first", "last", "middle"];
  const sets: OrderRule[][] = [];
  const grow = (k: number, acc: OrderRule[]) => {
    if (k === n) {
      if (acc.filter((r) => absolute.includes(r)).length > 1) return;
      // Exactly one order fits: the true one (offering k at place k).
      const fit = perms.filter((p) => p.every((place, k2) => orderHolds(acc[k2], place, n)));
      if (fit.length === 1) sets.push([...acc]);
      return;
    }
    for (const r of ORDER_RULES) if (orderHolds(r, k, n)) grow(k + 1, [...acc, r]);
  };
  grow(0, []);
  return sets[Math.floor(rng() * sets.length)];
}

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
  seed: string | number, glowFirst = false,
): Candidate | string {
  const taken = new Set<string>();
  const mk = (o: InventoryObject): Bound => ({ inv: o, id: slugId(o.label, taken), hostable: hostableArchetypes(o), archetype: null, roles: 0, triggers: [], threads: [], initial: {} });
  const exit = mk(exitObj);
  const pool = inv.filter((o) => o !== exitObj).sort((a, b) => b.salience - a.salience).map(mk);
  const B = new Builder(mode, pool, exit, rng, rint, trng);
  B.glowFirst = glowFirst;
  // The room's reveal tool, seeded by the room (every candidate the same, so scoring can't always pick UV),
  // and lifted in the last round, for rooms that plan no other way.
  B.tool = glowFirst ? "any" : revealTool(pool.map((b) => b.inv), seededRandom(`${seed}:${mode}:tool`));
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
  let partial: Evidence | undefined;    // crime scene: the alibi that needs the narrowed time of death
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
    // Each wrong option gets its evidence now: a document (or UV forensics) that rules it out by what it says.
    // One wrong suspect's alibi holds only until half past eleven: it rules them out only against a later
    // card that narrows the time of death (the case's one two-card deduction). The other has a full alibi.
    const alibis = B.sample(ALIBIS, 1);
    partial = partialEvidence(B.pick(PARTIAL_ALIBIS));
    let given = 0;
    const pools: { name: string; evidence: () => Evidence }[][] = [
      B.sample(SUSPECTS, 3).map((name) => ({ name, evidence: () => (given++ === 0 ? partial! : suspectEvidence(alibis.shift()!, B.pick)) })),
      B.sample(MOTIVES, 3).map((o) => ({ name: o.name, evidence: () => optionEvidence(o) })),
      B.sample(METHODS, 3).map((o) => ({ name: o.name, evidence: () => optionEvidence(o) })),
    ];
    const dims = pools.map((pool, i) => {
      const options: AccuseOption[] = pool.map(({ name }) => {
        let id: string;
        do id = `${"smx"[i]}_${mintSuffix(rint)}`; while (B.ids.has(id));
        B.ids.add(id);
        return { id, name };
      });
      const right = rint(3);
      const ruledOut = options.flatMap((o, j) => j === right ? [] : [B.slot("option", o.id, o.name, { evidence: pool[j].evidence() })]);
      return { options, ruledOut, slot: B.slot("option", options[right].id, options[right].name, undefined, ruledOut) };
    });
    const evidence = dims.flatMap((d) => d.ruledOut);
    dealt(evidence.length).forEach((t, k) => outputs[t].push(evidence[k]));
    answer = B.slot("code", dims.map((d) => B.slots[d.slot].value).join("|"), undefined, undefined, dims.map((d) => d.slot));
    finale = { kind: "accusation", object: exit.id, suspects: dims[0].options, motives: dims[1].options, methods: dims[2].options };
    submit = { kind: "accusation" };
    finaleHint = `At the ${exit.inv.label}, accuse {{${dims[0].slot}}}. Motive: {{${dims[1].slot}}}. Method: {{${dims[2].slot}}}.`;
    finaleHow = "Cross off every suspect, motive and method the evidence rules out; read each alibi against the latest word on when the death happened. One of each is left.";
  } else {
    const length = 3;
    // Each fragment says where its offering may or may not go; only together do they fix the order.
    const rules = orderPuzzle(length, rng);
    const positions = Array.from({ length }, (_, k) => B.slot("object", "?", undefined, { ordinal: k, order: rules[k] }));
    const owner = dealt(length);
    owner.forEach((t, k) => outputs[t].push(positions[k]));
    positionOwner.push(...owner);
    answer = B.slot("code", "?", undefined, undefined, positions);
    finale = { kind: "ritual", object: exit.id, length };
    submit = { kind: "sequence", length };
    finaleHint = "";   // named once the ritual's objects are chosen
    finaleHow = "Each fragment describes one offering and says where it may or may not go. Match each to a thing in this room; only one order fits every fragment.";
  }

  // Threads, grown backwards from their goals.
  const ends: string[] = [];
  for (let t = 0; t < nThreads; t++) {
    const end = B.info(outputs[t], budgets[t], t, 0);
    if (!end) return `thread ${t + 1}: no motif fits the room's objects`;
    ends.push(end);
  }

  // Crime scene: the fact that narrows the time of death goes on another card of the evidence, so the
  // partial alibi rules its suspect out only once both cards are read.
  if (partial) {
    const slotOf = Object.keys(B.slots).find((n) => B.meta.get(n)?.evidence === partial);
    const alibiCard = slotOf ? B.cards.find((c) => c.text.includes(`{{${slotOf}}}`)) : undefined;
    if (!alibiCard) return "the partial alibi is on no card";
    // Another card of evidence (it holds a ruled-out option, so the accusation can't be made without it).
    const others = B.cards.filter((c) => c !== alibiCard && slotRefs(c.text).some((n) => B.slots[n]?.kind === "option"));
    const host = others.length ? others[Math.floor(rng() * others.length)] : alibiCard;
    host.text = `${host.text}${host.text.includes("\n") ? "\n" : " "}${B.pick(NARROWED_DEATH)}`;
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
    // Never one that two things in the room would fit, nor one with no description (it would be named outright).
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
        // Never the object its own card names (a trace's "the floor by the rug"), at any level.
        const named = B.namedAt.get(name) ?? [];
        const excludeIds = level === 0 ? [...taken, ...unclear, ...foundAt(name), ...named] : [...taken, ...unclear, ...named];
        const p = B.pickObject({ trigger: "ritual", thread: -1, preferUsed: true, excludeIds });
        if (!p) return null;
        picked.set(name, B.bind(p, -1, "ritual"));
      }
      return picked;
    };
    let picked: Map<string, Bound> | null = null;
    for (let level = 0; level < 2 && !picked; level++) {
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
      const described = describeObject(b.inv.type, b.inv.label)!;
      B.slots[name] = { kind: "object", value: b.id, text: described, ...(B.meta.get(name)?.order ? { order: B.meta.get(name)!.order } : {}) };
    }
    B.slots[answer] = { ...B.slots[answer], value: chosen.map((c) => c.id).join("|") };
    // The last rung may give the answer: plainly, by name.
    finaleHint = `At the ${exit.inv.label}, perform the ritual in order: ${chosen.map((c) => `the ${c.inv.label}`).join(", ")}.`;
  }

  const fin = B.step(finale.kind === "ritual" ? "ordering" : "finale", null, exit.id, ends,
    ["Everything you've learned ends at the way out.", finaleHow, finaleHint]);
  B.rule({ on: "submit", object: exit.id }, [{ if: "submitted", eq: { slot: answer } }],
    [{ do: "open", object: exit.id }, { do: "beat", text: voice.beat }, { do: "complete" }], fin);

  // Optional extras: a story fragment, and at most one removable small object.
  if (rng() < 0.6) {
    const restore = B.snap();
    const keepsake = B.fresh(KEEPSAKES[mode]);
    if (!B.contain({ plain: keepsake }, -2, true)) restore();
  }
  const anchors = new Set(B.traces.map((t) => t.anchor));
  const portable = B.pool.filter((b) => b.roles === 0 && !anchors.has(b.id) && isPortableType(b.inv.type) && categoryOf(b.inv.type) !== "textile" &&
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
  // UV traces: marks on the photo, not objects of the room; drawn only under the UV beam.
  const traceDefs = B.traces.map((t): ObjectDef => ({
    id: t.id, photo_index: t.photo, box: t.rect, label: t.label, type: "other", archetype: null, controls: [], initial: { revealed: false },
    trace: { kind: t.kind, surface: t.surface, anchor: t.anchor, seed: t.seed },
  }));
  // A trace's anchor is always in the room, so what the trace is on or by can be checked (and named).
  const anchored = B.pool.filter((b) => B.traces.some((t) => t.anchor === b.id) && !used.includes(b) && !herrings.includes(b));
  const objects = [...[exit, ...used, ...herrings, ...anchored].map(toDef), ...traceDefs];
  const victim = mode === "crime_scene" ? B.pick(VICTIMS) : undefined;
  const definition: RoomDefinitionV2 = {
    schema_version: 2, mode,
    // No invented case names: the case is the player's own room.
    title: caseLabel(seed),
    objective: voice.objective(exit.inv.label),
    brief: B.pick(voice.briefs)({ exit: exit.inv.label, victim }),
    objects, items: B.items, cards: B.cards, finale,
  };
  const secret: RoomSecretV2 = {
    schema_version: 2, slots: B.slots, rules: B.rules, steps: B.steps, ending: B.pick(voice.endings),
    ...(mode === "crime_scene" ? { keep: [TIME_OF_DEATH] } : {}),
  };

  // A word lock's answer never stands as a word in the room's own text ("In blue ink" with INK): another word.
  for (const name of wordClashes(definition, secret)) {
    const all = [definition.objective, definition.brief ?? "", ...definition.objects.map((o) => o.label), ...definition.cards.map((c) => `${c.title} ${c.text}`),
      ...B.steps.flatMap((s) => s.hints), secret.ending].join(" ");
    const taken = new Set(Object.values(B.slots).map((s) => s.text));
    const word = WORDS.find((w) => !taken.has(w) && !new RegExp(`\\b${w}\\b`, "i").test(all));
    if (!word) return "no word for the lock that the room doesn't already say";
    B.slots[name] = { ...B.slots[name], value: word.split("").join("|"), text: word };
  }
  // Coded lines last, once every value they encode is final.
  for (const c of B.ciphers) B.slots[c.slot].value = encipher(c.of.map((s) => B.slots[s].text ?? B.slots[s].value).join(" "), Number(c.offset));
  const errors = validateDefinition(definition, secret);
  if (errors.length) return `invalid: ${errors[0]}`;

  // Structural pacing (the simulator later confirms it on the real state space).
  const required = B.steps.filter((s) => !s.optional);
  const perObject = new Map<string, number>();
  for (const s of required) if (s.object) perObject.set(s.object, (perObject.get(s.object) ?? 0) + 1);
  const revisits = [...perObject.values()].filter((k) => k >= 2).length;
  const traceIds = new Set(B.traces.filter((t) => t.lead).map((t) => t.id));
  const lights = (r: Rule) => r.trigger.on === "use" && traceIds.has(r.trigger.object) && r.effects.some((e) => e.do === "set_state");
  const roomChanges = B.rules.filter((r) => ((r.step && required.some((s) => s.id === r.step)) || lights(r)) && r.effects.some((e) => e.do === "overlay")).length;
  if (required.length < STEP_BAND.min || required.length > STEP_BAND.max) return `steps: ${required.length} outside ${STEP_BAND.min}-${STEP_BAND.max}`;
  if (revisits < 1) return "no revisit";
  if (roomChanges < 1) return "no room change";

  const photoOf = new Map([...[exit, ...B.pool].map((b) => [b.id, b.inv.photo_index] as const), ...B.traces.map((t) => [t.id, t.photo] as const)]);
  const photos = new Set(required.flatMap((s) => (s.object ? [photoOf.get(s.object)!] : []))).size;
  const allPhotos = new Set(inv.map((o) => o.photo_index)).size;
  const motifs = required.map((s) => s.motif);
  const openings = required.filter((s) => s.requires.length === 0).length;
  // Variety: the aha motifs (a torn note, a cipher) and a braid (a step needing another thread's card) score;
  // the room that is only "UV flashlight, then a lamp" scores less, so rooms don't all run the same script.
  const threadOf = new Map(B.steps.map((s) => [s.id, s.thread]));
  const braids = required.filter((s) => s.thread !== null && s.requires.some((r) => threadOf.get(r) !== null && threadOf.get(r) !== s.thread)).length;
  const has = (m: MotifId) => motifs.includes(m);
  const score = 2 * (photos / Math.min(allPhotos, 4)) + used.reduce((a, b) => a + b.inv.salience, 0) / Math.max(1, used.length) +
    0.4 * new Set(motifs).size + 0.5 * Math.min(revisits, 2) + 0.3 * Math.min(roomChanges, 2) + 0.3 * Math.min(openings, 3) -
    0.5 * Math.abs(required.length - (mode === "noir" ? 8 : 7)) + 0.6 * Math.min(braids, 1) + 0.5 * (has("decode") ? 1 : 0) + 0.4 * (has("split") ? 1 : 0) -
    (has("tool_reveal") && has("room_change") ? 0.6 : 0) +
    // The room was given its tool: a plan that uses it wins over one that doesn't.
    (B.tool === "warm" && has("warm_reveal") || B.tool === "mirror" && has("mirror_reveal") ? 0.8 : 0);
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
      const r = buildCandidate(objs, exit, opts.mode, rng, rint, threads, seededRandom(`${opts.seed}:${opts.mode}:${c}:text`), opts.seed, round === 2);
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
