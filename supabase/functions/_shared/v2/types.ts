// Schema v2: a room is data the engine interprets.
//
//   RoomDefinitionV2 (public): objects with their archetype, controls and initial
//     state, items, card templates with {{slot}} placeholders, and the finale's
//     public shape. Safe to send to the client: it holds no answer.
//   RoomSecretV2 (server only): slot values, rules (conditions -> effects), the
//     step graph with hint ladders, and the ending. The engine needs both.
//   PlayState: one session's state; JSON, deterministic, server-owned.
import type { ArchetypeId, ControlDomain } from "./archetypes.ts";
import type { ObjectType } from "./taxonomy.ts";

export type Id = string; // ^[a-z0-9][a-z0-9_-]{0,63}$
export type Mode = "noir" | "crime_scene" | "paranormal";
export const MODES: readonly Mode[] = ["noir", "crime_scene", "paranormal"];

export interface Rect { x: number; y: number; w: number; h: number } // normalized 0..1

export type StateValue = string | number | boolean;

export interface ControlDef {
  id: string;            // e.g. "open", "time", "freq", "page", "on", "offset", "taken"
  domain: ControlDomain;
}

export interface ObjectDef {
  id: Id;
  photo_index: number;
  box: Rect;
  label: string;
  type: ObjectType;
  archetype: ArchetypeId | null;      // null: look-only scenery
  variant?: string;                    // archetype variant ("pages", "uv", "accusation", ...)
  controls: ControlDef[];
  submit?: ControlDomain;              // locks and the exit: what a submit takes
  initial: Record<string, StateValue>; // initial object state (control values and flags)
  hidden?: boolean;                    // not tappable until a reveal effect
  removable?: boolean;                 // at most one per room: taking it removes it from the photo
  exit?: boolean;                      // exactly one: the door the finale opens
  /** The object's real outline in photo fractions (0..1), closed, at most 64 points: the glint
   *  hugs it. From Gemini's segmentation (segment.ts); absent on older rooms or when it failed. */
  outline?: { x: number; y: number }[];
  /** A UV trace on the photo (prints, a stain, footprints, writing): not an object of the room but a
   *  mark on or near one, drawn only under the UV beam. The torch used on it reveals it (state
   *  `revealed`); the magnifier on it then reads its forensics report. Never tappable by itself. */
  trace?: TraceSpec;
}

export const TRACE_KINDS = ["prints", "palm", "writing", "stain", "footprints"] as const;
export type TraceKind = typeof TRACE_KINDS[number];

// What can be seen in a trace under the UV light. The app draws these and the player compares them with
// other evidence (a boot's size and tread against a cobbler's ticket, a fingerprint's pattern against a
// police ten-card, a hand against a handwriting sample). No report ever says what a trace means.
export const TRACE_SIZES = ["small", "medium", "large"] as const;
export type TraceSize = typeof TRACE_SIZES[number];
/** A sole's pattern; "bare": bare feet (toes, no sole). */
export const TRACE_TREADS = ["bars", "zigzag", "rings", "bare"] as const;
export type TraceTread = typeof TRACE_TREADS[number];
export const TRACE_PATTERNS = ["whorl", "loop", "arch"] as const;
export type TracePattern = typeof TRACE_PATTERNS[number];
export const TRACE_STAINS = ["wine", "coffee", "ink", "wax", "bourbon"] as const;
export type TraceStain = typeof TRACE_STAINS[number];
export const TRACE_HANDS = ["left-slant", "right-slant", "block"] as const;
export type TraceHand = typeof TRACE_HANDS[number];

export interface TraceSpec {
  kind: TraceKind;
  /** Where it lies: on the anchor object itself, on the wall beside it, or on the floor by it. */
  surface: "on" | "wall" | "floor";
  /** The real object it is on or near. */
  anchor: Id;
  /** Seeds the procedural drawing (whorls, droplets, the stride), so it looks the same every time. */
  seed: number;
  // What it looks like (all optional: rooms stored before these have none, and are drawn from `seed` alone).
  /** footprints: how big the foot is. */
  size?: TraceSize;
  /** footprints: the sole's pattern, or bare feet. */
  tread?: TraceTread;
  /** prints, palm: the ridge pattern of the fingertips. */
  pattern?: TracePattern;
  /** prints, palm: a scar line across it. */
  scar?: boolean;
  /** stain: what was spilt. */
  stain?: TraceStain;
  /** writing: the hand it is written in. */
  hand?: TraceHand;
  /**
   * writing: the words, when they hold no answer (a threat on a wall). Writing that holds an answer (a
   * code, a ritual line) is never in the public definition: its words arrive when the UV light first
   * finds it, as the glow mark's text (the action's `overlay` effect, kept in PlayState.overlays[].mark).
   */
  text?: string;
}

export interface ItemDef {
  id: Id;
  name: string;
  kind: "prop" | "tool" | "key" | "half" | "assembled" | "decoder" | "taken";
  archetype?: ArchetypeId;             // inventory archetypes: Assemble, Decoder, Light (uv torch)
  variant?: string;
  controls?: ControlDef[];             // e.g. the decoder's offset ring
  card?: Id;                           // what examining it shows
}

export const CARD_LOOKS = ["impression"] as const;
export type CardLook = typeof CARD_LOOKS[number];

/**
 * How a card's writing comes to light, for the app to play (the card's text is what is revealed):
 *   heat    a blank letter in lemon juice, warmed at a lamp that's on;
 *   mirror  a note in mirror writing, held to the room's mirror;
 *   rub     a notepad whose top sheet was torn off, rubbed over with a pencil: the dents show white;
 *   lens    a card printed in a jumble of red and blue, read through a red lens;
 *   fold    a page whose two outer strips fold to meet, lining two halves of writing up into one line;
 *   tune    a small music box, cranked: it plays a run of notes, and their order is the information. The
 *           card's text is exactly the run: four marks from SYMBOLS ("▲ ● ◆ ■ ★ ✚", one per tooth of the
 *           comb, low to high), separated by single spaces, e.g. "◆ ★ ▲ ●". It is the code of a lock whose
 *           four wheels carry the same marks;
 *   ribbon  a typewriter ribbon spool, pulled out: the last line typed is on it. The card's text is that
 *           line as typed, left to right ("Never the first: what holds the light."); the app draws it on
 *           the ribbon in mirror image, right to left.
 */
export const REVEALS = ["heat", "mirror", "rub", "lens", "fold", "tune", "ribbon"] as const;
export type Reveal = typeof REVEALS[number];

export interface CardDef {
  id: Id;
  title: string;
  text: string;                        // may contain {{slot}}; values live in the secret
  /** Writing found with a tool (absent: just read): the app shows it coming up that way. */
  reveal?: Reveal;
  /**
   * Drawn, never printed. "impression": a key pressed into soap or wax; the card's text is exactly its
   * {{slot}}, a key's cuts bow to tip ("20313", depths 0-3), and the app draws the impression from it.
   */
  look?: CardLook;
}

export interface AccuseOption { id: Id; name: string }

export type FinaleDef =
  | { kind: "combination"; object: Id; wheels: number; alphabet: "digits" }
  | { kind: "accusation"; object: Id; suspects: AccuseOption[]; motives: AccuseOption[]; methods: AccuseOption[] }
  | { kind: "ritual"; object: Id; length: number };

export interface RoomDefinitionV2 {
  schema_version: 2;
  mode: Mode;
  /** A neutral case label ("Case no. 04127"): rooms have no invented names. */
  title: string;
  objective: string;
  /** The pre-game brief: two to four sentences in the mode's voice (what happened, who you are, what to find). */
  brief?: string;
  intro?: string;
  /** The room's photos, in photo_index order (stored rooms; a room planned on the device has none). */
  photos?: { photo_id: string }[];
  objects: ObjectDef[];
  items: ItemDef[];
  cards: CardDef[];
  finale: FinaleDef;
}

// ---------------------------------------------------------------------------
// Secret
// ---------------------------------------------------------------------------
export type SlotKind =
  | "time" | "freq" | "page" | "offset" | "digits" | "letters" | "symbols" | "cipher"
  | "option" | "object" | "code"
  // A telephone number (dialled on a rotary telephone).
  | "phone";

/**
 * Where a ritual fragment says its offering goes (paranormal), relative to a three-offering order:
 * the fragments together leave exactly one order (the simulator checks it), so the order is deduced.
 */
export const ORDER_RULES = ["first", "last", "middle", "not_first", "not_last", "not_middle"] as const;
export type OrderRule = typeof ORDER_RULES[number];

/** Whether `rule` holds for place `k` (0-based) of an order of `n`. */
export function orderHolds(rule: OrderRule, k: number, n: number): boolean {
  const first = k === 0, last = k === n - 1;
  switch (rule) {
    case "first": return first;
    case "last": return last;
    case "middle": return !first && !last;
    case "not_first": return !first;
    case "not_last": return !last;
    case "not_middle": return first || last;
  }
}

/**
 * Crime scene: what one suspect's document states (a shoe size and sole, a fingerprint pattern, a hand),
 * to be set against a trace on the photo that shows otherwise. Nothing says they differ: the player
 * compares. `words`: the document's load-bearing words ("twelves", "whorls"), which a rewrite keeps.
 */
export interface TraceMatch {
  trace: Id;
  shows: { size?: TraceSize; tread?: TraceTread; pattern?: TracePattern; hand?: TraceHand };
  words: string[];
}

export interface SlotValue {
  kind: SlotKind;
  value: string;                        // what rules compare ("7|2|9" for wheels)
  text?: string;                        // what cards show (defaults to value)
  from?: string[];                      // derived: never shown; known once every source is known
  /** A ritual offering's slot: what its fragment says about its place in the order (absent on older rooms). */
  order?: OrderRule;
  /** A ruled-out suspect's slot: its document rules them out only against this trace (crime scene). */
  match?: TraceMatch;
  /** An order learned on a balance (the item's id): known once the weighings done there settle it. Never on a card. */
  weigh?: Id;
}

/** A literal or a slot reference. Minted answers are always slots. */
export type Value = { slot: string } | { lit: StateValue };

export type Trigger =
  | { on: "inspect"; object: Id }
  | { on: "control"; target: Id; control: string }   // object or held item
  | { on: "use"; item: Id; object: Id }
  | { on: "combine"; items: [Id, Id] }
  | { on: "submit"; object: Id }
  | { on: "auto" };                                  // checked after every action

export type Condition =
  | { if: "control"; target: Id; control: string; eq: Value }
  | { if: "state"; target: Id; key: string; eq: Value }
  | { if: "submitted"; eq: Value }
  | { if: "holds"; item: Id }
  | { if: "solved"; step: Id };

export const OVERLAYS = ["light_on", "panel_open", "glow_mark", "pinned_card", "object_removed"] as const;
export type Overlay = typeof OVERLAYS[number];

export type Effect =
  | { do: "open"; object: Id }
  | { do: "close"; object: Id }
  | { do: "reveal"; object: Id }
  | { do: "grant"; item: Id }
  | { do: "consume"; item: Id }
  | { do: "set_state"; target: Id; key: string; value: StateValue }
  | { do: "show_card"; card: Id }
  | { do: "beat"; text: string }
  /** `text` (glow_mark): what is written there, with {{slot}}s; drawn on the object once revealed. */
  | { do: "overlay"; object: Id; overlay: Overlay; text?: string }
  | { do: "complete" };

export interface Rule {
  id: Id;
  step?: Id;                 // the step this rule solves (absent: no progress, e.g. flavour)
  trigger: Trigger;
  when: Condition[];
  effects: Effect[];
}

export type MotifId =
  | "split" | "set_state" | "cross_reference" | "decode" | "tool_reveal" | "room_change"
  | "ordering" | "contain_lock" | "story_fragment" | "contain" | "read" | "finale"
  // A found note that only reads with something in the room: lemon juice warmed at a lit lamp; mirror writing held to a mirror.
  | "warm_reveal" | "mirror_reveal"
  // Hands-on reveals that need nothing in the room: a pencil rubbed over a dented notepad; a red lens over a card
  // printed in red and blue; a page folded so its two edges meet.
  | "rub_reveal" | "lens_reveal" | "fold_reveal"
  // A music box cranked (its run of notes is a lock's order); a typewriter ribbon pulled out (the last line typed).
  | "tune_reveal" | "ribbon_reveal"
  // Three found weights compared on a small balance: their order, heaviest first, is a lock's.
  | "weigh";

export interface StepDef {
  id: Id;
  title: string;
  thread: number | null;     // 0..2; null: finale or optional
  motif: MotifId;
  object?: Id;               // where the player acts
  requires: Id[];            // steps that must be solved first (planner's dependency graph)
  optional?: boolean;        // story fragments: never required
  hints: [string, string, string];  // nudge, direction, reveal (may hold {{slot}})
  /** Why, in the room's world, this clue is where it is and works as it does ("the clock stopped at the
   *  moment that mattered"): for the author to explain the step. Never shown as is; no slots, no digits. */
  why?: string;
}

export interface RoomSecretV2 {
  schema_version: 2;
  slots: Record<string, SlotValue>;
  rules: Rule[];
  steps: StepDef[];
  ending: string;
  /**
   * What each weight weighs (item id -> any number; only the order matters), for a room with a balance.
   * Server only: the player sees which pan dips, never a number.
   */
  weights?: Record<Id, number>;
  /** Facts the words must keep (crime scene: the time of death the alibis are read against): the
   *  author's objective and brief are kept only if they still state each one. */
  keep?: string[];
}

// ---------------------------------------------------------------------------
// Play
// ---------------------------------------------------------------------------
export interface PlayState {
  objects: Record<Id, Record<string, StateValue>>;  // object state, incl. hidden/removed flags
  items: Record<Id, Record<string, StateValue>>;    // held items' control values
  inventory: Id[];
  solved: Id[];
  fired: Id[];
  cards: Id[];
  seen: Id[];
  /** `mark`: a glow mark's writing, rendered (the player has revealed it). */
  overlays: { object: Id; overlay: Overlay; mark?: string }[];
  completed: boolean;
}

export type Action =
  | { type: "inspect"; object: Id }
  | { type: "set_control"; target: Id; control: string; value: StateValue }  // committed on release
  | { type: "use_item"; item: Id; object: Id }
  | { type: "combine"; items: [Id, Id] }
  | { type: "submit"; object: Id; value: string[] };  // wheels, [suspect, motive, method], or ritual object ids

/** What the client may see of an effect: card text is rendered; no answer appears otherwise. */
export type PublicEffect =
  | Exclude<Effect, { do: "show_card" } | { do: "complete" }>
  | { do: "show_card"; card: Id; title: string; text: string }
  | { do: "solved"; step: Id }
  | { do: "complete"; ending: string };

export type Outcome = "ok" | "nothing" | "wrong" | "locked" | "invalid";

export interface ActionResult {
  outcome: Outcome;
  reason?: string;           // invalid: "unknown_object" | "hidden" | "removed" | "not_held" | "bad_value" | "cooldown" | "completed" | ...
  effects: PublicEffect[];
  /** Set on a wrong submit: the server should start its wrong-answer cooldown. */
  start_cooldown?: boolean;
  completed?: boolean;
}

export interface ApplyOptions {
  /** The server says a wrong-answer cooldown is running: submits are refused unevaluated. */
  cooldownActive?: boolean;
}
