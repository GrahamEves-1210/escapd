// The photos for this room, by slot. Each photo keeps its slot (its index in
// PLATE_PROMPTS, so "2 · Opposite corner" always holds the opposite corner)
// for life: removing one leaves its slot open instead of sliding the others
// down, a retake replaces in place, and the camera's next shot fills the first
// open slot. Photos live in memory for the session so the camera and the
// review screen can share them. Nothing here is uploaded; send.ts uploads each
// photo with position = its slot. The roll also keeps the mode its room is
// for (openCapture({ genre }) sets it), so the build creates the room in it.
import { useSyncExternalStore } from "react";
import type { Genre } from "@/lib/puzzle-types";
import { newId } from "@/lib/uuid";
import { MAX_PLATES } from "./slots";

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
const listeners = new Set<() => void>();

function commit(next: Slot[]) {
  while (next.length && next[next.length - 1] === null) next.pop();
  slots = next;
  plates = next.filter((slot): slot is Plate => slot !== null);
  ticket = null;
  for (const listener of listeners) listener();
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

/**
 * The slot the camera's next shot fills: the first open one (a hole), else the
 * one after the last; null once every slot up to MAX_PLATES is filled.
 */
export function firstOpenSlot(current: readonly Slot[] = slots): number | null {
  const hole = current.indexOf(null);
  if (hole >= 0) return hole;
  return current.length < MAX_PLATES ? current.length : null;
}

/** Fills the first open slot. False when all MAX_PLATES are filled. */
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
 * the last filled, so no slot is skipped by accident.
 */
export function replacePlate(slot: number, plate: Plate) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_PLATES || slot > slots.length) return false;
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

export function clearPlates() {
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
