// What a UV trace looks like, as paths (SVG strings, in points): the same drawing on the photo, small, and
// in its close-up, big. A trace is evidence the player compares with something else (a boot's size and
// tread against a cobbler's ticket, a fingertip's pattern against a ten-card, a hand against a letter),
// so what it carries must be unmistakable at both sizes:
//
//   footprints  three sizes (small, medium, large: a 23, 27 or 31 cm sole) and four treads: bars straight
//               across, a zigzag, rings, or bare feet with their toes;
//   prints/palm three ridge patterns: a whorl (rings round a core), a loop (hairpins in from one side and
//               back out), an arch (hills from side to side, no core); and a scar, a clean gap across them;
//   stain       what was spilt, by its shape and its colour under UV: wine a flung splash, coffee a cup's
//               ring, ink a spidery blot, wax round drops, bourbon a long puddle that ran;
//   writing     three hands (slanting left, slanting right, block capitals): see `handStyle`.
//
// Rooms stored before these attributes draw from the trace's seed alone (`lookOf`).
import type { TextStyle } from "react-native";
import type { TraceHand, TraceKind, TracePattern, TraceSize, TraceSpec, TraceStain, TraceTread } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { ref } from "@/theme/tokens";

export interface Box { x: number; y: number; w: number; h: number }

/** What can be seen in a trace: its attributes, or (older rooms) ones picked by its seed. */
export interface TraceLook {
  size: TraceSize;
  tread: TraceTread;
  pattern: TracePattern;
  scar: boolean;
  stain: TraceStain;
  hand: TraceHand;
}

type Spec = Pick<TraceSpec, "kind" | "surface" | "seed"> & Partial<Pick<TraceSpec, "size" | "tread" | "pattern" | "scar" | "stain" | "hand">>;

export function lookOf(t: Spec, genre: Genre): TraceLook {
  const rnd = mulberry(t.seed ^ 0x51f3);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
  // Picked in a fixed order, so a seed always gives the same look.
  const size = pick(["small", "medium", "large"] as const);
  const tread = pick(["bars", "zigzag", "rings"] as const);
  const pattern = pick(["whorl", "loop", "arch"] as const);
  const hand = pick(["left-slant", "right-slant", "block"] as const);
  return {
    size: t.size ?? (genre === "paranormal" ? "small" : size),
    tread: t.tread ?? (genre === "paranormal" ? "bare" : tread),
    pattern: t.pattern ?? pattern,
    scar: t.scar ?? false,
    stain: t.stain ?? (genre === "paranormal" ? "wax" : genre === "noir" ? "bourbon" : "wine"),
    hand: t.hand ?? hand,
  };
}

/** A sole's length in centimetres: what the close-up's scale reads. */
export const SOLE_CM: Record<TraceSize, number> = { small: 23, medium: 27, large: 31 };

/** A trace's colours under UV: its crisp line, its glowing body, and the soft blot that bleeds round it. */
export interface Tint { core: string; fill: string; blot: string; halo: string }
const VIOLET: Tint = { core: "rgba(240,232,255,0.98)", fill: "rgba(190,164,255,0.5)", blot: "rgba(150,120,255,0.34)", halo: "rgba(120,232,255,0.45)" };
/** What was spilt fluoresces in its own colour. */
export const STAIN_TINT: Record<TraceStain, Tint> = {
  wine: { core: "rgba(255,170,210,0.98)", fill: "rgba(226,84,150,0.62)", blot: "rgba(200,60,130,0.36)", halo: "rgba(255,120,190,0.4)" },
  coffee: { core: "rgba(255,206,150,0.98)", fill: "rgba(214,138,66,0.6)", blot: "rgba(190,110,50,0.34)", halo: "rgba(255,170,90,0.4)" },
  ink: { core: "rgba(150,196,255,0.98)", fill: "rgba(40,70,200,0.72)", blot: "rgba(30,50,170,0.4)", halo: "rgba(90,150,255,0.45)" },
  wax: { core: "rgba(255,252,236,1)", fill: "rgba(250,244,214,0.8)", blot: "rgba(240,230,190,0.32)", halo: "rgba(255,250,220,0.45)" },
  bourbon: { core: "rgba(236,255,150,0.98)", fill: "rgba(196,226,70,0.58)", blot: "rgba(170,210,60,0.34)", halo: "rgba(210,255,110,0.42)" },
};

export interface Art {
  /** A soft blot under it (a palm's pressure, the wet of a splash): drawn blurred. */
  blot: string;
  /** Its glowing body. */
  fill: string;
  /** Its crisp lines (ridges, a tread, a rim). */
  lines: string;
  /** The core line's width (points). */
  line: number;
  /** A gap cut clean through all of it (a scar), and its width. */
  cut?: string;
  cutWidth?: number;
  tint: Tint;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function mulberry(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];
const f1 = (v: number) => v.toFixed(1);
/** A polyline through points, optionally closed. */
const poly = (pts: Pt[], close = false) =>
  pts.length < 2 ? "" : pts.map(([x, y], i) => `${i ? "L" : "M"}${f1(x)} ${f1(y)}`).join(" ") + (close ? " Z" : "");

/** An ellipse (or an arc of one, with a gap), rotated, with a little wobble. */
function ellipse(cx: number, cy: number, rx: number, ry: number, rot: number, rnd: () => number, gap = 0, start = 0, wobble = 0.05, n = 26): string {
  const pts: Pt[] = [];
  const span = Math.PI * 2 - gap;
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = start + (span * i) / n;
    const k = 1 + (rnd() - 0.5) * wobble;
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return poly(pts, gap === 0);
}

/** A polyline kept only where `inside` holds, broken now and then (a ridge ending): its pieces. */
function clipped(pts: Pt[], inside: (p: Pt) => boolean, rnd: () => number, breaks: number, place: (p: Pt) => Pt): string {
  const out: string[] = [];
  let run: Pt[] = [];
  const flush = () => {
    if (run.length > 1) out.push(poly(run.map(place)));
    run = [];
  };
  for (const p of pts) {
    if (!inside(p) || rnd() < breaks) flush();
    else run.push(p);
  }
  flush();
  return out.join(" ");
}

// ---------------------------------------------------------------------------
// Fingertips
// ---------------------------------------------------------------------------
/**
 * One fingertip's print inside its oval (`rx` wide, a third taller), turned by `rot`: its ridges in the
 * pattern, a ridge every `gap` points. A scar is a clean straight gap across them (returned to be cut
 * through the glow as well).
 */
export function fingertip(cx: number, cy: number, rx: number, rot: number, pattern: TracePattern, scar: boolean, rnd: () => number, gap = 2.1): { lines: string; oval: string; cut: string } {
  const ry = rx * 1.32;
  const c = Math.cos(rot), s = Math.sin(rot);
  const place = ([u, v]: Pt): Pt => [cx + u * c - v * s, cy + u * s + v * c];
  // The scar: a line across, a little off the core, its band left clear.
  const sa = -0.55, sc = Math.cos(sa), ss = Math.sin(sa);
  const off = ry * 0.18;
  const band = Math.max(gap * 0.75, rx * 0.085);
  const onScar = ([u, v]: Pt) => scar && Math.abs(-u * ss + (v - off) * sc) < band;
  // Inside the fingertip, a little ragged at the edge where the pressure fell off.
  const inside = (p: Pt) => (p[0] / rx) ** 2 + (p[1] / ry) ** 2 <= 0.94 + (rnd() - 0.5) * 0.08 && !onScar(p);
  const breaks = 0.012;
  const ridges: string[] = [];
  const push = (pts: Pt[]) => ridges.push(clipped(pts, inside, rnd, breaks, place));
  const core: Pt = [0, -ry * 0.06];
  const far = Math.ceil((ry * 1.5) / gap);
  if (pattern === "whorl") {
    // Rings round a core, to the edge: a bullseye.
    push([[core[0] - gap * 0.3, core[1]], [core[0] + gap * 0.3, core[1]]]);
    for (let j = 1; j <= far; j++) {
      const a = j * gap, b = j * gap * 1.12;
      const n = Math.max(24, Math.round(a * 3));
      const pts: Pt[] = [];
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * Math.PI * 2 + j;
        pts.push([core[0] + Math.cos(t) * a, core[1] + Math.sin(t) * b]);
      }
      push(pts);
    }
  } else if (pattern === "loop") {
    // Hairpins: in from the lower left, round the core, back out the way they came. Over them, arches.
    const lean = -0.55;   // the legs run down and to the left
    const loops = Math.max(3, Math.floor((rx * 0.62) / gap));
    for (let j = 0; j <= far; j++) {
      const a = (j + 0.5) * gap;
      const pts: Pt[] = [];
      const leg = ry * 1.6;
      if (j < loops) {
        for (let i = 0; i <= 14; i++) { const d = leg * (1 - i / 14); pts.push([core[0] - a + lean * d, core[1] + d]); }
        for (let i = 1; i <= 20; i++) { const t = Math.PI - (i / 20) * Math.PI; pts.push([core[0] + Math.cos(t) * a, core[1] - Math.sin(t) * a * 1.1]); }
        for (let i = 1; i <= 14; i++) { const d = leg * (i / 14); pts.push([core[0] + a + lean * d, core[1] + d]); }
      } else {
        // Past the loop: ridges that ride over it and flow on to the right, never turning back.
        const k = j - loops;
        const top = core[1] - (loops * gap + (k + 0.5) * gap) * 1.1;
        for (let i = 0; i <= 30; i++) {
          const u = -rx * 1.1 + (2.2 * rx * i) / 30;
          const x = (u - core[0]) / (rx * 0.9);
          pts.push([u, top + ry * 0.45 * x * x * (u < core[0] ? 1.1 : 0.75)]);
        }
      }
      push(pts);
    }
    // The delta's side: ridges that run under the loop's mouth, left to right.
    for (let j = 0; j < far; j++) {
      const base = core[1] + ry * 0.55 + j * gap;
      const pts: Pt[] = [];
      for (let i = 0; i <= 16; i++) {
        const u = core[0] + loops * gap * 0.4 + (rx * 1.2 * i) / 16;
        pts.push([u, base - (i / 16) * ry * 0.18]);
      }
      push(pts);
    }
  } else {
    // Arches: every ridge crosses from side to side, rising over the middle like a hill. No core.
    for (let j = -far; j <= far; j++) {
      const v0 = j * gap;
      const lift = ry * 0.62 * Math.exp(-1 * ((v0 - ry * 0.1) / (ry * 0.75)) ** 2);
      const pts: Pt[] = [];
      for (let i = 0; i <= 30; i++) {
        const u = -rx * 1.05 + (2.1 * rx * i) / 30;
        pts.push([u, v0 - lift * Math.exp(-1 * (u / (rx * 0.5)) ** 2)]);
      }
      push(pts);
    }
  }
  const oval = ellipse(cx, cy, rx * 0.94, ry * 0.94, rot, rnd, 0, 0, 0.06, 26);
  const reach = rx * 1.02;
  const cut = scar ? poly([place([-sc * reach, off - ss * reach]), place([sc * reach, off + ss * reach])]) : "";
  return { lines: ridges.join(" "), oval, cut };
}

/** Fingertips as a hand leaves them: two or three in an arc, and the thumb below. */
function prints(b: Box, look: TraceLook, rnd: () => number, gap: number): Art {
  const n = b.w > b.h * 1.25 ? 3 : 2;
  const rx = Math.min(b.w / (n * 2 + 0.7), b.h * 0.3);
  const tilt = (rnd() - 0.5) * 0.3;
  const lines: string[] = [], blots: string[] = [], cuts: string[] = [];
  const tip = (cx: number, cy: number, r: number, rot: number) => {
    const f = fingertip(cx, cy, r, rot, look.pattern, look.scar, rnd, gap);
    lines.push(f.lines);
    blots.push(f.oval);
    if (f.cut) cuts.push(f.cut);
  };
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    tip(b.x + b.w * (0.5 + (u - 0.5) * (n === 3 ? 0.68 : 0.52)), b.y + b.h * (0.47 + 0.2 * (u - 0.45) ** 2), rx * (i === n - 1 ? 0.92 : 1), (u - 0.5) * 0.4 + tilt);
  }
  return { blot: blots.join(" "), fill: "", lines: lines.join(" "), line: Math.max(0.9, gap * 0.36), cut: cuts.join(" "), cutWidth: Math.max(gap * 1.5, rx * 0.17), tint: VIOLET };
}

/** A palm pressed flat: its pressure, its creases, four spread fingers and a thumb with ridged tips. */
function palm(b: Box, look: TraceLook, rnd: () => number, gap: number): Art {
  const pcx = b.x + b.w * 0.52, pcy = b.y + b.h * 0.7, prx = b.w * 0.25, pry = b.h * 0.19;
  const tilt = (rnd() - 0.5) * 0.3;
  const body = ellipse(pcx, pcy, prx, pry, tilt, rnd, 0, 0, 0.12, 30);
  const fingers: string[] = [], tips: string[] = [];
  const lengths = [0.25, 0.3, 0.28, 0.21];
  const tipR = b.w * 0.052;
  for (let i = 0; i < 4; i++) {
    const spread = (i - 1.5) * 0.16 + tilt;
    const len = b.h * lengths[i] * (0.92 + rnd() * 0.16);
    const baseX = pcx + prx * (-0.72 + 0.48 * i), baseY = pcy - pry * (0.8 - Math.abs(i - 1.5) * 0.1);
    const dx = Math.sin(spread), dy = -Math.cos(spread);
    fingers.push(ellipse(baseX + dx * len * 0.42, baseY + dy * len * 0.42, b.w * 0.05, len * 0.42, spread, rnd, 0, 0, 0.06, 22));
    tips.push(fingertip(baseX + dx * len * 0.84, baseY + dy * len * 0.84, tipR, spread, look.pattern, false, rnd, gap).lines);
  }
  const ta = -1.05 + tilt;
  const tl = b.h * 0.2;
  const tbx = pcx - prx * 0.85, tby = pcy - pry * 0.05;
  fingers.push(ellipse(tbx + Math.sin(ta) * tl * 0.42, tby - Math.cos(ta) * tl * 0.42, b.w * 0.055, tl * 0.42, ta, rnd, 0, 0, 0.06, 20));
  tips.push(fingertip(tbx + Math.sin(ta) * tl * 0.82, tby - Math.cos(ta) * tl * 0.82, tipR * 1.1, ta, look.pattern, false, rnd, gap).lines);
  // The palm's lines: heart, head and life.
  const crease = (q: number, bend: number, from: number, to: number) => poly(Array.from({ length: 11 }, (_, i) => {
    const x = pcx + prx * (from + ((to - from) * i) / 10);
    return [x, pcy - pry * 0.55 + pry * q + Math.sin(i * 0.6 + q * 5) * pry * 0.06 + (i - 5) ** 2 * pry * bend] as Pt;
  }));
  const life = poly(Array.from({ length: 10 }, (_, i) => {
    const a = -0.2 + (i / 9) * 1.5;
    return [pcx - prx * 0.5 + Math.cos(a) * prx * 0.35, pcy - pry * 0.3 + Math.sin(a) * pry * 0.95] as Pt;
  }));
  // A scar: a clean gap straight across the palm.
  const cut = look.scar ? poly([[pcx - prx * 0.95, pcy + pry * 0.55], [pcx + prx * 0.9, pcy - pry * 0.35]]) : "";
  return {
    blot: [body, ...fingers].join(" "), fill: [body, ...fingers].join(" "), lines: [crease(0.25, 0.012, -0.7, 0.75), crease(0.55, 0.006, -0.75, 0.45), life, ...tips].join(" "),
    line: Math.max(0.8, gap * 0.34), cut, cutWidth: Math.max(2.2, b.w * 0.035), tint: VIOLET,
  };
}

// ---------------------------------------------------------------------------
// Feet
// ---------------------------------------------------------------------------
/**
 * One foot's print, `L` long, its heel-to-toe axis turned by `ang` (0: toe to the right), a left or a
 * right foot (`side`), every point passed through `to` (a floor's perspective; identity in a close-up).
 */
export function sole(px: number, py: number, L: number, ang: number, side: 1 | -1, tread: TraceTread, rnd: () => number, to: (p: Pt) => Pt = (p) => p): { fill: string[]; lines: string[] } {
  const c = Math.cos(ang), s = Math.sin(ang);
  // `u` along the foot (0 heel, 1 toe), `v` across it (in lengths).
  const at = (u: number, v: number): Pt => {
    const ax = (u - 0.5) * L, ay = v * L;
    return to([px + ax * c - ay * s, py + ax * s + ay * c]);
  };
  const bare = tread === "bare";
  /** A rounded end: the width's share `d` (0..1) of the way into an end's rounding. */
  const round = (d: number) => Math.sqrt(Math.max(0, 1 - (1 - Math.max(0, Math.min(1, d))) ** 2));
  // Half-width along the foot. A shoe: a heel block rounded at the back, and a sole widest under the ball,
  // rounded at the toe and narrow at the waist. A bare foot: a round heel, a narrow arch, a wide ball.
  const width = (u: number) => (bare
    ? (0.1 + 0.08 * Math.sin(Math.PI * Math.min(1, u * 1.1)) - (u > 0.26 && u < 0.56 ? 0.04 * Math.sin((Math.PI * (u - 0.26)) / 0.3) : 0)) * round(u / 0.1) * round((0.84 - u) / 0.06)
    : u < 0.31
      ? 0.128 * round(u / 0.11)
      : (0.168 - (u - 0.72) ** 2 * 0.62) * round((1 - u) / 0.17) * (0.72 + 0.28 * round((u - 0.35) / 0.05)));
  // The inside of the foot curves in at the waist: shift the centre line outward there.
  const mid = (u: number) => side * 0.022 * Math.sin(Math.PI * u);
  const outline = (from: number, to2: number) => {
    const pts: Pt[] = [];
    const N = 36;
    // Closer together at the ends, where it rounds.
    const us = Array.from({ length: N + 1 }, (_, j) => from + (to2 - from) * (0.5 - 0.5 * Math.cos((Math.PI * j) / N)));
    for (const u of us) pts.push(at(u, mid(u) + width(u)));
    for (const u of [...us].reverse()) pts.push(at(u, mid(u) - width(u)));
    return poly(pts, true);
  };
  const fill: string[] = [], lines: string[] = [];
  const across = (u: number, share = 0.74, bend = 0) => {
    const w = width(u) * share;
    const pts: Pt[] = [];
    for (let j = 0; j <= 8; j++) { const q = j / 8; pts.push(at(u + bend * Math.sin(Math.PI * q), mid(u) - w + 2 * w * q)); }
    return poly(pts);
  };
  if (bare) {
    const foot = outline(0, 0.84);
    fill.push(foot);
    lines.push(foot);
    for (let t = 0; t < 5; t++) {
      // The big toe on the inside, the others smaller, stepping back across the foot.
      const v = side * (-0.072 + t * 0.041);
      const u = 0.9 - t * 0.02;
      const [x, y] = at(u, v);
      const [x2, y2] = at(u + 0.01, v);
      const r = L * (t === 0 ? 0.046 : 0.031 - t * 0.0015);
      const k = Math.hypot(x2 - x, y2 - y) / (0.01 * L) || 1;   // the floor's squash at this toe
      const toe = ellipse(x, y, r, r * Math.max(0.5, Math.min(1, k)), 0, rnd, 0, 0, 0.08, 12);
      fill.push(toe);
      lines.push(toe);
    }
    return { fill, lines };
  }
  const heel = outline(0, 0.28), front = outline(0.36, 1);
  fill.push(heel, front);
  lines.push(heel, front);
  if (tread === "bars") {
    // Bars straight across, evenly spaced: the sole and the heel.
    for (let u = 0.44; u < 0.955; u += 0.085) lines.push(across(u));
    for (let u = 0.085; u < 0.25; u += 0.07) lines.push(across(u, 0.7));
  } else if (tread === "zigzag") {
    // A zigzag from side to side, row on row.
    const zig = (u: number, share: number) => {
      const w = width(u) * share;
      const pts: Pt[] = [];
      for (let j = 0; j <= 6; j++) pts.push(at(u + (j % 2 ? 0.03 : -0.03), mid(u) - w + (2 * w * j) / 6));
      return poly(pts);
    };
    for (let u = 0.46; u < 0.94; u += 0.095) lines.push(zig(u, 0.76));
    for (let u = 0.1; u < 0.24; u += 0.085) lines.push(zig(u, 0.7));
  } else {
    // Rings: circles within circles under the ball of the foot and under the heel.
    const ring = (u: number, r: number) => {
      const pts: Pt[] = [];
      for (let j = 0; j <= 24; j++) { const a = (j / 24) * Math.PI * 2; pts.push(at(u + Math.cos(a) * r, mid(u) + Math.sin(a) * r)); }
      return poly(pts, true);
    };
    for (const r of [0.035, 0.075, 0.115]) lines.push(ring(0.7, r));
    lines.push(ring(0.92, 0.03), ring(0.47, 0.035));
    for (const r of [0.035, 0.08]) lines.push(ring(0.15, r));
  }
  return { fill, lines };
}

/** A sole's length on the photo, as a share of the box's width: the three sizes plainly apart. */
const STRIDE_SIZE: Record<TraceSize, number> = { small: 0.3, medium: 0.38, large: 0.47 };

/** A stride across the floor: three prints, left and right, on the floor's plane, flattened by its perspective. */
function footprints(b: Box, look: TraceLook, rnd: () => number): Art {
  const n = 3;
  const ltr = rnd() < 0.5;
  const flatten = 0.6;
  const oy = b.y + b.h / 2;
  const x0 = ltr ? b.x + b.w * 0.12 : b.x + b.w * 0.88, x1 = ltr ? b.x + b.w * 0.88 : b.x + b.w * 0.12;
  const y0 = oy + (b.h * 0.3) / flatten, y1 = oy - (b.h * 0.26) / flatten;
  // Perspective: the far end of the walk (up the photo) smaller.
  const to = ([x, y]: Pt): Pt => {
    const depth = 1 - 0.18 * Math.max(0, Math.min(1, (y0 - y) / (y0 - y1)));
    const mx = b.x + b.w / 2;
    return [mx + (x - mx) * (0.9 + 0.1 * depth), oy + (y - oy) * flatten];
  };
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const L = b.w * STRIDE_SIZE[look.size];
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const fill: string[] = [], lines: string[] = [];
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const side = i % 2 === 0 ? 1 : -1;
    const px = x0 + (x1 - x0) * k - sa * side * L * 0.24;
    const py = y0 + (y1 - y0) * k + ca * side * L * 0.24;
    const f = sole(px, py, L, ang + side * 0.1 + (rnd() - 0.5) * 0.06, side, look.tread, rnd, to);
    fill.push(...f.fill);
    lines.push(...f.lines);
  }
  return { blot: "", fill: fill.join(" "), lines: lines.join(" "), line: 1, tint: VIOLET };
}

// ---------------------------------------------------------------------------
// Stains
// ---------------------------------------------------------------------------
/** What was spilt, dried where it landed: each its own shape (and colour: STAIN_TINT). */
function stain(b: Box, look: TraceLook, floor: boolean, rnd: () => number): Art {
  const cx = b.x + b.w * 0.48, cy = b.y + b.h * 0.5;
  const squash = floor ? 0.62 : 1;
  const R = Math.min(b.w * 0.24, (b.h * 0.34) / squash);
  const at = (a: number, d: number, ox = 0, oy = 0): Pt => [cx + ox + Math.cos(a) * d, cy + (oy + Math.sin(a) * d) * squash];
  const blob = (r: number, lump: number, ox = 0, oy = 0, n = 48): string => {
    const k1 = rnd() * 6, k2 = rnd() * 6;
    return poly(Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return at(a, r * (1 + lump * Math.sin(3 * a + k1) + lump * 0.6 * Math.sin(7 * a + k2)), ox, oy);
    }), true);
  };
  const dot = (ox: number, oy: number, r: number) => poly(Array.from({ length: 14 }, (_, i) => at((i / 14) * Math.PI * 2, r, ox, oy)), true);
  const tint = STAIN_TINT[look.stain];
  const fill: string[] = [], lines: string[] = [];
  let blot = "";
  switch (look.stain) {
    case "wine": {
      // Flung: an uneven pool, spikes off its edge, and teardrops beyond, their tails pointing back.
      const pool = blob(R, 0.2);
      blot = pool;
      fill.push(pool);
      lines.push(pool);
      const dir = rnd() * Math.PI * 2;
      for (let i = 0; i < 9; i++) {
        const a = dir + (rnd() - 0.5) * 2.6, len = R * (0.4 + rnd() * 0.7), half = 0.09 + rnd() * 0.06;
        fill.push(poly([at(a - half, R * 0.9), at(a, R + len), at(a + half, R * 0.9)], true));
      }
      for (let i = 0; i < 10; i++) {
        const a = dir + (rnd() - 0.5) * 2.4, d = R * (1.6 + rnd() * 1.3), dr = R * (0.06 + rnd() * 0.08);
        const drop: Pt[] = [];
        for (let j = 0; j <= 12; j++) { const q = a - Math.PI / 2 + (j / 12) * Math.PI; drop.push(at(q, dr, Math.cos(a) * d, Math.sin(a) * d)); }
        drop.push(at(a, d - dr * 3.4));
        fill.push(poly(drop, true));
      }
      break;
    }
    case "coffee": {
      // A cup's ring, left where it stood, open where the cup was lifted, and a few drips beside it.
      const ring = (r: number) => poly(Array.from({ length: 40 }, (_, i) => at(0.5 + (i / 39) * Math.PI * 1.82, r * (1 + 0.012 * Math.sin(i)))));
      lines.push(ring(R * 1.02), ring(R * 0.9), ring(R * 0.96));
      blot = dot(0, 0, R);
      for (let i = 0; i < 4; i++) { const a = -0.4 + rnd() * 1.2; fill.push(dot(Math.cos(a) * R * (1.45 + rnd() * 0.5), Math.sin(a) * R * (1.45 + rnd() * 0.5), R * (0.07 + rnd() * 0.07))); }
      break;
    }
    case "ink": {
      // A blot: dense, with long thin legs run out of it along the grain, and a fine spray.
      const body = blob(R * 0.72, 0.1);
      blot = body;
      fill.push(body);
      lines.push(body);
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + rnd() * 0.3, len = R * (0.55 + rnd() * 0.95);
        fill.push(poly([at(a - 0.07, R * 0.66), at(a, R * 0.72 + len), at(a + 0.07, R * 0.66)], true));
        fill.push(dot(Math.cos(a) * (R * 0.72 + len), Math.sin(a) * (R * 0.72 + len), R * 0.035));
      }
      break;
    }
    case "wax": {
      // Drops: round, each where it fell, some run together, in a line as the candle was carried.
      const dir = (rnd() - 0.5) * 0.5;
      for (let i = 0; i < 7; i++) {
        const q = (i - 3) / 3, r = R * (0.2 + rnd() * 0.22);
        const ox = Math.cos(dir) * q * R * 1.9 + (rnd() - 0.5) * R * 0.3, oy = Math.sin(dir) * q * R * 1.9 + (rnd() - 0.5) * R * 0.5;
        const drop = dot(ox, oy, r);
        fill.push(drop);
        lines.push(drop);
        // The drop's sheen: a short arc inside it.
        lines.push(poly(Array.from({ length: 6 }, (_, j) => at(-2.4 + (j / 5) * 0.9, r * 0.6, ox, oy))));
      }
      blot = fill.join(" ");
      break;
    }
    case "bourbon": {
      // A glass knocked over: a long smooth puddle, a tongue of it run off one end, a drop or two.
      const k = rnd() * 6;
      const pool = poly(Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2;
        const run = Math.max(0, Math.cos(a)) ** 6 * 0.9;   // the tongue, off to the right
        return [cx + Math.cos(a) * R * (1.5 + run + 0.06 * Math.sin(3 * a + k)), cy + Math.sin(a) * R * (0.72 + 0.05 * Math.sin(5 * a + k)) * squash] as Pt;
      }), true);
      blot = pool;
      fill.push(pool);
      lines.push(pool);
      fill.push(dot(-R * 1.9, R * 0.5, R * 0.1), dot(-R * 2.1, -R * 0.2, R * 0.07));
      break;
    }
  }
  return { blot, fill: fill.join(" "), lines: lines.join(" "), line: 1, tint };
}

// ---------------------------------------------------------------------------
// A trace
// ---------------------------------------------------------------------------
/**
 * A trace's shapes inside `box` (points). `detail`: the space between a fingertip's ridges (points): about 2
 * on the photo, wider in a close-up, so the pattern reads at either size. Writing has no shapes: its words
 * are lettered (`handStyle`).
 */
export function traceArt(t: Spec, box: Box, genre: Genre, detail = 2.1): Art {
  const look = lookOf(t, genre);
  const rnd = mulberry(t.seed);
  switch (t.kind) {
    case "prints": return prints(box, look, rnd, detail);
    case "palm": return palm(box, look, rnd, detail);
    case "footprints": return footprints(box, look, rnd);
    case "stain": return stain(box, look, t.surface === "floor", rnd);
    case "writing": return { blot: "", fill: "", lines: "", line: 1, tint: VIOLET };
  }
}

/** One sole from above, heel down, for the close-up: `L` points long, centred at (cx, cy). */
export function soleArt(t: Spec, cx: number, cy: number, L: number, genre: Genre): Art {
  const look = lookOf(t, genre);
  const f = sole(cx, cy, L, -Math.PI / 2, 1, look.tread, mulberry(t.seed));
  return { blot: "", fill: f.fill.join(" "), lines: f.lines.join(" "), line: Math.max(1.2, L * 0.006), tint: VIOLET };
}

/** Kinds whose trace is shapes (the rest is lettering). */
export const isDrawn = (kind: TraceKind) => kind !== "writing";

// ---------------------------------------------------------------------------
// Hands
// ---------------------------------------------------------------------------
/**
 * The three hands writing comes in, told apart by their letters as well as their slant (so they differ
 * even where a slant can't be drawn): slanting left, a round upright hand pushed back; slanting right,
 * a flowing italic; block, spaced capitals. Anything written in the same hand elsewhere (a letter, a
 * sample) uses the same style.
 */
export function handStyle(hand: TraceHand): { text: TextStyle; skew: string; upper: boolean; em: number; cap: number } {
  switch (hand) {
    case "left-slant": return { text: { fontFamily: ref.font.hand }, skew: "14deg", upper: false, em: 0.47, cap: 0.7 };
    case "right-slant": return { text: { fontFamily: ref.font.italic, letterSpacing: 0.4 }, skew: "-6deg", upper: false, em: 0.47, cap: 0.66 };
    case "block": return { text: { fontFamily: ref.font.hand, letterSpacing: 2.2 }, skew: "0deg", upper: true, em: 0.66, cap: 0.7 };
  }
}

/** A text's width in ems: letters and digits at the hand's width, a space narrower, a mark (● ▲ ★) a full em. */
export function textEms(text: string, em: number): number {
  let n = 0;
  for (const c of text) n += c === " " ? 0.32 : /[\p{L}\p{N}.,;:!?'"()-]/u.test(c) ? em : 1.05;
  return Math.max(em, n);
}

/**
 * Where a trace's words are lettered on the photo, and how big: centred on the trace's box, as wide as
 * the words need (wrapped past `maxW`), never smaller than reads on a phone (capitals 14 points tall or
 * more), kept inside the photo.
 */
export function lettering(text: string, hand: TraceHand, box: Box, bounds: { w: number; h: number }, maxW = 300): { left: number; top: number; width: number; height: number; size: number; lineHeight: number; lines: number } {
  const style = handStyle(hand);
  const minSize = Math.ceil(15.5 / style.cap);
  const ems = textEms(text, style.em);
  const spacing = (style.text.letterSpacing ?? 0) * text.length;
  // As big as the box's width allows on one line, within what reads and what suits a wall.
  const size = Math.round(Math.max(minSize, Math.min(30, (box.w - spacing) / ems)));
  const need = ems * size + spacing + 16;
  const limit = Math.min(maxW, bounds.w - 16);
  const width = Math.min(limit, Math.max(need, 40));
  const lines = Math.min(4, Math.max(1, Math.ceil(need / (width - 8))));
  const lineHeight = Math.ceil(size * 1.22);
  const height = lines * lineHeight + 8;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  return {
    left: Math.max(8, Math.min(bounds.w - 8 - width, cx - width / 2)),
    top: Math.max(8, Math.min(bounds.h - 8 - height, cy - height / 2)),
    width, height, size, lineHeight, lines,
  };
}
