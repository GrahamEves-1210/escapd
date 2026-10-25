/** Longest side kept on a plate. Matches the darkroom upload size. */
export const LONG_EDGE = 1600;

/**
 * Fit an image inside a square of `edge` points on the long side.
 * Returns null when the source size is unknown. Does not upscale.
 */
export function fittedLongEdge(width: number, height: number, edge = LONG_EDGE) {
  if (!(width > 0) || !(height > 0) || !(edge > 0)) return null;
  const scale = Math.min(1, edge / width, edge / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
