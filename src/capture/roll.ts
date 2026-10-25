// The film roll for this test. Plates live in memory for the session so the
// rangefinder and the light table can share them. Nothing here is uploaded.
import { useSyncExternalStore } from "react";
import { newId } from "@/lib/uuid";
import { MAX_PLATES } from "./slots";

export interface Plate {
  uri: string;
  width: number;
  height: number;
}

/**
 * One development attempt for the current plates: the draft room they are
 * being sent to and the idempotency key for the generation request. Reused on
 * retries so a flaky network never creates a second room or a second charge;
 * dropped whenever the plates change, because a sent room's photos are fixed.
 */
export interface Ticket {
  key: string;
  roomId: string | null;
}

let plates: Plate[] = [];
let ticket: Ticket | null = null;
const listeners = new Set<() => void>();

function emit() {
  ticket = null;
  for (const listener of listeners) listener();
}

export function getPlates() {
  return plates;
}

export function subscribePlates(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePlates() {
  return useSyncExternalStore(subscribePlates, getPlates, getPlates);
}

export function addPlate(plate: Plate) {
  if (plates.length >= MAX_PLATES) return false;
  plates = [...plates, plate];
  emit();
  return true;
}

export function replacePlate(index: number, plate: Plate) {
  if (index < 0 || index >= plates.length) return false;
  plates = plates.map((current, i) => (i === index ? plate : current));
  emit();
  return true;
}

export function removePlate(index: number) {
  if (index < 0 || index >= plates.length) return false;
  plates = plates.filter((_, i) => i !== index);
  emit();
  return true;
}

export function clearPlates() {
  plates = [];
  emit();
}

export function currentTicket(): Ticket {
  ticket ??= { key: newId(), roomId: null };
  return ticket;
}

export function setTicketRoom(roomId: string) {
  currentTicket().roomId = roomId;
}
