// Path builders for the guide's line art, in the art box's own units. Every
// builder writes absolute M, L, H, V, C and Z only (see Mark in types.ts).
import type { Point } from "./types";

// A quarter circle as one cubic Bezier: control points at kappa x radius.
const KAPPA = (4 / 3) * (Math.SQRT2 - 1);
const DEG = Math.PI / 180;

/** Path numbers to two decimals, so path data stays short and stable. */
export const n = (value: number) => String(Math.round(value * 100) / 100 + 0);

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A point `length` from `from`, heading `deg` clockwise from straight up. */
export function polar(from: Point, deg: number, length: number): Point {
  return [from[0] + Math.sin(deg * DEG) * length, from[1] - Math.cos(deg * DEG) * length];
}

/** Rotates `p` by `deg` clockwise about `c`. */
export function rotate(p: Point, c: Point, deg: number): Point {
  const cos = Math.cos(deg * DEG);
  const sin = Math.sin(deg * DEG);
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * cos - dy * sin, c[1] + dx * sin + dy * cos];
}

/** Joins points into path data: the first a moveto, single points linetos, triples cubics. */
function pathOf(segments: readonly (readonly Point[])[], close: boolean, map: (p: Point) => Point = (p) => p): string {
  const at = (p: Point) => {
    const q = map(p);
    return `${n(q[0])} ${n(q[1])}`;
  };
  const body = segments
    .map((seg, i) => (i === 0 ? `M${at(seg[0])}` : seg.length === 1 ? `L${at(seg[0])}` : `C${seg.map(at).join(" ")}`))
    .join("");
  return close ? `${body}Z` : body;
}

/** The segments of a rounded rectangle, clockwise from the top edge. */
function roundedSegments(l: number, t: number, r: number, b: number, radius: number): Point[][] {
  const k = radius * KAPPA;
  return [
    [[l + radius, t]],
    [[r - radius, t]],
    [[r - radius + k, t], [r, t + radius - k], [r, t + radius]],
    [[r, b - radius]],
    [[r, b - radius + k], [r - radius + k, b], [r - radius, b]],
    [[l + radius, b]],
    [[l + radius - k, b], [l, b - radius + k], [l, b - radius]],
    [[l, t + radius]],
    [[l, t + radius - k], [l + radius - k, t], [l + radius, t]],
  ];
}

/** An axis-aligned rounded rectangle. */
export function roundedRect(box: Box, radius: number): string {
  return pathOf(roundedSegments(box.x, box.y, box.x + box.width, box.y + box.height, radius), true);
}

/** A rounded rectangle centred on `centre`, turned `deg` clockwise. */
export function turnedRect(centre: Point, width: number, height: number, radius: number, deg: number): string {
  const [cx, cy] = centre;
  const segs = roundedSegments(cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2, radius);
  return pathOf(segs, true, (p) => rotate(p, centre, deg));
}

/** An ellipse as four cubics, starting at its top. */
export function ellipse(c: Point, rx: number, ry: number): string {
  const [x, y] = c;
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return pathOf(
    [
      [[x, y - ry]],
      [[x + kx, y - ry], [x + rx, y - ky], [x + rx, y]],
      [[x + rx, y + ky], [x + kx, y + ry], [x, y + ry]],
      [[x - kx, y + ry], [x - rx, y + ky], [x - rx, y]],
      [[x - rx, y - ky], [x - kx, y - ry], [x, y - ry]],
    ],
    true,
  );
}

/**
 * A rounded lobe centred on `centre` (its widest point), `width` across:
 * `top` above the centre and `bottom` below it, so a longer `bottom` tapers
 * it downward. Turned `deg` clockwise. The fingertips over the phone's edge.
 */
export function lobe(centre: Point, width: number, top: number, bottom: number, deg: number): string {
  const [x, y] = centre;
  const w = width / 2;
  return pathOf(
    [
      [[x, y - top]],
      [[x + w * KAPPA, y - top], [x + w, y - top * KAPPA], [x + w, y]],
      [[x + w, y + bottom * KAPPA], [x + w * KAPPA, y + bottom], [x, y + bottom]],
      [[x - w * KAPPA, y + bottom], [x - w, y + bottom * KAPPA], [x - w, y]],
      [[x - w, y - top * KAPPA], [x - w * KAPPA, y - top], [x, y - top]],
    ],
    true,
    (p) => rotate(p, centre, deg),
  );
}

/** A circle as four cubics. */
export function circle(c: Point, radius: number): string {
  return ellipse(c, radius, radius);
}

/** A capsule (stadium) centred on `centre`, `length` long along its axis, turned `deg` clockwise from upright. */
export function capsule(centre: Point, width: number, length: number, deg: number): string {
  return turnedRect(centre, width, length, width / 2, deg);
}

/** Straight segments through the points, as path data; closed with `close`. */
export function polyline(points: readonly Point[], close = false): string {
  return pathOf(
    points.map((p) => [p]),
    close,
  );
}

/** Every coordinate in M/L/H/V/C/Z path data (a curve stays inside its control points). */
export function pathPoints(d: string): Point[] {
  const tokens = d.match(/[MLHVCZ]|-?\d*\.?\d+/gi) ?? [];
  const out: Point[] = [];
  let cmd = "M";
  let x = 0;
  let y = 0;
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i];
    if (/^[MLHVCZ]$/i.test(t)) {
      cmd = t.toUpperCase();
      i += 1;
      continue;
    }
    if (cmd === "H") {
      x = Number(t);
      i += 1;
    } else if (cmd === "V") {
      y = Number(t);
      i += 1;
    } else {
      x = Number(t);
      y = Number(tokens[i + 1]);
      i += 2;
    }
    out.push([x, y]);
  }
  return out;
}

/** The box around a path's points (its control points included). */
export function pathBounds(d: string): Box {
  const pts = pathPoints(d);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * The last point of M/L/H/V/C path data, and the point it is approached from
 * (a curve's last control point): together, the path's final direction.
 */
export function pathTail(d: string): { from: Point; to: Point } {
  const tokens = d.match(/[MLHVCZ]|-?\d*\.?\d+/gi) ?? [];
  let cmd = "M";
  let from: Point = [0, 0];
  let to: Point = [0, 0];
  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i];
    if (/^[MLHVCZ]$/i.test(token)) {
      cmd = token.toUpperCase();
      i += 1;
    } else if (cmd === "H" || cmd === "V") {
      from = to;
      to = cmd === "H" ? [Number(token), to[1]] : [to[0], Number(token)];
      i += 1;
    } else if (cmd === "C") {
      const [, , c2x, c2y, x, y] = tokens.slice(i, i + 6).map(Number);
      from = [c2x, c2y];
      to = [x, y];
      i += 6;
    } else {
      from = to;
      to = [Number(token), Number(tokens[i + 1])];
      i += 2;
    }
  }
  return { from, to };
}
