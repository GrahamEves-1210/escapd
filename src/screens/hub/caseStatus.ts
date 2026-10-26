// What home's mode cards say (MODES_PROMPT.md Part 2). Pure: no React, no network.
import type { GameSession } from "@/lib/escapd-api";
import type { Genre } from "@/lib/puzzle-types";
import { caseCount } from "@/screens/mode/caseFiles";

/** The Study's entry, from the latest tutorial session (an abandoned one unseals again, as the title screen did). */
export type StudyEntry = "unseal" | "continue" | "replay";

export function studyEntry(session: Pick<GameSession, "status"> | null): StudyEntry {
  if (session?.status === "active") return "continue";
  if (session?.status === "completed") return "replay";
  return "unseal";
}

/** Each mode's number of cases (rooms sent to be built: building, ready or failed). */
export type ModeCounts = Record<Genre, number>;

export const NO_CASES: ModeCounts = { noir: 0, crime_scene: 0, paranormal: 0 };

export function countByGenre(rooms: readonly { genre: Genre }[]): ModeCounts {
  const counts: ModeCounts = { ...NO_CASES };
  for (const room of rooms) if (room.genre in counts) counts[room.genre] += 1;
  return counts;
}

/** The card's one accessibility label: "Detective Noir. Solve the case. 2 cases" (no count while it loads). */
export function modeCardLabel(name: string, tagline: string, count: number | undefined): string {
  return count === undefined ? `${name}. ${tagline}.` : `${name}. ${tagline}. ${caseCount(count)}`;
}

// Noir's first tap (The Study) failing: today's inline-error copy.
export const STUDY_OFFLINE = "You're offline. Connect to begin.";
export const STUDY_FAILED = "Couldn't start the case. Try again in a moment.";
