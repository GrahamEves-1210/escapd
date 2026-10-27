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

export interface CardDef {
  id: Id;
  title: string;
  text: string;                        // may contain {{slot}}; values live in the secret
}

export interface AccuseOption { id: Id; name: string }

export type FinaleDef =
  | { kind: "combination"; object: Id; wheels: number; alphabet: "digits" }
  | { kind: "accusation"; object: Id; suspects: AccuseOption[]; motives: AccuseOption[]; methods: AccuseOption[] }
  | { kind: "ritual"; object: Id; length: number };

export interface RoomDefinitionV2 {
  schema_version: 2;
  mode: Mode;
  title: string;
  objective: string;
  intro?: string;
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
  | "option" | "object" | "code";

export interface SlotValue {
  kind: SlotKind;
  value: string;                        // what rules compare ("7|2|9" for wheels)
  text?: string;                        // what cards show (defaults to value)
  from?: string[];                      // derived: never shown; known once every source is known
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
  | { do: "overlay"; object: Id; overlay: Overlay }
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
  | "ordering" | "contain_lock" | "story_fragment" | "contain" | "read" | "finale";

export interface StepDef {
  id: Id;
  title: string;
  thread: number | null;     // 0..2; null: finale or optional
  motif: MotifId;
  object?: Id;               // where the player acts
  requires: Id[];            // steps that must be solved first (planner's dependency graph)
  optional?: boolean;        // story fragments: never required
  hints: [string, string, string];  // nudge, direction, reveal (may hold {{slot}})
}

export interface RoomSecretV2 {
  schema_version: 2;
  slots: Record<string, SlotValue>;
  rules: Rule[];
  steps: StepDef[];
  ending: string;
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
  overlays: { object: Id; overlay: Overlay }[];
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
