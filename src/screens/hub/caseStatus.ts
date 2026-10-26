// What each game card says and does (docs/DESIGN.md, 01 · Game mode:
// Tappable elements, States and Case status). Pure: no React, no network.
import type { GameSession, Room } from "@/lib/escapd-api";

export type CardId = "study" | "room" | "case";

/** THE STUDY's entry, from the latest tutorial session (an abandoned one unseals again, as the title screen did). */
export type StudyEntry = "unseal" | "continue" | "replay";

/** YOUR CASE, from the newest own room and, for a ready room, its latest session. */
export type CaseState =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "offline" }
  | { kind: "tryLater" }
  | { kind: "ready"; roomId: string; progress: "open" | "continue" | "replay" }
  | { kind: "developing"; roomId: string }
  | { kind: "failed"; roomId: string };

/** The tag pills' labels (ref.type.tag, uppercase). */
export const TAGS: Record<CardId, string> = {
  study: "THE STUDY",
  room: "YOUR ROOM",
  case: "YOUR CASE",
};

// State lines are ref.type.meta (UI text), so sentence case, the building
// thinking line included.
const STUDY_NOTE: Record<StudyEntry, string> = { unseal: "Unseal", continue: "Continue", replay: "Replay" };
// Today's title-screen labels, prefixed with the card's name.
const STUDY_LABEL: Record<StudyEntry, string> = {
  unseal: "The Study. Unseal the first case.",
  continue: "The Study. Continue the first case.",
  replay: "The Study. Replay the first case.",
};

export const ROOM_NOTE = "Photograph";
export const ROOM_LABEL = "Your room. Photograph a room.";

export function studyEntry(session: Pick<GameSession, "status"> | null): StudyEntry {
  if (session?.status === "active") return "continue";
  if (session?.status === "completed") return "replay";
  return "unseal";
}

export function studyNote(entry: StudyEntry): string {
  return STUDY_NOTE[entry];
}

export function studyLabel(entry: StudyEntry): string {
  return STUDY_LABEL[entry];
}

/** The newest own room as YOUR CASE shows it. A draft (sending never finished) counts as no room. */
export function caseForRoom(
  room: Pick<Room, "id" | "status"> | null,
  session: Pick<GameSession, "status"> | null,
): CaseState {
  switch (room?.status) {
    case "ready":
      return {
        kind: "ready",
        roomId: room.id,
        // No session, or the latest abandoned after "Restart this case": OPEN.
        progress: session?.status === "active" ? "continue" : session?.status === "completed" ? "replay" : "open",
      };
    case "queued":
    case "generating":
      return { kind: "developing", roomId: room.id };
    case "failed":
      return { kind: "failed", roomId: room.id };
    default:
      return { kind: "none" };
  }
}

/** The state line under the tag pill. Null while loading: the line stays blank. */
export function caseNote(state: CaseState): string | null {
  switch (state.kind) {
    case "loading":
      return null;
    case "none":
      return "None yet";
    case "offline":
      return "Offline";
    case "tryLater":
      return "Try later";
    case "ready":
      return state.progress === "continue" ? "Continue" : state.progress === "replay" ? "Replay" : "Open";
    case "developing":
      return "Building";
    case "failed":
      return "See why";
  }
}

/** The card's one accessibility label (Case status table). */
export function caseLabel(state: CaseState): string {
  switch (state.kind) {
    case "loading":
      return "Your case. Loading.";
    case "none":
      return "Your case. None yet.";
    case "offline":
      return "Your case. Offline.";
    case "tryLater":
      return "Your case. Try later.";
    case "ready":
      if (state.progress === "replay") return "Your case. Solved. Replay the case.";
      return state.progress === "continue" ? "Your case. Continue the case." : "Your case. Open the case.";
    case "developing":
      return "Your case. Building.";
    case "failed":
      return "Your case. It didn't build. See why.";
  }
}

export function caseHint(state: CaseState): string | undefined {
  return state.kind === "none" ? "Photograph a room first." : undefined;
}

/** The SOLVED pill shows only when the latest session on the newest own case is completed. */
export function caseSolved(state: CaseState): boolean {
  return state.kind === "ready" && state.progress === "replay";
}

/**
 * None yet, Offline and Try later: disabled at 0.45. The state line explains
 * why, so it is information, not part of the control, and stays at full strength.
 */
export function caseDisabled(state: CaseState): boolean {
  return state.kind === "none" || state.kind === "offline" || state.kind === "tryLater";
}

// Announced only when a flip is seen while the hub is open (never on the first fetch).
export const READY_ANNOUNCEMENT = "Your case is ready.";
export const FAILED_ANNOUNCEMENT = "Your case didn't build. Open it to see why.";

// THE STUDY's error notice (today's inline-error copy).
export const STUDY_OFFLINE = "You're offline. Connect to begin.";
export const STUDY_FAILED = "Couldn't start the case. Try again in a moment.";
