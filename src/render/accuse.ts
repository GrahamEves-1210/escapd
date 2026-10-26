// Pure helpers for the Accuse screen's cooldown line. The server sends
// retry_after (an ISO time) on the wrong accusation that starts a cooldown,
// and on any attempt refused during it; the screen shows it as plain text.

/** Whole seconds from `now` until `retryAfter`, 0 once it has passed or when it can't be read. */
export function secondsUntil(retryAfter: string | number | undefined, now: number): number {
  if (retryAfter === undefined) return 0;
  const at = typeof retryAfter === "number" ? retryAfter : Date.parse(retryAfter);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/** "You can accuse again in 0:45." (minutes and seconds), or null when the wait is over. */
export function cooldownText(seconds: number): string | null {
  if (seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `You can accuse again in ${m}:${String(s).padStart(2, "0")}.`;
}

export const WRONG_ACCUSATION = "That doesn't add up.";
