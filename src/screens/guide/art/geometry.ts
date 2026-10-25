// Geometry for the guide's line art, in the art box's own units. The hero
// phone, its inner screen, its corner radius and the brackets are built from
// ref.layout.guide.phone / .bracket; everything else in the scenes is drawing
// data (scenes.ts).
import { ref } from "@/theme/tokens";
import type { Point } from "./types";

const PHONE = ref.layout.guide.phone;
const BRACKET = ref.layout.guide.bracket;
const R = PHONE.radius;

// A quarter circle as one cubic Bezier: control points at kappa x radius.
const KAPPA = (4 / 3) * (Math.SQRT2 - 1);
const DEG = Math.PI / 180;

/** Path numbers to two decimals, so path data stays short and stable. */
const n = (value: number) => String(Math.round(value * 100) / 100);

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The hero phone's body (70 x 137) with its top-left corner at (x, y). */
export function phoneBody(x: number, y: number): Box {
  return { x, y, width: PHONE.width, height: PHONE.height };
}

/** The inner screen: inset 13 at the sides, 24.5 at the top and 27 at the bottom (44 x 85.5). */
export function phoneScreen(x: number, y: number): Box {
  return {
    x: x + PHONE.screenInsetX,
    y: y + PHONE.screenInsetTop,
    width: PHONE.width - PHONE.screenInsetX * 2,
    height: PHONE.height - PHONE.screenInsetTop - PHONE.screenInsetBottom,
  };
}

/**
 * The four bracket L-shapes inside a screen: arms 9, corners inset 4 from the
 * screen's edge (the radius-6 corner's 45 degree point is 1.8 in, so they
 * clear it). 02's viewfinder brackets at illustration scale.
 */
export function bracketPaths(screen: Box): string[] {
  const { arm, inset } = BRACKET;
  const left = screen.x + inset;
  const right = screen.x + screen.width - inset;
  const top = screen.y + inset;
  const bottom = screen.y + screen.height - inset;
  return [
    `M${n(left)} ${n(top + arm)}V${n(top)}H${n(left + arm)}`,
    `M${n(right - arm)} ${n(top)}H${n(right)}V${n(top + arm)}`,
    `M${n(right)} ${n(bottom - arm)}V${n(bottom)}H${n(right - arm)}`,
    `M${n(left + arm)} ${n(bottom)}H${n(left)}V${n(bottom - arm)}`,
  ];
}

/** A point `length` from `from`, heading `deg` clockwise from straight up. */
export function polar(from: Point, deg: number, length: number): Point {
  return [from[0] + Math.sin(deg * DEG) * length, from[1] - Math.cos(deg * DEG) * length];
}

/** Rotates `p` by `deg` clockwise about `c`. */
function rotate(p: Point, c: Point, deg: number): Point {
  const cos = Math.cos(deg * DEG);
  const sin = Math.sin(deg * DEG);
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * cos - dy * sin, c[1] + dx * sin + dy * cos];
}

/**
 * A rounded rectangle (corner radius ref.layout.guide.phone.radius) centred on `centre` and
 * turned `deg` clockwise, as path data with cubic corners. Step 2's phone plan
 * symbols use it, so their outlines can turn toward what they photograph.
 */
export function roundedRect(centre: Point, width: number, height: number, deg: number): string {
  const [cx, cy] = centre;
  const l = cx - width / 2;
  const r = cx + width / 2;
  const t = cy - height / 2;
  const b = cy + height / 2;
  const k = R * KAPPA;
  // Clockwise from the top edge, each corner as one cubic.
  const pts: Point[][] = [
    [[l + R, t]],
    [[r - R, t]],
    [[r - R + k, t], [r, t + R - k], [r, t + R]],
    [[r, b - R]],
    [[r, b - R + k], [r - R + k, b], [r - R, b]],
    [[l + R, b]],
    [[l + R - k, b], [l, b - R + k], [l, b - R]],
    [[l, t + R]],
    [[l, t + R - k], [l + R - k, t], [l + R, t]],
  ];
  const at = (p: Point) => {
    const q = rotate(p, centre, deg);
    return `${n(q[0])} ${n(q[1])}`;
  };
  return pts
    .map((seg, i) => (i === 0 ? `M${at(seg[0])}` : seg.length === 1 ? `L${at(seg[0])}` : `C${seg.map(at).join(" ")}`))
    .join("")
    .concat("Z");
}

/** Where a turned plan phone points from: the middle of its top (far) edge. */
export function planPhoneTip(centre: Point, deg: number): Point {
  return polar(centre, deg, ref.layout.guide.planPhone.height / 2);
}

/** A circle as four cubics. */
export function circle(c: Point, radius: number): string {
  const [x, y] = c;
  const k = radius * KAPPA;
  return [
    `M${n(x)} ${n(y - radius)}`,
    `C${n(x + k)} ${n(y - radius)} ${n(x + radius)} ${n(y - k)} ${n(x + radius)} ${n(y)}`,
    `C${n(x + radius)} ${n(y + k)} ${n(x + k)} ${n(y + radius)} ${n(x)} ${n(y + radius)}`,
    `C${n(x - k)} ${n(y + radius)} ${n(x - radius)} ${n(y + k)} ${n(x - radius)} ${n(y)}`,
    `C${n(x - radius)} ${n(y - k)} ${n(x - k)} ${n(y - radius)} ${n(x)} ${n(y - radius)}Z`,
  ].join("");
}

/** A straight segment as path data. */
export function segment(a: Point, b: Point): string {
  return `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;
}

/**
 * The last point of M/L/H/V/C path data, and the point it is approached from
 * (a curve's last control point), which together give the path's final
 * direction: where a fade runs out.
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
      // Two control points, then the end point: six numbers.
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
