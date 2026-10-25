// Box math for hotspots.
//
// The perception model returns Gemini's native box format: integer
// [ymin, xmin, ymax, xmax] on a 0..1000 grid relative to the image. Schema v1
// stores { type: "rect", x, y, w, h } as fractions of the image, and the SQL
// validator requires x, y >= 0, w, h > 0, x + w <= 1, y + h <= 1, compared as
// exact decimals of the JSON text. We therefore compute in 1/10000 units and
// emit k/10000 values, whose shortest JSON form is exact.

export type Box1000 = readonly [number, number, number, number]; // ymin, xmin, ymax, xmax

export interface Rect {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
}

export const GRID = 1000;
const UNITS = 10_000;            // output resolution: 1/10000 of the image
const PER_GRID = UNITS / GRID;

/** Hotspots smaller than this fraction of an edge are grown around their center. */
export const MIN_RECT_SIZE = 0.05;
/** Extra margin around the detected box; boxes tend to hug the object too tightly to tap. */
export const RECT_PADDING = 0.01;

export function isValidBox(box: readonly number[]): box is Box1000 {
  if (box.length !== 4 || !box.every((v) => Number.isInteger(v) && v >= 0 && v <= GRID)) return false;
  const [ymin, xmin, ymax, xmax] = box;
  return ymin < ymax && xmin < xmax;
}

/** Fraction of the image covered by the box (0..1). */
export function boxArea(box: Box1000): number {
  const [ymin, xmin, ymax, xmax] = box;
  return ((ymax - ymin) * (xmax - xmin)) / (GRID * GRID);
}

export function iou(a: Box1000, b: Box1000): number {
  const y0 = Math.max(a[0], b[0]);
  const x0 = Math.max(a[1], b[1]);
  const y1 = Math.min(a[2], b[2]);
  const x1 = Math.min(a[3], b[3]);
  const inter = Math.max(0, y1 - y0) * Math.max(0, x1 - x0);
  if (inter === 0) return 0;
  const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return inter / union;
}

/** True when the box touches the frame edge (the object is probably cut off). */
export function touchesEdge(box: Box1000, margin = 5): boolean {
  const [ymin, xmin, ymax, xmax] = box;
  return ymin <= margin || xmin <= margin || ymax >= GRID - margin || xmax >= GRID - margin;
}

// Grows [lo, hi) to at least `min` units around its center, then shifts it
// inside [0, UNITS] without shrinking unless it is wider than the image.
function fitSpan(lo: number, hi: number, min: number): [number, number] {
  if (hi - lo < min) {
    const center = (lo + hi) / 2;
    lo = Math.floor(center - min / 2);
    hi = lo + min;
  }
  if (lo < 0) {
    hi -= lo;
    lo = 0;
  }
  if (hi > UNITS) {
    lo -= hi - UNITS;
    hi = UNITS;
  }
  lo = Math.max(0, lo);
  if (hi <= lo) hi = Math.min(UNITS, lo + 1);
  return [lo, hi];
}

/** Converts a 0..1000 box to a schema-v1 rect that always passes the SQL rect check. */
export function boxToRect(
  box: Box1000,
  opts: { padding?: number; minSize?: number } = {},
): Rect {
  const pad = Math.round((opts.padding ?? RECT_PADDING) * UNITS);
  const min = Math.max(1, Math.round((opts.minSize ?? MIN_RECT_SIZE) * UNITS));
  const clamp = (v: number) => Math.min(GRID, Math.max(0, Math.round(v)));
  const [ymin, xmin, ymax, xmax] = box.map(clamp);
  const [x0, x1] = fitSpan(Math.min(xmin, xmax) * PER_GRID - pad, Math.max(xmin, xmax) * PER_GRID + pad, min);
  const [y0, y1] = fitSpan(Math.min(ymin, ymax) * PER_GRID - pad, Math.max(ymin, ymax) * PER_GRID + pad, min);
  return { type: "rect", x: x0 / UNITS, y: y0 / UNITS, w: (x1 - x0) / UNITS, h: (y1 - y0) / UNITS };
}

// ---------------------------------------------------------------------------
// Exact decimal comparison, mirroring Postgres numeric arithmetic on the JSON
// text of a number (SQL: (shape ->> 'x')::numeric + (shape ->> 'w')::numeric > 1).
// ---------------------------------------------------------------------------
interface Scaled { digits: bigint; scale: number }

function toScaled(n: number): Scaled {
  // String(n) is the same shortest round-trip text JSON.stringify sends to Postgres.
  const text = String(n).toLowerCase();
  const [mantissa, expText] = text.split("e");
  const exp = expText ? parseInt(expText, 10) : 0;
  const negative = mantissa.startsWith("-");
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const [intPart, frac = ""] = unsigned.split(".");
  let digits = BigInt((intPart || "0") + frac);
  let scale = frac.length - exp;
  if (scale < 0) {
    digits *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { digits: negative ? -digits : digits, scale };
}

/** a + b > limit, computed on exact decimals (as Postgres numeric would). */
export function decimalSumGreaterThan(a: number, b: number, limit = 1): boolean {
  const values = [toScaled(a), toScaled(b), toScaled(limit)];
  const scale = Math.max(...values.map((v) => v.scale));
  const [x, y, l] = values.map((v) => v.digits * 10n ** BigInt(scale - v.scale));
  return x + y > l;
}
