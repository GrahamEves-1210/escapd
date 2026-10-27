// Hand-authored puzzle graphs (stage 7). Templates own causality; the model
// only writes prose for a graph chosen and bound here. Each template declares
// roles (which affordances may fill them) and steps that compile to the five
// schema-v1 kinds: inspect, use_item, combine, code, accuse.
//
// Rules every template follows (checked by templates_test.ts):
//   * 4-6 required steps; exit.requires is the final inspect, code or accuse.
//   * every item is granted exactly once; use_item consumes its item, combine its two inputs.
//   * a code step `requires` the step that grants its clue, and the clue is never consumed,
//     so the clue is in inventory whenever the code becomes solvable (clue coverage).
//   * one role = one distinct real object (one hotspot); hidden roles are revealed by a step.
//   * an accuse step is the exit and requires the steps granting its three evidence
//     items, which are never consumed (deducibility; prose.ts writes the evidence text).
//   * per genre (TEMPLATES_BY_GENRE): crime scene ends in one accusation; paranormal
//     ends in a banishing, three inspect/use_item steps that each require the one before.
// Code answers (4 digits), accusation answers and item/option ids are minted here
// with crypto randomness. Up to two red-herring inspects are added on unused
// objects; they grant nothing, so a herring can never hold the last copy of a required item.
import { ACCUSE_DIMENSIONS, type Dimension, type Genre, GENRES, HOTSPOT_EFFECTS, type HotspotEffect } from "./contract.ts";
import type { VerifiedObject } from "./perception.ts";
import { AFFORDANCES, type Affordance } from "./schemas.ts";
import { cryptoInt, mintCode, mintSuffix, type RandomInt, slugId } from "./mint.ts";

export type ItemKind =
  | "key" | "part" | "tool" | "lens" | "clue_full" | "clue_first" | "clue_second"
  | "evidence" | "candle" | "veil" | "charm";

export interface RoleSpec {
  key: string;
  accepts: readonly Affordance[];   // preference order; affordances not listed cannot fill the role
  hidden?: boolean;
  purpose: string;                  // told to the prose model
  effect?: HotspotEffect;           // public overlay; the brief tells the model so the text matches
}

export interface ItemSpec {
  key: string;
  kind: ItemKind;
  purpose: string;
}

export type StepKind = "inspect" | "use_item" | "combine" | "code" | "accuse";

export interface StepSpec {
  key: string;                      // becomes the puzzle id
  kind: StepKind;
  role?: string;                    // hotspot role (every kind except combine and accuse)
  item?: string;                    // use_item: consumed
  inputs?: [string, string];        // combine: consumed
  clue?: string;                    // code: item whose description carries the answer
  evidence?: Record<Dimension, string>;   // accuse: evidence item per dimension (never consumed)
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

/** Every affordance, the listed ones first: a role any object can fill. */
const anyPreferring = (first: Affordance[]): Affordance[] => first.concat(ANY.filter((a) => !first.includes(a)));

// Crime scene: three pieces of evidence (who, why, how), then the accusation.
export const CRIME_SCENE_TEMPLATES: readonly TemplateSpec[] = [
  {
    // Universal: every role accepts every affordance, so any four verified objects fit.
    name: "broken_alibi",
    summary: "One clue breaks an alibi, a key opens the motive, and a last trace shows the method; then the accusation.",
    roles: [
      { key: "timeline_spot", accepts: anyPreferring(CLUE), purpose: "inspecting it finds evidence that breaks the culprit's alibi" },
      { key: "hiding_place", accepts: anyPreferring(CACHE), purpose: "inspecting it finds a small key" },
      { key: "lock", accepts: anyPreferring(LOCK), purpose: "locked; the key opens it, and inside is evidence of the motive" },
      { key: "trace_spot", accepts: anyPreferring(FINALE), purpose: "once the lock is open, inspecting it finds evidence of the method" },
    ],
    items: [
      { key: "alibi_evidence", kind: "evidence", purpose: "evidence that breaks the culprit's alibi" },
      { key: "key", kind: "key", purpose: "opens the lock" },
      { key: "motive_evidence", kind: "evidence", purpose: "evidence of the motive" },
      { key: "method_evidence", kind: "evidence", purpose: "evidence of the method" },
    ],
    steps: [
      { key: "find_timeline", kind: "inspect", role: "timeline_spot", grants: ["alibi_evidence"] },
      { key: "find_key", kind: "inspect", role: "hiding_place", grants: ["key"] },
      { key: "open_lock", kind: "use_item", role: "lock", item: "key", grants: ["motive_evidence"] },
      { key: "find_trace", kind: "inspect", role: "trace_spot", requires: ["open_lock"], grants: ["method_evidence"] },
      {
        key: "accuse", kind: "accuse", requires: ["find_timeline", "open_lock", "find_trace"],
        evidence: { suspect: "alibi_evidence", motive: "motive_evidence", method: "method_evidence" },
      },
    ],
    exit: "accuse",
  },
  {
    name: "coded_drawer",
    summary: "A written code opens a drawer holding the motive and a hidden compartment; an alibi breaks elsewhere; then the accusation.",
    roles: [
      { key: "alibi_spot", accepts: CLUE, purpose: "inspecting it finds evidence that breaks the culprit's alibi" },
      { key: "note_spot", accepts: CLUE, purpose: "inspecting it finds the written clue with the code" },
      { key: "coded_lock", accepts: KEYPAD, purpose: "a four-digit lock; the code opens it: inside is evidence of the motive, and a hidden compartment appears" },
      { key: "compartment", accepts: FINALE, hidden: true, purpose: "hidden until the code is entered; inspecting it finds evidence of the method" },
    ],
    items: [
      { key: "alibi_evidence", kind: "evidence", purpose: "evidence that breaks the culprit's alibi" },
      { key: "clue", kind: "clue_full", purpose: "carries the four-digit code" },
      { key: "motive_evidence", kind: "evidence", purpose: "evidence of the motive" },
      { key: "method_evidence", kind: "evidence", purpose: "evidence of the method" },
    ],
    steps: [
      { key: "find_alibi", kind: "inspect", role: "alibi_spot", grants: ["alibi_evidence"] },
      { key: "find_note", kind: "inspect", role: "note_spot", grants: ["clue"] },
      {
        key: "enter_code", kind: "code", role: "coded_lock", clue: "clue", requires: ["find_note"],
        grants: ["motive_evidence"], reveals: ["compartment"],
      },
      { key: "search_compartment", kind: "inspect", role: "compartment", requires: ["enter_code"], grants: ["method_evidence"] },
      {
        key: "accuse", kind: "accuse", requires: ["find_alibi", "enter_code", "search_compartment"],
        evidence: { suspect: "alibi_evidence", motive: "motive_evidence", method: "method_evidence" },
      },
    ],
    exit: "accuse",
  },
  {
    name: "assembled_evidence",
    summary: "Two parts assemble into a tool that opens the motive and a hidden place; an alibi breaks on the way; then the accusation.",
    roles: [
      { key: "first_part_spot", accepts: CACHE, purpose: "inspecting it finds the first part of a tool, and evidence that breaks the culprit's alibi" },
      { key: "second_part_spot", accepts: CACHE, purpose: "inspecting it finds the second part of a tool" },
      { key: "mechanism", accepts: LOCK, purpose: "only the assembled tool opens it; inside is evidence of the motive, and a hidden place appears" },
      { key: "hidden_spot", accepts: FINALE, hidden: true, purpose: "hidden until the mechanism opens; inspecting it finds evidence of the method" },
    ],
    items: [
      { key: "part_a", kind: "part", purpose: "first part of the tool" },
      { key: "alibi_evidence", kind: "evidence", purpose: "evidence that breaks the culprit's alibi" },
      { key: "part_b", kind: "part", purpose: "second part of the tool" },
      { key: "tool", kind: "tool", purpose: "the assembled tool; opens the mechanism" },
      { key: "motive_evidence", kind: "evidence", purpose: "evidence of the motive" },
      { key: "method_evidence", kind: "evidence", purpose: "evidence of the method" },
    ],
    steps: [
      { key: "find_part_a", kind: "inspect", role: "first_part_spot", grants: ["part_a", "alibi_evidence"] },
      { key: "find_part_b", kind: "inspect", role: "second_part_spot", grants: ["part_b"] },
      { key: "assemble", kind: "combine", inputs: ["part_a", "part_b"], grants: ["tool"] },
      { key: "use_tool", kind: "use_item", role: "mechanism", item: "tool", grants: ["motive_evidence"], reveals: ["hidden_spot"] },
      { key: "search_hidden", kind: "inspect", role: "hidden_spot", requires: ["use_tool"], grants: ["method_evidence"] },
      {
        key: "accuse", kind: "accuse", requires: ["find_part_a", "use_tool", "search_hidden"],
        evidence: { suspect: "alibi_evidence", motive: "motive_evidence", method: "method_evidence" },
      },
    ],
    exit: "accuse",
  },
];

// Paranormal: gather what the banishing needs, then three actions in a fixed order.
export const PARANORMAL_TEMPLATES: readonly TemplateSpec[] = [
  {
    // Universal: every role accepts every affordance, so any four verified objects fit.
    name: "banishing_rite",
    summary: "A candle and a veil are found; set the candle before the name, cover the reflection, then speak the name, in that order.",
    roles: [
      { key: "candle_spot", accepts: anyPreferring(CACHE), effect: "flicker", purpose: "inspecting it finds a candle stub" },
      { key: "veil_spot", accepts: anyPreferring(["textile", "container_candidate", "surface"]), effect: "cold", purpose: "inspecting it finds a length of dark cloth, the veil" },
      { key: "reflection", accepts: anyPreferring(FINALE), effect: "apparition", purpose: "where the presence shows itself; second in the banishing, the veil covers it" },
      { key: "name_spot", accepts: anyPreferring(CLUE), effect: "whisper", purpose: "the presence's name is here; first the candle is set before it (in the story its glow falls on the name), and last, reading the name aloud ends the haunting" },
    ],
    items: [
      { key: "candle", kind: "candle", purpose: "set before the name, first in the banishing" },
      { key: "veil", kind: "veil", purpose: "covers the reflection, second in the banishing" },
    ],
    steps: [
      { key: "find_candle", kind: "inspect", role: "candle_spot", grants: ["candle"] },
      { key: "find_veil", kind: "inspect", role: "veil_spot", grants: ["veil"] },
      { key: "set_candle", kind: "use_item", role: "name_spot", item: "candle" },
      { key: "cover_reflection", kind: "use_item", role: "reflection", item: "veil", requires: ["set_candle"] },
      { key: "speak_name", kind: "inspect", role: "name_spot", requires: ["cover_reflection"] },
    ],
    exit: "speak_name",
  },
  {
    name: "moving_drawers",
    summary: "A key that moved on its own opens a lock hiding a lens and carved symbols; read them, set down the charm, then read the last words.",
    roles: [
      { key: "hiding_place", accepts: CACHE, effect: "moved", purpose: "it has moved on its own; inspecting it finds a small key" },
      { key: "cold_spot", accepts: FINALE, effect: "cold", purpose: "the coldest place in the room; inspecting it finds a charm, and second in the banishing the charm is set down here" },
      { key: "lock", accepts: LOCK, purpose: "locked; the key opens it: inside is an old lens, and carved symbols appear" },
      { key: "symbols", accepts: CLUE, hidden: true, effect: "whisper", purpose: "carved symbols, hidden until the lock opens; first they are read through the lens, and last, reading their final words ends the haunting" },
    ],
    items: [
      { key: "key", kind: "key", purpose: "opens the lock" },
      { key: "charm", kind: "charm", purpose: "set down at the cold place, second in the banishing" },
      { key: "lens", kind: "lens", purpose: "found in the lock; reads the symbols, first in the banishing" },
    ],
    steps: [
      { key: "find_key", kind: "inspect", role: "hiding_place", grants: ["key"] },
      { key: "find_charm", kind: "inspect", role: "cold_spot", grants: ["charm"] },
      { key: "open_lock", kind: "use_item", role: "lock", item: "key", grants: ["lens"], reveals: ["symbols"] },
      { key: "read_symbols", kind: "use_item", role: "symbols", item: "lens" },
      { key: "place_charm", kind: "use_item", role: "cold_spot", item: "charm", requires: ["read_symbols"] },
      { key: "final_words", kind: "inspect", role: "symbols", requires: ["place_charm"] },
    ],
    exit: "final_words",
  },
  {
    name: "seance_circle",
    summary: "Two halves of a broken charm are mended; set the candle at the altar, the charm beside it, then let the presence go.",
    roles: [
      { key: "first_spot", accepts: CACHE, effect: "whisper", purpose: "inspecting it finds half of a broken charm and a candle stub" },
      { key: "second_spot", accepts: CACHE, purpose: "inspecting it finds the other half of the charm" },
      { key: "altar", accepts: FINALE, effect: "flicker", purpose: "first the candle is set before it (in the story its glow shows where the presence stands); second, the mended charm is set beside the candle" },
      { key: "presence", accepts: anyPreferring(["wall_hanging", "other", "textile"]), hidden: true, effect: "apparition", purpose: "where the presence stands, hidden until the candle is set down; last, inspecting it lets the presence go" },
    ],
    items: [
      { key: "part_a", kind: "part", purpose: "half of the broken charm" },
      { key: "candle", kind: "candle", purpose: "set before the altar, first in the banishing" },
      { key: "part_b", kind: "part", purpose: "the other half of the charm" },
      { key: "charm", kind: "charm", purpose: "the mended charm; set beside the candle, second in the banishing" },
    ],
    steps: [
      { key: "find_first_half", kind: "inspect", role: "first_spot", grants: ["part_a", "candle"] },
      { key: "find_second_half", kind: "inspect", role: "second_spot", grants: ["part_b"] },
      { key: "mend_charm", kind: "combine", inputs: ["part_a", "part_b"], grants: ["charm"] },
      { key: "set_candle", kind: "use_item", role: "altar", item: "candle", reveals: ["presence"] },
      { key: "place_charm", kind: "use_item", role: "altar", item: "charm", requires: ["set_candle"] },
      { key: "release", kind: "inspect", role: "presence", requires: ["place_charm"] },
    ],
    exit: "release",
  },
];

/** Noir keeps the original seven; selection passes one list per room. */
export const TEMPLATES_BY_GENRE: Readonly<Record<Genre, readonly TemplateSpec[]>> = {
  noir: TEMPLATES,
  crime_scene: CRIME_SCENE_TEMPLATES,
  paranormal: PARANORMAL_TEMPLATES,
};

export const MAX_HERRINGS = 2;

// ---------------------------------------------------------------------------
// Minting (crypto randomness only)
// ---------------------------------------------------------------------------
export { cryptoInt, isWeakCode, mintCode, mintSuffix, type RandomInt, slugId } from "./mint.ts";

const ITEM_PREFIX: Record<ItemKind, string> = {
  key: "key", part: "part", tool: "tool", lens: "lens", clue_full: "note", clue_first: "scrap", clue_second: "scrap",
  evidence: "evidence", candle: "candle", veil: "veil", charm: "charm",
};

// Accusation option ids: s_ suspect, m_ motive, x_ method (unique across the whole definition).
const OPTION_PREFIX: Record<Dimension, string> = { suspect: "s", motive: "m", method: "x" };
export const OPTIONS_PER_DIMENSION = 3;

// ---------------------------------------------------------------------------
// Compiled room (structure only; prose.ts adds text)
// ---------------------------------------------------------------------------
export interface CompiledHotspot {
  id: string;
  object: VerifiedObject;
  hidden: boolean;
  role: string | null;              // null for red herrings
  purpose: string;
  effect?: HotspotEffect;
}

export interface CompiledItem {
  id: string;
  key: string;
  kind: ItemKind;
  purpose: string;
  clue?: { part: "full" | "first" | "second"; literal: string };
  evidence?: Dimension;             // which part of the accusation its description proves
}

export interface CompiledPuzzle {
  id: string;
  kind: StepKind;
  hotspotId?: string;
  requires: string[];
  itemId?: string;
  inputs?: [string, string];
  answer?: string;
  clueItemId?: string;
  /** accuse: minted option ids, the code-picked answer, and the evidence item per dimension. */
  options?: Record<Dimension, string[]>;
  accusation?: Record<Dimension, string>;
  evidence?: Record<Dimension, string>;
  rewards: { items: string[]; consume_items: string[]; reveal_hotspots: string[] };
  herring: boolean;
}

export interface CompiledRoom {
  template: string;
  summary: string;
  genre: Genre;
  code: string;                     // minted for every room; used only when a code step exists
  hotspots: CompiledHotspot[];
  items: CompiledItem[];
  puzzles: CompiledPuzzle[];
  exitPuzzleId: string;
}

export interface CompileOptions {
  randomInt?: RandomInt;
  code?: string;                    // tests only; production always mints
  genre?: Genre;                    // default: the genre whose list holds the template
}

/** The genre whose template list holds `spec` (noir for a template from none). */
export function genreOf(spec: TemplateSpec): Genre {
  return GENRES.find((g) => TEMPLATES_BY_GENRE[g].includes(spec)) ?? "noir";
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
    const hotspot: CompiledHotspot = {
      id: slugId(object.label, hotspotIds), object, hidden: role.hidden === true, role: role.key, purpose: role.purpose,
      ...(role.effect ? { effect: role.effect } : {}),
    };
    hotspots.push(hotspot);
    hotspotByRole.set(role.key, hotspot);
  }

  const itemIds = new Set<string>();
  const itemByKey = new Map<string, CompiledItem>();
  const proves = new Map<string, Dimension>();
  for (const step of spec.steps) {
    for (const d of ACCUSE_DIMENSIONS) if (step.evidence?.[d]) proves.set(step.evidence[d], d);
  }
  const items: CompiledItem[] = spec.items.map((item) => {
    let id: string;
    do id = `${ITEM_PREFIX[item.kind]}_${mintSuffix(randomInt)}`; while (itemIds.has(id));
    itemIds.add(id);
    const clue = item.kind === "clue_full" ? { part: "full" as const, literal: code }
      : item.kind === "clue_first" ? { part: "first" as const, literal: code.slice(0, 2) }
      : item.kind === "clue_second" ? { part: "second" as const, literal: code.slice(2) }
      : undefined;
    const evidence = proves.get(item.key);
    const compiled: CompiledItem = {
      id, key: item.key, kind: item.kind, purpose: item.purpose, ...(clue ? { clue } : {}), ...(evidence ? { evidence } : {}),
    };
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
      ...(step.kind !== "combine" && step.kind !== "accuse" ? { hotspotId: hotspotId(step.role!) } : {}),
      requires: [...(step.requires ?? [])],
      ...(step.kind === "use_item" ? { itemId: itemId(step.item!) } : {}),
      ...(step.kind === "combine" ? { inputs: [itemId(step.inputs![0]), itemId(step.inputs![1])] as [string, string] } : {}),
      ...(step.kind === "code" ? { answer: code, clueItemId: itemId(step.clue!) } : {}),
      ...(step.kind === "accuse"
        ? { evidence: Object.fromEntries(ACCUSE_DIMENSIONS.map((d) => [d, itemId(step.evidence![d])])) as Record<Dimension, string> }
        : {}),
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

  // Accusation options last, so their ids can avoid every hotspot, item and puzzle id.
  const taken = new Set([...hotspotIds, ...itemIds, ...puzzles.map((p) => p.id)]);
  for (const p of puzzles.filter((q) => q.kind === "accuse")) {
    const options = {} as Record<Dimension, string[]>;
    const accusation = {} as Record<Dimension, string>;
    for (const d of ACCUSE_DIMENSIONS) {
      options[d] = Array.from({ length: OPTIONS_PER_DIMENSION }, () => {
        let id: string;
        do id = `${OPTION_PREFIX[d]}_${mintSuffix(randomInt)}`; while (taken.has(id));
        taken.add(id);
        return id;
      });
      accusation[d] = options[d][randomInt(OPTIONS_PER_DIMENSION)];
    }
    p.options = options;
    p.accusation = accusation;
  }

  return {
    template: spec.name, summary: spec.summary, genre: opts.genre ?? genreOf(spec), code, hotspots, items, puzzles,
    exitPuzzleId: spec.exit,
  };
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

/** Structural self-check of a template spec, plus the rules of the genre it is listed under (used by tests). */
export function validateTemplateSpec(spec: TemplateSpec, genre: Genre = genreOf(spec)): string[] {
  const errors: string[] = [];
  const roles = new Set(spec.roles.map((r) => r.key));
  const items = new Map(spec.items.map((i) => [i.key, i]));
  const steps = new Map(spec.steps.map((s) => [s.key, s]));
  if (roles.size !== spec.roles.length) errors.push("duplicate role key");
  if (items.size !== spec.items.length) errors.push("duplicate item key");
  if (steps.size !== spec.steps.length) errors.push("duplicate step key");
  if (spec.steps.length < 4 || spec.steps.length > 6) errors.push(`needs 4-6 required steps, has ${spec.steps.length}`);
  const exit = steps.get(spec.exit);
  if (!exit || (exit.kind !== "inspect" && exit.kind !== "code" && exit.kind !== "accuse")) {
    errors.push("exit must be an inspect, code or accuse step");
  }
  const granted = new Map<string, number>();
  const consumed = new Map<string, number>();
  const revealed = new Set<string>();
  for (const s of spec.steps) {
    if (s.kind !== "combine" && s.kind !== "accuse" && !roles.has(s.role ?? "")) errors.push(`${s.key}: unknown role`);
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
    if (s.kind === "accuse") {
      if (s.role) errors.push(`${s.key}: an accusation has no hotspot`);
      if (s.key !== spec.exit) errors.push(`${s.key}: an accusation must be the exit`);
      const proof = ACCUSE_DIMENSIONS.map((d) => s.evidence?.[d] ?? "");
      if (new Set(proof).size !== ACCUSE_DIMENSIONS.length) errors.push(`${s.key}: needs a different evidence item per dimension`);
      ACCUSE_DIMENSIONS.forEach((d, i) => {
        if (items.get(proof[i])?.kind !== "evidence") errors.push(`${s.key}: ${d} evidence must be an evidence item`);
        const giver = spec.steps.find((g) => g.grants?.includes(proof[i]));
        if (!giver || !(s.requires ?? []).includes(giver.key)) errors.push(`${s.key}: must require the step granting its ${d} evidence`);
      });
    }
  }
  for (const key of items.keys()) {
    if (granted.get(key) !== 1) errors.push(`item ${key} must be granted exactly once`);
    if ((consumed.get(key) ?? 0) > 1) errors.push(`item ${key} consumed more than once`);
  }
  for (const r of spec.roles) {
    if (r.hidden && !revealed.has(r.key)) errors.push(`hidden role ${r.key} is never revealed`);
    if (r.accepts.length === 0) errors.push(`role ${r.key} accepts nothing`);
    if (r.effect !== undefined && !HOTSPOT_EFFECTS.includes(r.effect)) errors.push(`role ${r.key} has an unknown effect`);
  }

  // Evidence is read when accusing, so it must still be held: granted once (above), never consumed.
  const accusations = spec.steps.filter((s) => s.kind === "accuse");
  if (accusations.length > 1) errors.push("at most one accuse step");
  for (const item of spec.items.filter((i) => i.kind === "evidence")) {
    if (consumed.has(item.key)) errors.push(`evidence ${item.key} must never be consumed`);
    if (!accusations.some((a) => Object.values(a.evidence ?? {}).includes(item.key))) {
      errors.push(`evidence ${item.key} is not used by the accusation`);
    }
  }

  if (genre === "crime_scene" && (accusations.length !== 1 || exit?.kind !== "accuse")) {
    errors.push("a crime-scene case ends in exactly one accusation");
  }
  if (genre === "paranormal" && spec.steps.length >= 3) {
    // The banishing: the last three steps, each requiring the one before; out of order, nothing happens.
    const [a, b, c] = spec.steps.slice(-3);
    if ([a, b, c].some((s) => s.kind !== "inspect" && s.kind !== "use_item")) errors.push("the banishing uses only inspect and use_item steps");
    if (!(b.requires ?? []).includes(a.key) || !(c.requires ?? []).includes(b.key)) {
      errors.push("the last three steps must form a strict chain");
    }
    if (c.key !== spec.exit || c.kind !== "inspect") errors.push("the banishing ends the case with an inspect");
    if (!spec.roles.some((r) => r.effect)) errors.push("a paranormal case needs at least one role with an effect");
  }
  return errors;
}
