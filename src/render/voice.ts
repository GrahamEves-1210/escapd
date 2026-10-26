// The play screen's own words, per mode (GAME_FEEL_PROMPT.md, 6: Voice).
// Noir is a dry, hard-boiled narrator; crime scene is clipped police
// procedural; paranormal is hushed and eerie (never demonic). Short and
// readable: buttons say what they do, errors say what happened.
//
// Only the app's own strings live here. Clue text, hints, case names and
// every message from the server are shown as the server sent them. Outside a
// mode (no genre yet, e.g. while a case loads from a link) the noir narrator
// speaks. No darkroom or film words (round 4, plain language).
import type { Genre } from "@/lib/puzzle-types";
import type { QuietReason } from "@/game/selectors";

export interface PlayVoice {
  /** The loading line while the case opens. */
  loading: string;
  /** The offline screen's title (its body says plainly that you're offline). */
  offlineTitle: string;
  /** The title when the case couldn't open for another reason. */
  failedTitle: string;
  /** A request that didn't go through: the first sentence of the line. */
  failed: string;
  /** An inspect that found nothing new, by reason. Never names a missing item. */
  quiet: Record<QuietReason, string>;
  /** An item used on the wrong object. */
  useNothing: string;
  /** Two items that don't combine. */
  combineNothing: string;
  /** A wrong code, when the server sends no line of its own. */
  codeWrong: string;
  /** The clue sheet's button when it gave up items, and when it didn't. */
  pocket: string;
  onward: string;
  /** The clue sheet's heading over the items it gave up. */
  pocketed: string;
  /** Something was revealed in this view, or in another one. */
  revealedHere: string;
  revealedElsewhere: string;
  /** The empty evidence tray. */
  trayEmpty: string;
}

const NOIR: PlayVoice = {
  loading: "Pulling the case file…",
  offlineTitle: "The line's dead",
  failedTitle: "The trail went cold",
  failed: "The trail went cold.",
  quiet: {
    needs_item: "Something's missing.",
    locked: "It won't budge. Not yet.",
    spent: "Picked clean.",
    plain: "Nothing worth a second look.",
  },
  useNothing: "No dice.",
  combineNothing: "Those two don't fit.",
  codeWrong: "Wrong number.",
  pocket: "Pocket it",
  onward: "Move on",
  pocketed: "In your pocket",
  revealedHere: "Something turned up nearby.",
  revealedElsewhere: "Something changed in another view.",
  trayEmpty: "What you find goes here.",
};

const CRIME_SCENE: PlayVoice = {
  loading: "Securing the scene…",
  offlineTitle: "No signal",
  failedTitle: "Scene unavailable",
  failed: "Request failed.",
  quiet: {
    needs_item: "Something's missing.",
    locked: "Locked. Not yet.",
    spent: "Already processed.",
    plain: "Nothing of note.",
  },
  useNothing: "No match.",
  combineNothing: "Those don't match up.",
  codeWrong: "Wrong code.",
  pocket: "Bag it",
  onward: "Proceed",
  pocketed: "Logged as evidence",
  revealedHere: "New evidence in this view.",
  revealedElsewhere: "New evidence in another view.",
  trayEmpty: "Bagged evidence goes here.",
};

const PARANORMAL: PlayVoice = {
  loading: "The room is waking…",
  offlineTitle: "Contact lost",
  failedTitle: "The room went quiet",
  failed: "Something interfered.",
  quiet: {
    needs_item: "Something is missing.",
    locked: "It won't open. Not yet.",
    spent: "Nothing more here.",
    plain: "Nothing stirs here.",
  },
  useNothing: "Nothing stirs.",
  combineNothing: "They won't join.",
  codeWrong: "Wrong code. Nothing stirs.",
  pocket: "Take it",
  onward: "Go on",
  pocketed: "You take it with you",
  revealedHere: "Something stirs nearby.",
  revealedElsewhere: "Something stirs in another view.",
  trayEmpty: "What you take goes here.",
};

export const PLAY_VOICES: Readonly<Record<Genre, PlayVoice>> = {
  noir: NOIR,
  crime_scene: CRIME_SCENE,
  paranormal: PARANORMAL,
};

/** The mode's voice; the noir narrator outside a mode. */
export function playVoice(genre: Genre | null | undefined): PlayVoice {
  return PLAY_VOICES[genre ?? "noir"];
}

/** Shared lines, in every mode. */
export const PLAY_COPY = {
  /** Offline: what it means, in plain words, in every mode. */
  offline: "No connection. Your progress is safe.",
  offlineBody: "Your progress is saved. Connect to pick up where you left off.",
  failedBody: "Something went wrong on our side. Your progress is safe.",
  notYet: "Not yet.",
  wontWork: "That won't work.",
  wontCombine: "Those won't go together.",
  twoPicked: "Fit them together, or cancel.",
  combine: "Fit together",
  useOn: "Tap something in the room to use it.",
  evidenceShow: "Check your evidence",
  evidenceHide: "Hide your evidence",
  replay: "Replay the case",
  nextCase: "Next case",
  restartTitle: "Restart this case?",
  restartBody: "Everything you've found goes back where it was. You can replay it any time.",
} as const;

/** A request that didn't reach the server or didn't go through, with what to do. */
export function failedLine(voice: PlayVoice, offline: boolean, then: "retry" | "safe"): string {
  if (offline) return then === "retry" ? `${PLAY_COPY.offline} Try again.` : PLAY_COPY.offline;
  return then === "retry" ? `${voice.failed} Try again.` : `${voice.failed} Your progress is safe.`;
}
