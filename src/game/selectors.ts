// Presentation-only selectors over the PUBLIC puzzle definition (schema v1).
//
// These choose what to draw and which widget to open. They never grant items,
// reveal hotspots, verify answers, or decide completion: submit_action is the
// only state transition, and its returned `state` replaces ours wholesale.
import type { Hotspot, Id, Puzzle, PuzzleDefinitionV1, SessionState } from "@/lib/puzzle-types";

// Every kind the player can present. Crime scene's finale is an accuse step
// (the Suspects sheet and the Accuse screen); paranormal rooms use the other
// kinds plus hotspot effects. A kind added later reports unknown_kind, so an
// older build shows "This case can't be opened here" instead of a dead end.
const KNOWN_KINDS = new Set<Puzzle["kind"]>(["inspect", "code", "use_item", "combine", "accuse"]);

const hasOptions = (options: unknown) => Array.isArray(options) && options.length > 0;

export const EMPTY_STATE: SessionState = { solved: [], inventory: [], revealed_hotspots: [] };

/**
 * Returns a reason the player cannot render this definition, or null.
 * Published rooms are validated server-side; this guards against a newer
 * schema reaching an older build.
 */
export function definitionProblem(def: unknown): string | null {
  if (!def || typeof def !== "object") return "missing_definition";
  const d = def as Partial<PuzzleDefinitionV1>;
  if (d.schema_version !== 1) return "unsupported_schema";
  if (!Array.isArray(d.photos) || d.photos.length === 0) return "no_photos";
  if (!Array.isArray(d.hotspots) || !Array.isArray(d.puzzles) || !Array.isArray(d.items)) return "malformed";
  if (!d.exit || !Array.isArray(d.exit.requires)) return "malformed";
  if (d.puzzles.some((p) => !KNOWN_KINDS.has(p.kind))) return "unknown_kind";
  // An accusation needs something to pick in each of its three lists.
  if (d.puzzles.some((p) => p.kind === "accuse" && !(hasOptions(p.suspects) && hasOptions(p.motives) && hasOptions(p.methods)))) {
    return "malformed";
  }
  if (d.hotspots.some((h) => h.photo_index < 0 || h.photo_index >= d.photos!.length)) return "bad_photo_index";
  return null;
}

/** A hotspot is drawn only once the server lists it in revealed_hotspots. */
export function isHotspotVisible(state: SessionState, hotspotId: Id) {
  return state.revealed_hotspots.includes(hotspotId);
}

const area = (h: Hotspot) => h.shape.w * h.shape.h;

/**
 * Visible hotspots on one photo, largest first. Rendering in this order puts
 * smaller rects on top, so the smaller rect wins where two overlap.
 */
export function hotspotsForScene(def: PuzzleDefinitionV1, state: SessionState, photoIndex: number): Hotspot[] {
  return def.hotspots
    .filter((h) => h.photo_index === photoIndex && isHotspotVisible(state, h.id))
    .sort((a, b) => area(b) - area(a));
}

export function hotspotById(def: PuzzleDefinitionV1, hotspotId: Id) {
  return def.hotspots.find((h) => h.id === hotspotId);
}

export function hotspotName(hotspot: Hotspot) {
  if (hotspot.name) return hotspot.name;
  return hotspot.object_label.charAt(0).toUpperCase() + hotspot.object_label.slice(1);
}

const requiresMet = (puzzle: Puzzle, state: SessionState) =>
  (puzzle.requires ?? []).every((id) => state.solved.includes(id));

const isOpen = (puzzle: Puzzle, state: SessionState) =>
  !state.solved.includes(puzzle.id) && requiresMet(puzzle, state);

/** The code puzzle the player can attempt at this hotspot right now, if any. */
export function availableCodePuzzle(def: PuzzleDefinitionV1, state: SessionState, hotspotId: Id): Puzzle | undefined {
  if (!isHotspotVisible(state, hotspotId)) return undefined;
  return def.puzzles.find((p) => p.kind === "code" && p.hotspot_id === hotspotId && isOpen(p, state));
}

export type TapIntent = { kind: "code"; puzzle: Puzzle } | { kind: "accuse"; puzzle: Puzzle } | { kind: "inspect" };

/**
 * Which widget a plain tap opens. A code puzzle opens the keypad; an open
 * accusation placed on this hotspot (a case board) opens the Accuse screen;
 * everything else sends `inspect` and lets the server decide. We never skip
 * the request on a guess that it would do nothing: a wrong guess here would softlock.
 */
export function tapIntent(def: PuzzleDefinitionV1, state: SessionState, hotspotId: Id): TapIntent {
  const puzzle = availableCodePuzzle(def, state, hotspotId);
  if (puzzle) return { kind: "code", puzzle };
  const accuse = accusePuzzle(def);
  if (accuse?.hotspot_id === hotspotId && isHotspotVisible(state, hotspotId) && isOpen(accuse, state)) {
    return { kind: "accuse", puzzle: accuse };
  }
  return { kind: "inspect" };
}

// ---------------------------------------------------------------------------
// Crime scene: the accusation and the suspects.
// ---------------------------------------------------------------------------

/** The case's accusation (crime scene's finale), if it has one. */
export function accusePuzzle(def: PuzzleDefinitionV1): Puzzle | undefined {
  return def.puzzles.find((p) => p.kind === "accuse");
}

/**
 * The accusation can be made: it is unsolved and every step it requires (the
 * evidence) is solved. The server still checks the triple; this only enables
 * the Accuse button.
 */
export function canAccuse(def: PuzzleDefinitionV1, state: SessionState): boolean {
  const puzzle = accusePuzzle(def);
  return !!puzzle && isOpen(puzzle, state);
}

export interface SuspectCard {
  id: Id;
  name: string;
  role?: string;
  alibi?: string;
  /** A clue the player holds breaks this suspect's alibi (state.contradicted). */
  contradicted: boolean;
}

/** The accusation's suspects in the definition's order, each marked when the server lists it in state.contradicted. */
export function suspectCards(def: PuzzleDefinitionV1, state: SessionState): SuspectCard[] {
  const contradicted = state.contradicted ?? [];
  return (accusePuzzle(def)?.suspects ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    alibi: s.alibi,
    contradicted: contradicted.includes(s.id),
  }));
}

/** Suspects whose alibi broke between two states (newly in `contradicted`), for the result sheet. */
export function newlyContradicted(def: PuzzleDefinitionV1, before: SessionState, after: SessionState): SuspectCard[] {
  const was = new Set(before.contradicted ?? []);
  return suspectCards(def, after).filter((s) => s.contradicted && !was.has(s.id));
}

/** One suspect, motive or method by id: the accused card on case closed. */
export function suspectById(def: PuzzleDefinitionV1, id: Id | undefined) {
  return id ? accusePuzzle(def)?.suspects?.find((s) => s.id === id) : undefined;
}

// ---------------------------------------------------------------------------
// Paranormal: the presence.
// ---------------------------------------------------------------------------

/** Hotspots with an effect: the room's anomalies, visible or still hidden. */
export function anomalies(def: PuzzleDefinitionV1): Hotspot[] {
  return def.hotspots.filter((h) => h.effect !== undefined);
}

/**
 * An anomaly is found once a step on it is solved (its inspect, or an item
 * used there), or, for one that was hidden, once the server reveals it.
 */
export function isAnomalyFound(def: PuzzleDefinitionV1, state: SessionState, hotspot: Hotspot): boolean {
  if (hotspot.hidden && isHotspotVisible(state, hotspot.id)) return true;
  return def.puzzles.some((p) => p.hotspot_id === hotspot.id && state.solved.includes(p.id));
}

export interface Presence {
  found: number;
  total: number;
}

/** "The presence": anomalies found out of all of them. Zero total means the case has no presence meter. */
export function presence(def: PuzzleDefinitionV1, state: SessionState): Presence {
  const all = anomalies(def);
  return { found: all.filter((h) => isAnomalyFound(def, state, h)).length, total: all.length };
}

/** The meter's accessibility label, e.g. "The presence: 2 of 5". */
export function presenceLabel({ found, total }: Presence) {
  return `The presence: ${found} of ${total}`;
}

export type QuietReason = "needs_item" | "locked" | "spent" | "plain";

/** Every puzzle on this hotspot is already solved. Combine and accuse puzzles have no hotspot. */
export function isHotspotSolved(def: PuzzleDefinitionV1, state: SessionState, hotspotId: Id) {
  const here = def.puzzles.filter((p) => p.hotspot_id === hotspotId && p.kind !== "combine");
  return here.length > 0 && here.every((p) => state.solved.includes(p.id));
}

/**
 * Why an `inspect` came back `nothing`; the words, per mode, are
 * src/render/voice.ts (PlayVoice.quiet), and never name the missing item.
 * - needs_item: an unsolved use_item puzzle lives here ("Something's missing.")
 * - locked: an unsolved puzzle here is still waiting on another step
 * - spent: everything here is already solved
 * - plain: nothing here was ever part of the case
 */
export function quietReason(def: PuzzleDefinitionV1, state: SessionState, hotspotId: Id): QuietReason {
  const here = def.puzzles.filter((p) => p.hotspot_id === hotspotId && p.kind !== "combine");
  if (here.length === 0) return "plain";
  const unsolved = here.filter((p) => !state.solved.includes(p.id));
  if (unsolved.length === 0) return "spent";
  if (unsolved.some((p) => p.kind === "use_item")) return "needs_item";
  return "locked";
}

export interface InventoryItem {
  id: Id;
  name: string;
  description?: string;
}

/**
 * Items the server has placed in the inventory, in inventory order.
 * Descriptions often carry clues, so an item's description is read only once
 * its id is in state.inventory. Never look items up from def.items directly
 * for display.
 */
export function inventoryItems(def: PuzzleDefinitionV1, state: SessionState): InventoryItem[] {
  return state.inventory.flatMap((id) => {
    const item = def.items.find((i) => i.id === id);
    return item ? [{ id: item.id, name: item.name, description: item.description }] : [];
  });
}

/** Names and descriptions for items just gained. Only valid after the server granted them. */
export function gainedItems(def: PuzzleDefinitionV1, state: SessionState, ids: Id[] | undefined): InventoryItem[] {
  return inventoryItems(def, state).filter((item) => ids?.includes(item.id));
}

export function itemName(def: PuzzleDefinitionV1, state: SessionState, id: Id) {
  return inventoryItems(def, state).find((i) => i.id === id)?.name ?? "item";
}

/** Photo indexes holding hotspots that were just revealed. */
export function scenesWithHotspots(def: PuzzleDefinitionV1, hotspotIds: Id[] | undefined): number[] {
  const scenes = new Set<number>();
  for (const id of hotspotIds ?? []) {
    const h = hotspotById(def, id);
    if (h) scenes.add(h.photo_index);
  }
  return [...scenes].sort((a, b) => a - b);
}

export type HotspotMode = { kind: "default" } | { kind: "use"; itemName: string };

/** Accessibility label for a hotspot, e.g. "Desk drawer, inspectable". */
export function hotspotA11yLabel(def: PuzzleDefinitionV1, state: SessionState, hotspot: Hotspot, mode: HotspotMode) {
  const name = hotspotName(hotspot);
  if (mode.kind === "use") return `${name}, use ${mode.itemName} here`;
  const intent = tapIntent(def, state, hotspot.id).kind;
  if (intent === "code") return `${name}, enter a code`;
  if (intent === "accuse") return `${name}, make your accusation`;
  return `${name}, inspectable`;
}

export interface ExploreEntry {
  hotspot: Hotspot;
  photoIndex: number;
  name: string;
  intent: TapIntent;
}

/**
 * The "Explore as list" fallback: every revealed hotspot across all photos,
 * in photo order. Hidden hotspots stay out until the server reveals them.
 */
export function exploreEntries(def: PuzzleDefinitionV1, state: SessionState): ExploreEntry[] {
  return def.hotspots
    .filter((h) => isHotspotVisible(state, h.id))
    .sort((a, b) => a.photo_index - b.photo_index)
    .map((h) => ({ hotspot: h, photoIndex: h.photo_index, name: hotspotName(h), intent: tapIntent(def, state, h.id) }));
}

/** Expected answer length for the keypad, when the format states one. */
export function codeLength(puzzle: Puzzle): number | undefined {
  return puzzle.answer_format?.length;
}

export function codeKind(puzzle: Puzzle): "digits" | "letters" | "text" {
  return puzzle.answer_format?.kind ?? "text";
}
