// What the player hands to case closed, in memory: the case it just closed,
// its mode and title, the accused suspect (crime scene) and its first photo
// (paranormal shows the room back in full colour). Route params carry the
// rest. After a reload this is empty and case closed reads the session and
// definition instead.
import type { AccuseOption, Genre } from "@/lib/puzzle-types";
import type { SceneSource } from "./SceneView";

export interface ClosedCase {
  roomId: string;
  genre: Genre;
  title?: string;
  /** The accused, and whether a clue had broken their alibi (it shows struck through). */
  accused?: AccuseOption & { contradicted?: boolean };
  photo?: SceneSource;
}

let last: ClosedCase | null = null;

export function stashClosedCase(closed: ClosedCase) {
  last = closed;
}

/** The case the player just closed, when it is this room's. */
export function closedCaseFor(roomId: string): ClosedCase | null {
  return last?.roomId === roomId ? last : null;
}
