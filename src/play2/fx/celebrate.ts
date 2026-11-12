// The little celebrations' rules (no drawing here): how big a moment is (a
// clue or an item found, or a step solved), and the streak: finds in quick
// succession earn a growing flourish. Nothing is said: no word is stamped
// over a moment (show, never tell); the burst of inked sparks is the whole of
// it.
import type { ActionResult } from "@/engine/v2";

/** A find (a clue card arrived, an item turned up or was picked up) or a solved step (bigger). */
export type Strength = "find" | "solve";

/** How big a result's moment is: a solved step beats a find; nothing new is nothing. The case closing is the Ending's. */
export function strengthOf(result: ActionResult | null): Strength | null {
  if (!result || result.completed || result.effects.some((e) => e.do === "complete")) return null;
  if (result.effects.some((e) => e.do === "solved")) return "solve";
  return result.effects.some((e) => e.do === "show_card" || e.do === "grant") ? "find" : null;
}

export const STREAK = {
  /** Finds within this long of each other count toward a roll (ms). */
  windowMs: 40_000,
  /** The roll starts at this many. */
  from: 3,
  /** Its flourish stops growing at this level. */
  maxLevel: 3,
} as const;

/** The finds still inside the window once one more lands at `now`, and the roll's level (0: not on a roll). */
export function streakAfter(times: readonly number[], now: number): { times: number[]; count: number; level: number } {
  const kept = [...times.filter((t) => now - t < STREAK.windowMs && t <= now), now];
  const count = kept.length;
  const level = count >= STREAK.from ? Math.min(STREAK.maxLevel, count - STREAK.from + 1) : 0;
  return { times: kept, count, level };
}
