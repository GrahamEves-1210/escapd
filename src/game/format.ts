const PLATE_NUMERALS = ["I", "II", "III", "IV", "V", "VI"] as const;

/** Contact-sheet frame number. Falls back to digits past plate VI. */
export function plateNumeral(index: number) {
  return PLATE_NUMERALS[index] ?? String(index + 1);
}

/** Human duration for a completed case: "Under a minute", "12 min", "1 h 5 min". */
export function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "Under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
