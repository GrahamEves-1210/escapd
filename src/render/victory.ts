// Case closed's victory moment (GAME_FEEL_PROMPT.md, 5), as plain data: the
// stats the completed session actually holds, the 1–3 magnifier rating
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
 * What case closed may show. Every field is the server's own number: a field
 * the session doesn't have is left out, never guessed. `wrong` is the
 * session's wrong_answer_count: every wrong code, and in crime scene every
 * wrong accusation (submit_action counts both on the same path).
 */
export interface CaseSummary {
  /** completed_at − started_at, as formatDuration has it. */
  time?: string;
  hints?: number;
  wrong?: number;
}

type SessionStats = Pick<GameSession, "started_at" | "completed_at" | "hints_used" | "wrong_answer_count">;

const count = (n: unknown): number | undefined => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined);

/** The completed session's stats, or null when there is no session (offline, or a reload with nothing to read). */
export function caseSummary(session: Partial<SessionStats> | null | undefined): CaseSummary | null {
  if (!session) return null;
  const summary: CaseSummary = {};
  if (session.completed_at && session.started_at) {
    const ms = new Date(session.completed_at).getTime() - new Date(session.started_at).getTime();
    if (Number.isFinite(ms) && ms >= 0) summary.time = formatDuration(ms);
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

/** The stats in the order they land, each with its label and the line a screen reader speaks. */
export function statLines(genre: Genre, summary: CaseSummary | null | undefined) {
  if (!summary) return [];
  const lines: { key: "time" | "hints" | "wrong"; label: string; value: string }[] = [];
  if (summary.time !== undefined) lines.push({ key: "time", label: "Time", value: summary.time });
  // Hints are the informant's tips (Informant.tsx): each new tip counts as one.
  if (summary.hints !== undefined) lines.push({ key: "hints", label: "Tips taken", value: String(summary.hints) });
  if (summary.wrong !== undefined) lines.push({ key: "wrong", label: WRONG_LABEL[genre], value: String(summary.wrong) });
  return lines;
}

/** When each part of the moment happens, in ms after case closed mounts. */
export interface VictoryTimeline {
  /** When the stamp (noir and crime scene: the only one; paranormal: CASE CLOSED) starts to fall. */
  stamp: number;
  /** Paranormal: the room snaps to colour, and "The presence is gone." starts to fall. */
  snap?: number;
  gone?: number;
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
      ...(genre === "paranormal" ? { snap: 0, gone: 0 } : {}),
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
    ...(paranormal ? { snap: B.snap, gone: B.gone } : {}),
    impact,
    stats: statTimes,
    rating: ratingAt,
    magnifiers,
    solved,
    cta: solved + B.cta,
  };
}
