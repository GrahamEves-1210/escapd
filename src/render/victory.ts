// Case closed's victory moment (GAME_FEEL_PROMPT.md, 5), as plain data: the
// stats the game actually holds (the completed session's, or a v2 game's own
// count on the device), the 1–3 magnifier rating
// derived from them, and the moment's timeline in ms. Pure, so the rule and
// the beats are tested on their own (src/render/__tests__/victory-test.ts);
// CaseClosed.tsx plays them.
import type { GameSession } from "@/lib/escapd-api";
import type { Genre } from "@/lib/puzzle-types";
import { formatDuration } from "@/game/format";
import { motion, ref } from "@/theme/tokens";

const C = ref.layout.play.complete;
const S = ref.layout.play.stamp;

/**
 * What case closed may show. Every field is a real count: the session's (a
 * field it doesn't have is left out, never guessed), or a v2 game's own.
 * `wrong` is the session's wrong_answer_count: every wrong code, and in crime
 * scene every wrong accusation (submit_action counts both on the same path).
 */
export interface CaseSummary {
  /** completed_at − started_at, as formatDuration has it. */
  time?: string;
  hints?: number;
  wrong?: number;
}

/** A run of the solution's story: plain, or `strong` (the answer itself, called out). */
export interface StoryPart {
  text: string;
  strong?: boolean;
}

/**
 * What happened in the case, for case closed's recap (built where the game
 * holds the answer: src/play2/caseRecord.ts, caseRecap): the solution's story
 * in a sentence or two (noir: the combination; crime scene: who, why and how;
 * paranormal: the ritual and what it meant), the casebook cards that proved
 * it, and how many of the case's clues she found.
 */
export interface CaseRecap {
  story: StoryPart[];
  /** The titles of the clues that proved it, as her casebook has them. */
  evidence: string[];
  /** Clues found, of the case's clues. */
  found?: number;
  total?: number;
}

/**
 * The case's number: a neutral label in place of an invented title, the
 * same for the same room (a hash of its id), 0001 to 9999.
 */
export function caseNumber(roomId: string): string {
  let n = 7;
  for (const ch of roomId) n = (n * 33 + ch.charCodeAt(0)) % 99991;
  return String((n % 9999) + 1).padStart(4, "0");
}

/** "Case no. 0427": how the screens name a case (never an invented title). */
export function caseLabel(roomId: string): string {
  return `Case no. ${caseNumber(roomId)}`;
}

/** How a v2 game went, counted on the device as it was played (src/play2/caseRecord.ts). */
export interface CaseStats {
  /** Hint rungs taken. */
  hints: number;
  /** Wrong submits: codes, accusations, rituals. */
  wrong: number;
  /** Time spent playing (ms). */
  ms: number;
}

/** A play time for a stat card: short enough for a third of the column. */
export function statDuration(ms: number): string {
  return ms < 60000 ? "<1 min" : formatDuration(ms);
}

/** A v2 game's own stats, as case closed shows them. */
export function caseSummaryFromStats(stats: CaseStats | null | undefined): CaseSummary | null {
  if (!stats) return null;
  const summary: CaseSummary = {};
  const ms = count(stats.ms);
  if (ms !== undefined) summary.time = statDuration(ms);
  const hints = count(stats.hints);
  if (hints !== undefined) summary.hints = hints;
  const wrong = count(stats.wrong);
  if (wrong !== undefined) summary.wrong = wrong;
  return Object.keys(summary).length ? summary : null;
}

type SessionStats = Pick<GameSession, "started_at" | "completed_at" | "hints_used" | "wrong_answer_count">;

const count = (n: unknown): number | undefined => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined);

/** The completed session's stats, or null when there is no session (offline, or a reload with nothing to read). */
export function caseSummary(session: Partial<SessionStats> | null | undefined): CaseSummary | null {
  if (!session) return null;
  const summary: CaseSummary = {};
  if (session.completed_at && session.started_at) {
    const ms = new Date(session.completed_at).getTime() - new Date(session.started_at).getTime();
    if (Number.isFinite(ms) && ms >= 0) summary.time = statDuration(ms);
  }
  const hints = count(session.hints_used);
  if (hints !== undefined) summary.hints = hints;
  const wrong = count(session.wrong_answer_count);
  if (wrong !== undefined) summary.wrong = wrong;
  return Object.keys(summary).length ? summary : null;
}

export type Rating = 1 | 2 | 3;

/**
 * The magnifier rating. It rewards observation, not speed, so time plays no
 * part:
 * - 3: solved with no hints and no wrong answers;
 * - 2: at most 1 hint and at most 2 wrong answers;
 * - 1: anything else (every closed case earns one).
 * Null when either number is missing: no rating is better than a made-up one.
 */
export function magnifierRating(summary: Pick<CaseSummary, "hints" | "wrong"> | null | undefined): Rating | null {
  const hints = count(summary?.hints);
  const wrong = count(summary?.wrong);
  if (hints === undefined || wrong === undefined) return null;
  if (hints === 0 && wrong === 0) return 3;
  if (hints <= 1 && wrong <= 2) return 2;
  return 1;
}

/**
 * The wrong-answer stat, in the mode's voice. Crime scene's count includes
 * wrong accusations, so it says "calls"; paranormal's finale isn't only a code.
 */
const WRONG_LABEL: Record<Genre, string> = {
  noir: "Wrong codes",
  crime_scene: "Wrong calls",
  paranormal: "Missteps",
};

/** Each mode is a book in a series: its series line. */
export const SERIES_LINE: Record<Genre, string> = {
  noir: "A Detective Noir Mystery",
  crime_scene: "A True Crime Club Mystery",
  paranormal: "A Moonlit Mystery",
};

/** What the rating's marks are: the detective's magnifying glasses, or paranormal's moons. */
export const RATING_MARK: Record<Genre, "magnifier" | "moon"> = {
  noir: "magnifier",
  crime_scene: "magnifier",
  paranormal: "moon",
};

/**
 * What the rating is called, in the mode's voice: the detective's eye in noir
 * and crime scene; paranormal's case is felt as much as seen.
 */
export const RATING_LABEL: Record<Genre, string> = {
  noir: "Observation",
  crime_scene: "Observation",
  paranormal: "Second sight",
};

/** The wrong-answer stat's noun in a sentence, singular and plural. */
const WRONG_NOUN: Record<Genre, [string, string]> = {
  noir: ["wrong code", "wrong codes"],
  crime_scene: ["wrong call", "wrong calls"],
  paranormal: ["misstep", "missteps"],
};

/** A stat cell's own short label (the cells are a quarter of the page across); `label` is what a screen reader says. */
const SHORT: Record<"time" | "hints" | "wrong" | "clues", string> = { time: "Time", hints: "Tips", wrong: "Wrong", clues: "Clues" };
const SHORT_WRONG: Record<Genre, string> = { noir: "Wrong", crime_scene: "Wrong", paranormal: "Missteps" };

export type StatKey = "time" | "hints" | "wrong" | "clues";

/**
 * The stats in the order they land, each with its label (what a screen
 * reader says), its cell's short label and its value. `clues`: the clues
 * found of the case's clues (a v2 game's recap), as "3 of 4".
 */
export function statLines(genre: Genre, summary: CaseSummary | null | undefined, clues?: { found?: number; total?: number } | null) {
  const lines: { key: StatKey; label: string; short: string; value: string }[] = [];
  if (summary) {
    if (summary.time !== undefined) lines.push({ key: "time", label: "Time", short: SHORT.time, value: summary.time });
    // Hints are the informant's tips (Informant.tsx): each new tip counts as one.
    if (summary.hints !== undefined) lines.push({ key: "hints", label: "Tips taken", short: SHORT.hints, value: String(summary.hints) });
    if (summary.wrong !== undefined) lines.push({ key: "wrong", label: WRONG_LABEL[genre], short: SHORT_WRONG[genre], value: String(summary.wrong) });
  }
  const found = count(clues?.found);
  const total = count(clues?.total);
  if (found !== undefined && total !== undefined && total > 0) {
    lines.push({ key: "clues", label: "Clues found", short: SHORT.clues, value: `${Math.min(found, total)} of ${total}` });
  }
  return lines;
}

const plural = (n: number, [one, many]: [string, string]) => `${n} ${n === 1 ? one : many}`;

/**
 * What earned the rating, in a line: "3 magnifiers: solved with no tips and
 * no wrong codes." Lower ratings say what cost the marks and what earns the
 * next one. Null when there is no rating.
 */
export function ratingReason(genre: Genre, summary: Pick<CaseSummary, "hints" | "wrong"> | null | undefined): string | null {
  const rating = magnifierRating(summary);
  if (!rating) return null;
  const hints = summary!.hints!;
  const wrong = summary!.wrong!;
  const marks: [string, string] = RATING_MARK[genre] === "moon" ? ["moon", "moons"] : ["magnifier", "magnifiers"];
  const wrongs = WRONG_NOUN[genre];
  const head = plural(rating, marks);
  if (rating === 3) return `${head}: solved with no tips and no ${wrongs[1]}.`;
  const cost = [hints ? plural(hints, ["tip", "tips"]) : "", wrong ? plural(wrong, wrongs) : ""].filter(Boolean).join(" and ");
  const next = rating === 2 ? `No tips and no ${wrongs[1]} earns 3.` : `At most 1 tip and 2 ${wrongs[1]} earns 2.`;
  return `${head} for ${cost}. ${next}`;
}

/** The cat's line on case closed, by how it went. */
export function catVerdict(summary: Pick<CaseSummary, "hints" | "wrong"> | null | undefined): string {
  const rating = magnifierRating(summary);
  if (rating === 3) return "Not one tip. I'm impressed \u2665";
  if (rating === 2) return summary!.hints ? "I only helped a little \u2665" : "A wrong turn or two. Still brilliant \u2665";
  if (rating === 1) return "We got there together \u2665";
  return "Another one for your shelf \u2665";
}

/** When each part of the moment happens, in ms after case closed mounts. */
export interface VictoryTimeline {
  /** When the sticker (noir: CASE CLOSED; crime scene: GUILTY; paranormal: "The presence is gone") starts to fall. */
  stamp: number;
  /** Paranormal: the room snaps back to its own colours, before its sticker. */
  snap?: number;
  /** The last impact: the stats wait for it. */
  impact: number;
  /** Each stat's landing (a tick each). */
  stats: number[];
  /** When the rating's row of empty magnifiers appears, and when each earned one fills (a tick each). */
  rating?: number;
  magnifiers: number[];
  /** The `solved` cue. */
  solved: number;
  /** The actions (and the closing line) come in. */
  cta: number;
}

/**
 * The moment's beats. `dataAt` is when the session's stats arrived (ms after
 * mount): the stats never land before the stamp does, nor before they exist.
 * Reduced motion: no fall, no stagger; the stamp fades in at once (it lands
 * as its fade ends), the stats and rating fade in together, all within 600 ms
 * when the stats are already there.
 */
export function victoryTimeline({ genre, reduced, stats, rating, dataAt = 0 }: {
  genre: Genre;
  reduced: boolean;
  stats: number;
  rating: Rating | null;
  dataAt?: number;
}): VictoryTimeline {
  const B = C.beat;
  if (reduced) {
    const R = C.reduced;
    const start = Math.max(R.stats, dataAt);
    const statTimes = Array.from({ length: stats }, (_, i) => start + i * R.tick);
    const ratingAt = rating ? start + (R.rating - R.stats) : undefined;
    const solved = start + (R.solved - R.stats);
    return {
      stamp: 0,
      ...(genre === "paranormal" ? { snap: 0 } : {}),
      impact: motion.reducedFade,
      stats: statTimes,
      rating: ratingAt,
      // Under reduced motion the earned magnifiers are simply there with the row; no beat of their own.
      magnifiers: [],
      solved,
      cta: solved,
    };
  }
  const paranormal = genre === "paranormal";
  const stamp = paranormal ? B.goneStamp : B.slam;
  const impact = stamp + S.slam;
  const start = Math.max(impact + B.statsGap, dataAt);
  const statTimes = Array.from({ length: stats }, (_, i) => start + i * B.stat);
  const afterStats = stats ? statTimes[stats - 1] : start - B.ratingGap;
  const ratingAt = rating ? afterStats + B.ratingGap : undefined;
  const magnifiers = ratingAt === undefined ? [] : Array.from({ length: rating! }, (_, i) => ratingAt + i * B.magnifier);
  const last = magnifiers.length ? magnifiers[magnifiers.length - 1] : stats ? afterStats : start;
  const solved = last + B.solved;
  return {
    stamp,
    ...(paranormal ? { snap: B.snap } : {}),
    impact,
    stats: statTimes,
    rating: ratingAt,
    magnifiers,
    solved,
    cta: solved + B.cta,
  };
}
