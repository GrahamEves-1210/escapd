// What the modes say about themselves outside play, per mode, in each mode's
// voice (docs/DESIGN.md, Game feel · 6. Voice): noir a dry hard-boiled
// narrator, crime scene clipped police procedural, paranormal hushed and
// eerie (never demonic). Short and plain enough to be clear: buttons say what
// they do. Photographing a room stays in plain words.
import type { Genre } from "@/lib/puzzle-types";

/** A mode's first-time intro: its kicker, three steps, and its button. */
export interface ModeIntroCopy {
  kicker: string;
  start: string;
  steps: { title: string; body: string }[];
}

export const MODE_INTRO: Record<Genre, ModeIntroCopy> = {
  noir: {
    kicker: "The job",
    start: "Take the job",
    steps: [
      { title: "Work the room", body: "Search everything. Every room keeps something back." },
      { title: "Put it together", body: "Pick up what you find. Some pieces fit; some open things." },
      { title: "Find the way out", body: "Crack the last lock and the case is closed." },
    ],
  },
  crime_scene: {
    kicker: "Briefing",
    start: "Take the case",
    steps: [
      { title: "Search the scene", body: "Every clue is evidence. Some break a suspect's alibi." },
      { title: "Check the alibis", body: "Open Suspects: who says what, and whose story no longer holds." },
      { title: "Make the arrest", body: "Name the killer, the motive and the method. A wrong call costs you time." },
    ],
  },
  paranormal: {
    kicker: "Before you go in",
    start: "Step inside",
    steps: [
      { title: "Find the anomalies", body: "Look for what flickers, moves or turns cold." },
      { title: "Feel the presence grow", body: "Every anomaly you find makes it stronger." },
      { title: "Banish it", body: "Do the right things in the right order. Then it leaves." },
    ],
  },
};

/**
 * Home's continue prompt (a mode card tapped while it has a case to go back
 * to): the line under the mode's name, by what is waiting. `building` is a
 * case still being built (Continue opens the build wait).
 */
export interface ResumeCopy {
  inProgress: string;
  building: string;
  /** The prompt's title when the case has no name yet (still building). */
  untitled: string;
}

export const RESUME_COPY: Record<Genre, ResumeCopy> = {
  noir: {
    inProgress: "You've still got a case open.",
    building: "Your next case is still coming together.",
    untitled: "Next case",
  },
  crime_scene: {
    inProgress: "You have an open case on file.",
    building: "Your scene is still being processed.",
    untitled: "New scene",
  },
  paranormal: {
    inProgress: "Something is still waiting for you.",
    building: "Something is still taking shape.",
    untitled: "Something new",
  },
};

/**
 * What Start a new case does to the open one, in plain words: nothing is
 * deleted, but home offers each mode's newest sent case (caseStatus.ts), so
 * once the new photos are sent Continue opens the new case.
 */
export const RESUME_NEW_NOTE = "Starting a new case puts this one aside: once the new photos are sent, Continue opens the new case.";

/** The prompt's two pills, the same in every mode. */
export const RESUME_ACTIONS = {
  resume: "Continue",
  fresh: "Start a new case",
} as const;
