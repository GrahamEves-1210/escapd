// What home's mode cards know and say (MODES_PROMPT.md Part 2, round 6). Pure: no React, no network.
import type { Href } from "expo-router";
import type { GameSession, Room } from "@/lib/escapd-api";
import type { Genre } from "@/lib/puzzle-types";

/** The Study's entry, from the latest tutorial session (an abandoned one unseals again, as the title screen did). */
export type StudyEntry = "unseal" | "continue" | "replay";

export function studyEntry(session: Pick<GameSession, "status"> | null): StudyEntry {
  if (session?.status === "active") return "continue";
  if (session?.status === "completed") return "replay";
  return "unseal";
}

/**
 * A case the player can go back to in a mode, which home's continue prompt
 * resumes:
 * - play: a ready room not completed (never played, in progress, or its last
 *   run abandoned by "Restart this case"): /play/<id>;
 * - build: a room still building (queued or generating): the build wait;
 * - study: noir only, The Study left part-way (its session active) while the
 *   player has no case of their own to go back to: /tutorial.
 */
export type CaseToContinue = { kind: "play"; roomId: string } | { kind: "build"; roomId: string } | { kind: "study" };

/** Each mode's case to go back to; null for none. */
export type ModeCases = Record<Genre, CaseToContinue | null>;

export const NO_CASES: ModeCases = { noir: null, crime_scene: null, paranormal: null };

/**
 * Each mode's newest sent room, from listMyRooms (newest first; drafts are
 * never listed, so a photographed but unsent room is no case).
 */
export function newestByGenre<R extends Pick<Room, "genre">>(rooms: readonly R[]): Partial<Record<Genre, R>> {
  const newest: Partial<Record<Genre, R>> = {};
  for (const room of rooms) if (!newest[room.genre]) newest[room.genre] = room;
  return newest;
}

/**
 * The case to go back to, from a mode's newest room and (when it is ready)
 * that room's latest session: building, or ready and not completed. A
 * completed, failed or draft newest room is none, even when an older room is
 * still open: the newest room is the one the player last started.
 */
export function caseToContinue(
  room: Pick<Room, "id" | "status"> | undefined,
  session: Pick<GameSession, "status"> | null | undefined,
): CaseToContinue | null {
  if (!room) return null;
  if (room.status === "queued" || room.status === "generating") return { kind: "build", roomId: room.id };
  if (room.status === "ready" && session?.status !== "completed") return { kind: "play", roomId: room.id };
  return null;
}

/** Noir's case: the player's own first; else The Study while it is part-way through. */
export function noirCase(own: CaseToContinue | null, study: StudyEntry): CaseToContinue | null {
  return own ?? (study === "continue" ? { kind: "study" } : null);
}

/** Where Continue goes: the player, the build wait (as the old case files did), or The Study. */
export function continueHref(target: CaseToContinue): Href {
  switch (target.kind) {
    case "play":
      return { pathname: "/play/[roomId]", params: { roomId: target.roomId } };
    case "build":
      return { pathname: "/capture/develop", params: { roomId: target.roomId } };
    case "study":
      return "/tutorial";
  }
}

/** The card's one accessibility label: "Detective Noir. Solve the case." */
export function modeCardLabel(name: string, tagline: string): string {
  return `${name}. ${tagline}.`;
}

// A card's tap failing before it could choose (offline, or the server): plain words, as the old Study notice.
export const NOTICE_OFFLINE = "You're offline. Connect to begin.";
export const NOTICE_FAILED = "Couldn't start the case. Try again in a moment.";
