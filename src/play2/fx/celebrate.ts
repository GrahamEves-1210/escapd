// The little celebrations' rules (no drawing here): how big a moment is (a
// clue or an item found, or a step solved), the word stamped over it (never
// the same twice in a row), and the streak: finds in quick succession earn a
// growing flourish.
import type { ActionResult } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";

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

/** The words stamped over a moment, in each mode's voice: short, handwritten, delighted. */
export const WORDS: Record<Genre, Record<Strength, readonly string[]>> = {
  noir: {
    find: ["Oh!", "Ooh!", "Hm!", "A lead!"],
    solve: ["Aha!", "Got it!", "Elementary!", "That's it!"],
  },
  crime_scene: {
    find: ["Oh!", "Ooh!", "Noted!", "A clue!"],
    solve: ["Aha!", "Got it!", "Bingo!", "Cracked it!"],
  },
  paranormal: {
    find: ["Oh!", "Ooh…", "Whoa!", "A sign!"],
    solve: ["Aha!", "Got it!", "It answers!", "Yes!"],
  },
};

/** The word on a roll: the roll itself gets a say now and then. */
export const ROLL_WORD = "On a roll!";

/** A word for a moment, never `last` (the one stamped before it). `rand` in [0, 1). */
export function pickWord(genre: Genre, strength: Strength, last: string | null, level = 0, rand: () => number = Math.random): string {
  // The roll's own word when it first starts (and at its height), unless it was just said.
  if ((level === 1 || level === STREAK.maxLevel) && last !== ROLL_WORD && rand() < 0.6) return ROLL_WORD;
  const list = WORDS[genre][strength].filter((w) => w !== last);
  return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
}
