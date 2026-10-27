// The photos for this room, by slot. Each photo keeps its slot (its index in
// PLATE_PROMPTS, so "3 · Back right" always holds the view back to the right)
// for life: removing one leaves its slot open instead of sliding the others
// down, a retake replaces in place, and the camera's next shot fills the first
// open slot. Photos live in memory for the session so the camera and the
// review screen can share them. Nothing here is uploaded; send.ts uploads each
// photo with position = its slot. The roll also keeps the mode its room is
// for (openCapture({ genre }) sets it), so the build creates the room in it.
//
// And its plan (src/capture/turn.ts): how many photos go all the way round
// and each one's stop, for the lens the camera last reported in use (setRollLens;
// 1x's 6, the server's cap, before any camera has, as with library photos
// alone). The plan's count is the roll's target: the camera is full and the
// review screen stops offering "Add a photo" there. The first lens a camera
// reports gets its even circle (firstLens; photos already in weren't taken on
// stops). A lens switch after that keeps the stops of the slots in use and
// re-spaces the rest (switchLens), so the count never drops below the photos
// taken; once every stop is reached a switch changes nothing. Emptying the
// roll starts an even circle again.
import { useEffect, useSyncExternalStore } from "react";
import type { Genre } from "@/lib/puzzle-types";
import { newId } from "@/lib/uuid";
import { firstLens, rollPlan, switchLens, type RollPlan } from "./turn";
import type { LensChoice } from "./ui/rangefinder/useLenses";

export interface Plate {
  uri: string;
  width: number;
  height: number;
}

/** A slot: its photo, or null while it is open. */
export type Slot = Plate | null;

/**
 * One build attempt for the current photos: the draft room they are being
 * sent to and the idempotency key for the generation request. Reused on
 * retries so a flaky network never creates a second room or a second charge;
 * dropped whenever any slot changes, because a sent room's photos are fixed,
 * and whenever the roll's mode does.
 */
export interface Ticket {
  key: string;
  roomId: string | null;
}

// Slots up to the last filled one: no trailing open slots, so an open slot
// in here is a hole the player made by removing a photo.
let slots: readonly Slot[] = [];
// The filled photos in slot order, kept with `slots` (a stable snapshot).
let plates: readonly Plate[] = [];
let ticket: Ticket | null = null;
// The mode the room is for; null builds a noir room (the server's default).
let genre: Genre | null = null;

/** The roll's plan and the lens it is for (null: no camera has said yet). */
export interface RollPlanState {
  lens: LensChoice | null;
  plan: RollPlan;
}

/** Before any camera reports its lens: 1x's even circle, 6 photos (the server's cap). */
const UNKNOWN_LENS: LensChoice = "main";
let planState: RollPlanState = { lens: null, plan: rollPlan(UNKNOWN_LENS) };
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function commit(next: Slot[]) {
  while (next.length && next[next.length - 1] === null) next.pop();
  slots = next;
  plates = next.filter((slot): slot is Plate => slot !== null);
  ticket = null;
  // An empty roll starts the circle again, evenly, for the lens in use.
  if (next.length === 0) planState = { lens: planState.lens, plan: rollPlan(planState.lens ?? UNKNOWN_LENS) };
  notify();
}

/** The slots up to the last filled one; an open slot inside them is null. */
export function getSlots(): readonly Slot[] {
  return slots;
}

/** The filled photos in slot order (their count is what the rules count). */
export function getPlates(): readonly Plate[] {
  return plates;
}

export function subscribePlates(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSlots() {
  return useSyncExternalStore(subscribePlates, getSlots, getSlots);
}

export function usePlates() {
  return useSyncExternalStore(subscribePlates, getPlates, getPlates);
}

/** The roll's plan and its lens. */
export function getRollPlanState(): RollPlanState {
  return planState;
}

/** The roll's plan: its count (the roll's target) and stops. */
export function getRollPlan(): RollPlan {
  return planState.plan;
}

/**
 * Tells the roll which lens the camera is using now. A different lens
 * re-plans it (switchLens: the slots in use keep their stops, the rest
 * re-space); the photos and the build ticket are untouched.
 */
export function setRollLens(lens: LensChoice) {
  if (lens === planState.lens) return;
  planState = { lens, plan: replan(planState, slots.length, lens) };
  notify();
}

/** The plan for `lens` from the roll's: the first lens a camera reports (firstLens), or a switch (switchLens). */
function replan(state: RollPlanState, inUse: number, lens: LensChoice): RollPlan {
  return state.lens === null ? firstLens(state.plan, inUse, lens) : switchLens(state.plan, inUse, lens);
}

/**
 * The plan to show for `lens`, the lens in use now (null: as the roll has
 * it). A lens the roll isn't on yet is shown as its switch will plan it, in
 * this same render, and committed to the roll (setRollLens) straight after,
 * so the dial, counter and prompts follow a lens switch at once.
 */
export function useRollPlan(lens: LensChoice | null = null): RollPlan {
  const state = useSyncExternalStore(subscribePlates, getRollPlanState, getRollPlanState);
  const inUse = useSlots().length;
  useEffect(() => {
    if (lens !== null && lens !== state.lens) setRollLens(lens);
  }, [lens, state.lens]);
  return lens === null || lens === state.lens ? state.plan : replan(state, inUse, lens);
}

/**
 * The slot the camera's next shot fills: the first open one (a hole), else the
 * one after the last; null once every slot up to the roll's target (`target`,
 * its plan's count) is filled.
 */
export function firstOpenSlot(current: readonly Slot[] = slots, target = planState.plan.shots): number | null {
  const hole = current.indexOf(null);
  if (hole >= 0) return hole;
  return current.length < target ? current.length : null;
}

/** Fills the first open slot. False when every slot up to the roll's target is filled. */
export function addPlate(plate: Plate) {
  const slot = firstOpenSlot();
  if (slot === null) return false;
  const next = [...slots];
  next[slot] = plate;
  commit(next);
  return true;
}

/**
 * Puts a photo in this slot: a retake replaces in place, and an open slot
 * (one the review screen offers) is filled. Only slots up to the one after
 * the last filled, so no slot is skipped by accident, and inside the plan.
 */
export function replacePlate(slot: number, plate: Plate) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= planState.plan.shots || slot > slots.length) return false;
  const next = [...slots];
  next[slot] = plate;
  commit(next);
  return true;
}

/** Empties this slot; the others keep theirs. */
export function removePlate(slot: number) {
  if (slot < 0 || slot >= slots.length || slots[slot] === null) return false;
  const next = [...slots];
  next[slot] = null;
  commit(next);
  return true;
}

/** Empties the roll for a new one: no photos, and the plan waits for the camera's lens again. */
export function clearPlates() {
  planState = { lens: null, plan: rollPlan(UNKNOWN_LENS) };
  commit([]);
}

export function currentTicket(): Ticket {
  ticket ??= { key: newId(), roomId: null };
  return ticket;
}

export function setTicketRoom(roomId: string) {
  currentTicket().roomId = roomId;
}

/** The mode this roll's room is for, or null (noir). */
export function getRollGenre(): Genre | null {
  return genre;
}

/**
 * Sets the mode the room is for. A different mode drops the build ticket, so
 * a draft room already made for the old mode is never built in it. It stays
 * through clearPlates (a retake after a failed build keeps its mode) until
 * the next openCapture({ genre }).
 */
export function setRollGenre(next: Genre | null) {
  if (next === genre) return;
  genre = next;
  ticket = null;
}
