// What a mode screen says about each case (MODES_PROMPT.md Part 2): its
// stamp, its words for screen readers, and where a tap goes. Pure: no React,
// no network.
import type { Href } from "expo-router";
import type { GameSession, Room } from "@/lib/escapd-api";
import type { Genre } from "@/lib/puzzle-types";

/**
 * A case file's stamp:
 * - open: ready and never played (or its latest run abandoned by "Restart this case");
 * - inProgress: its latest session is active;
 * - closed: its latest session is completed;
 * - building: queued or generating;
 * - failed: the build failed.
 */
export type CaseStamp = "open" | "inProgress" | "closed" | "building" | "failed";

/** The stamp's words, as read; the stamp shows them in capitals. */
export const STAMP_WORDS: Record<CaseStamp, string> = {
  open: "Open",
  inProgress: "In progress",
  closed: "Closed",
  building: "Building",
  failed: "Didn't build",
};

export interface CaseFile {
  roomId: string;
  title: string;
  /** The room's created_at (ISO). */
  createdAt: string;
  stamp: CaseStamp;
  /** The cover photo's id and signed URL, when there is one. */
  cover: { id: string; uri: string } | null;
}

/** A room's stamp from its status and, when ready, its latest session. A draft has none (it is never listed). */
export function stampFor(
  room: Pick<Room, "status">,
  session: Pick<GameSession, "status"> | GameSession["status"] | null | undefined,
): CaseStamp | null {
  const status = typeof session === "string" ? session : session?.status;
  switch (room.status) {
    case "ready":
      return status === "active" ? "inProgress" : status === "completed" ? "closed" : "open";
    case "queued":
    case "generating":
      return "building";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

/** A case file's date line, in the device's language ("26 Oct 2026"). */
export function caseDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The title a case file shows: the room's own, or a plain stand-in while it builds. */
export function caseTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  return trimmed ? trimmed : "Untitled case";
}

/** The case file's one accessibility label: title, date, stamp, and what a tap does when it isn't playing. */
export function caseLabel(file: Pick<CaseFile, "title" | "createdAt" | "stamp">): string {
  const date = caseDate(file.createdAt);
  const parts = [file.title, date, STAMP_WORDS[file.stamp]].filter(Boolean);
  const label = `${parts.join(". ")}.`;
  return file.stamp === "failed" ? `${label} See why.` : label;
}

/** Where a case file goes: play a ready case; follow the build of a building or failed one (as home's YOUR CASE did). */
export function caseHref(file: Pick<CaseFile, "roomId" | "stamp">): Href {
  if (file.stamp === "building" || file.stamp === "failed") {
    return { pathname: "/capture/develop", params: { roomId: file.roomId } };
  }
  return { pathname: "/play/[roomId]", params: { roomId: file.roomId } };
}

/** "No cases yet", "1 case", "2 cases": home's count on each mode card. */
export function caseCount(count: number): string {
  if (count <= 0) return "No cases yet";
  return count === 1 ? "1 case" : `${count} cases`;
}

/** The Study on noir's mode screen, from its latest session. */
export function studyStamp(session: GameSession["status"] | null | undefined): CaseStamp {
  return session === "active" ? "inProgress" : session === "completed" ? "closed" : "open";
}

const STUDY_ACTION: Record<"open" | "inProgress" | "closed", string> = {
  open: "Take the case",
  inProgress: "Back on the case",
  closed: "Reopen the case",
};

/** The Study's meta line, which is also what a tap does. */
export function studyAction(stamp: CaseStamp): string {
  return stamp === "inProgress" || stamp === "closed" ? STUDY_ACTION[stamp] : STUDY_ACTION.open;
}

/** Announced when a building case flips while its mode screen is open (the build's plain words). */
export const READY_ANNOUNCEMENT = "Your case is ready.";
export const FAILED_ANNOUNCEMENT = "Your case didn't build. Open it to see why.";

/** What a mode's own screens say about it, per mode. */
export interface ModeCopy {
  /** The list's heading. */
  cases: string;
  /** No cases in this mode yet. */
  empty: string;
  /** The list couldn't load (a server error; offline has its own plain line). */
  tryLater: string;
  /** The first-time intro: its kicker, three steps, and its button (crime scene and paranormal). */
  intro: { kicker: string; start: string; steps: { title: string; body: string }[] } | null;
}

/**
 * Each mode's words on its own screens, in its voice (GAME_FEEL_PROMPT.md, 6):
 * noir a dry hard-boiled narrator, crime scene clipped police procedural,
 * paranormal hushed and eerie. Photographing a room stays in plain words.
 */
export const MODE_COPY: Record<Genre, ModeCopy> = {
  noir: {
    cases: "Case files",
    empty: "Quiet week. Photograph a room and it becomes a case.",
    tryLater: "The trail went cold. Try again.",
    intro: null,
  },
  crime_scene: {
    cases: "Case files",
    empty: "No cases on file. Photograph a room and it becomes a crime scene.",
    tryLater: "Couldn't pull the files. Try again.",
    intro: {
      kicker: "Briefing",
      start: "Take the case",
      steps: [
        { title: "Search the scene", body: "Every clue is evidence. Some break a suspect's alibi." },
        { title: "Check the alibis", body: "Open Suspects: who says what, and whose story no longer holds." },
        { title: "Make the arrest", body: "Name the killer, the motive and the method. A wrong call costs you time." },
      ],
    },
  },
  paranormal: {
    cases: "Your hauntings",
    empty: "No cases yet. Photograph a room and something moves in.",
    tryLater: "Something interfered. Try again.",
    intro: {
      kicker: "Before you go in",
      start: "Step inside",
      steps: [
        { title: "Find the anomalies", body: "Look for what flickers, moves or turns cold." },
        { title: "Feel the presence grow", body: "Every anomaly you find makes it stronger." },
        { title: "Banish it", body: "Do the right things in the right order. Then it leaves." },
      ],
    },
  },
};
