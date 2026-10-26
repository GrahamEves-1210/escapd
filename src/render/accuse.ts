// Pure helpers and words for crime scene's Accuse screen, in its clipped
// procedural voice (src/render/voice.ts has the rest of the play screen's).
// The cooldown: the server sends retry_after (an ISO time) on the wrong accusation that starts a cooldown,
// and on any attempt refused during it; the screen shows it as plain text.

/** Whole seconds from `now` until `retryAfter`, 0 once it has passed or when it can't be read. */
export function secondsUntil(retryAfter: string | number | undefined, now: number): number {
  if (retryAfter === undefined) return 0;
  const at = typeof retryAfter === "number" ? retryAfter : Date.parse(retryAfter);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/** "Next accusation in 0:45." (minutes and seconds), or null when the wait is over. */
export function cooldownText(seconds: number): string | null {
  if (seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `Next accusation in ${m}:${String(s).padStart(2, "0")}.`;
}

/** A wrong accusation. Never says which part was wrong. */
export const WRONG_ACCUSATION = "The charge won't stick.";
/** A refusal during a cooldown the clock can't count (no retry_after, or one already past). */
export const COOLDOWN_FALLBACK = "Stand by. You can accuse again shortly.";
/** The accusation isn't open yet. */
export const NOT_ENOUGH_TO_ACCUSE = "Not enough evidence to accuse yet.";
