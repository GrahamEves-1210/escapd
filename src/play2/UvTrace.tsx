// Traces on the photo that only ultraviolet shows (gameplay v2: UV evidence),
// drawn as what they are: fingerprints with their ridges (whorls and loops), a
// palm pressed flat with its creases, a dried splash with its spatter, a
// line of shoe prints with their tread (bare feet in
// the paranormal), and writing in a hurried hand. Each is drawn procedurally
// from its seed, scaled to its box and laid on its surface (a floor's
// perspective flattens it, a wall's slants it a little), in the colours of
// things that fluoresce: a violet-white core in a soft cyan bloom, bleeding a
// little into the surface. They show only where the UV beam falls (the beam is
// the mask) and never in the ordinary light.
//
// Writing says what it says once the light has found it (the engine's glow
// mark): before that, for the moment it takes, a faint latent smear where the
// words are, which the words then develop out of.
//
// Also here: writing revealed on objects (glow marks), seen under the UV beam
// or plainly while a lamp is lit.
//
// The trace the UV beam is on is reported (`onTrace`) while the UV light is on,
// worked out on the UI thread: the beam's bright middle over it, a moment, and
// the room hears it. `traceAt` is the tap's and the magnifier's hit-test.
import { useMemo } from "react";
import { StyleSheet, Text, View, type TextStyle } from "react-native";
import { BlurMask, Canvas, Group, Paint, Path, RadialGradient, Rect, vec } from "@shopify/react-native-skia";
import Animated, { FadeIn, useAnimatedReaction, useAnimatedStyle, useDerivedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Rect as Box, TraceKind, TraceSpec } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { useModeTheme } from "@/game/mode";
import { handType } from "./journal/palette";

export interface StageTrace {
  id: string;
  label: string;
  kind: TraceKind;
  surface: TraceSpec["surface"];
  seed: number;
  box: Box;
  /** The UV light has found it (the engine said so): it can be looked at. */
  revealed: boolean;
  /** What the writing says, once revealed (writing traces). */
  mark?: string;
}

export interface UvTraceProps {
  traces: StageTrace[];
  /** Writing revealed on objects (glow marks). */
  marks: { object: string; box: Box; text: string }[];
  genre: Genre;
  w: number;
  h: number;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  /** The beam's radius (points). */
  r: number;
  uv: boolean;
  /** A lamp is lit: glow marks show plainly. */
  lampLit: boolean;
  onTrace?: (id: string | null) => void;
  /** Screen readers: a revealed trace is a button that looks at it. */
  onOpen?: (id: string) => void;
}

/** The glow: a violet-white core and a cyan bloom, the colours of things that fluoresce. */
const UV = {
  core: "rgba(236,226,255,0.95)",
  halo: "rgba(120,232,255,0.5)",
  fill: "rgba(186,160,255,0.42)",
  blot: "rgba(150,120,255,0.38)",
  /** The beam's mask: full in its middle, gone at its edge. */
  mask: ["rgba(0,0,0,1)", "rgba(0,0,0,0.9)", "rgba(0,0,0,0)"],
  stops: [0, 0.5, 1],
  /** The beam is on a trace when its middle (this share of its radius) reaches the trace's box. */
  reach: 0.35,
} as const;

/**
 * The trace under a point (photo fractions), the smallest box first, with `slack` round each box:
 * only the revealed ones unless `any`.
 */
export function traceAt<T extends Pick<StageTrace, "box" | "revealed">>(traces: readonly T[], x: number, y: number, slack = 0.03, any = false): T | null {
  let best: T | null = null;
  for (const t of traces) {
    const b = t.box;
    if (!any && !t.revealed) continue;
    if (x < b.x - slack || x > b.x + b.w + slack || y < b.y - slack || y > b.y + b.h + slack) continue;
    if (!best || b.w * b.h < best.box.w * best.box.h) best = t;
  }
  return best;
}

/**
 * A tap on the photo with the UV light on, at a point (photo fractions): on a trace the light has found,
 * look at it; on one it hasn't yet, find it (the light is pointed there). Null: not on a trace, or no UV.
 */
export function tapTrace(traces: readonly StageTrace[], x: number, y: number, uv: boolean): { look: string } | { find: string } | null {
  if (!uv) return null;
  const t = traceAt(traces, x, y, 0.03, true);
  if (!t) return null;
  return t.revealed ? { look: t.id } : { find: t.id };
}

export function UvTrace({ traces, marks, genre, w, h, tx, ty, r, uv, lampLit, onTrace, onOpen }: UvTraceProps) {
  // Writing that has been read out is drawn as its words (below); before that, as a latent smear.
  // (The parent builds `traces` afresh each render: the drawing is kept by what it's drawn from.)
  const shape = traces.map((t) => `${t.id}:${t.kind}:${t.surface}:${t.seed}:${t.box.x},${t.box.y},${t.box.w},${t.box.h}:${t.mark ? 1 : 0}`).join("|");
  const paths = useMemo(
    () => new Map(traces.filter((t) => !t.mark).map((t) => [t.id, drawTrace(t, w, h, genre)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `shape` is what `traces` draws from.
    [shape, w, h, genre],
  );
  const drawn = traces.filter((t) => paths.has(t.id)).map((t) => ({ t, ...paths.get(t.id)! }));
  const beam = useDerivedValue(() => vec(tx.get() * w, ty.get() * h));

  // Which trace the UV beam is on: heard only when it changes.
  const boxes = traces.map((t) => [t.box.x, t.box.y, t.box.w, t.box.h] as const);
  const ids = traces.map((t) => t.id);
  const sx = w > 0 ? (UV.reach * r) / w : 0;
  const sy = h > 0 ? (UV.reach * r) / h : 0;
  const report = (i: number) => onTrace?.(i >= 0 ? ids[i] ?? null : null);
  useAnimatedReaction(
    () => {
      if (!uv) return -1;
      const x = tx.get(), y = ty.get();
      let hit = -1;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        if (x >= b[0] - sx && x <= b[0] + b[2] + sx && y >= b[1] - sy && y <= b[1] + b[3] + sy && (hit < 0 || b[2] * b[3] < boxes[hit][2] * boxes[hit][3])) hit = i;
      }
      return hit;
    },
    (cur, prev) => {
      if (cur !== prev) scheduleOnRN(report, cur);
    },
    [uv, boxes, ids, sx, sy],
  );

  if (w <= 0 || h <= 0) return null;
  return (
    <>
      {traces.length && uv ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" testID="v2-uv-traces">
          {/* Under UV: every trace, seen only through the beam. */}
          <Group layer={<Paint />}>
            {drawn.map((d) => <TraceShape key={d.t.id} {...d} />)}
            <Rect x={0} y={0} width={w} height={h} blendMode="dstIn">
              <RadialGradient c={beam} r={r} colors={[...UV.mask]} positions={[...UV.stops]} />
            </Rect>
          </Group>
        </Canvas>
      ) : null}
      {traces.filter((t) => t.mark).map((t) => (
        <Writing key={t.id} box={t.box} text={t.mark!} surface={t.surface} seed={t.seed} w={w} h={h} tx={tx} ty={ty} r={r} uv={uv} always={false} />
      ))}
      {marks.map((m) => (
        <Writing key={m.object} box={m.box} text={m.text} surface="on" seed={0} w={w} h={h} tx={tx} ty={ty} r={r} uv={uv} always={lampLit} big />
      ))}
      {onOpen
        ? traces.filter((t) => t.revealed).map((t) => (
          <View
            key={t.id}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t.label}
            onAccessibilityTap={() => onOpen(t.id)}
            testID={`v2-trace-${t.id}`}
            style={[styles.a11y, { left: t.box.x * w, top: t.box.y * h, width: t.box.w * w, height: t.box.h * h }]}
          />
        ))
        : null}
    </>
  );
}

/** One trace: a soft blot that bleeds into the surface, the glowing fill, and its lines in a cyan bloom. */
function TraceShape({ blot, fill, lines, line, bloom = 1 }: Drawn) {
  return (
    <Group>
      {blot ? (
        <Path path={blot} color={UV.blot} style="fill">
          <BlurMask blur={5} style="normal" />
        </Path>
      ) : null}
      {fill ? (
        <Path path={fill} color={UV.fill} style="fill">
          <BlurMask blur={1.2} style="normal" />
        </Path>
      ) : null}
      {lines ? (
        <>
          <Path path={lines} color={UV.halo} style="stroke" strokeWidth={line * (1 + 1.8 * bloom)} strokeJoin="round" strokeCap="round">
            <BlurMask blur={0.6 + 2 * bloom} style="normal" />
          </Path>
          <Path path={lines} color={UV.core} style="stroke" strokeWidth={line} strokeJoin="round" strokeCap="round" />
        </>
      ) : null}
    </Group>
  );
}

/** The writing's slant and the surface's lie: a wall slants it, a floor lays it back in perspective. */
function lie(surface: TraceSpec["surface"], seed: number): NonNullable<TextStyle["transform"]> {
  const tilt = -5 + (seed % 7);   // -5..1 degrees
  switch (surface) {
    case "floor": return [{ perspective: 320 }, { rotateX: "48deg" }, { rotate: `${tilt}deg` }];
    case "wall": return [{ rotate: `${tilt}deg` }, { skewX: "-10deg" }];
    case "on": return [{ rotate: `${tilt * 0.6}deg` }, { skewX: "-6deg" }];
  }
}

/**
 * Writing that glows: what a writing trace says once found (in a hurried hand, slanting, on its
 * surface), or a glow mark on an object (big, as someone wrote it there). Seen where the UV beam falls,
 * fading at its edge; it develops out of its smear the moment it is found.
 */
function Writing({ box, text, surface, seed, w, h, tx, ty, r, uv, always, big = false }: {
  box: Box; text: string; surface: TraceSpec["surface"]; seed: number; w: number; h: number; tx: SharedValue<number>; ty: SharedValue<number>; r: number;
  uv: boolean; always: boolean; big?: boolean;
}) {
  const theme = useModeTheme();
  const family = handType(theme).family;
  const cx = (box.x + box.w / 2) * w;
  const cy = (box.y + box.h / 2) * h;
  const fit = (box.w * w + 20) / Math.max(1, text.length * 0.44);
  const size = big
    ? Math.max(16, Math.min(44, Math.min(box.w * w, box.h * h) * 0.45))
    : Math.max(13, Math.min(34, box.h * h * 0.8, fit));
  const style = useAnimatedStyle(() => {
    if (always) return { opacity: 1 };
    if (!uv) return { opacity: 0 };
    const d = Math.hypot(tx.get() * w - cx, ty.get() * h - cy);
    return { opacity: Math.max(0, Math.min(1, 1.6 * (1 - d / r))) };
  });
  const type = { fontFamily: family, fontSize: size, lineHeight: Math.ceil(size * 1.2) };
  return (
    <Animated.View pointerEvents="none" style={[styles.ink, { left: box.x * w - 12, top: box.y * h - 6, width: box.w * w + 24, height: box.h * h + 12 }, style]}>
      <Animated.View entering={FadeIn.duration(700)} style={[styles.inkInner, { transform: big ? [{ rotate: "-6deg" }] : lie(surface, seed) }]}>
        {/* The bloom it bleeds into the surface, then the ink itself. */}
        <Text style={[type, big ? styles.markHalo : styles.halo]} numberOfLines={2} accessibilityLabel={`Written in invisible ink: ${text}`}>{text}</Text>
        <Text style={[type, big ? styles.mark : styles.core, styles.over]} numberOfLines={2} accessible={false}>{text}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Drawing: SVG path strings, from the trace's seed
// ---------------------------------------------------------------------------
function mulberry(seed: number): () => number {
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

/** A polyline kept only where `inside` holds, broken now and then (a ridge ending): its pieces as one path. */
function clipped(pts: Pt[], inside: (p: Pt) => boolean, rnd: () => number, breaks = 0.035): string {
  const out: string[] = [];
  let run: Pt[] = [];
  const flush = () => {
    if (run.length > 1) out.push(poly(run));
    run = [];
  };
  for (const p of pts) {
    if (!inside(p) || rnd() < breaks) flush();
    else run.push(p);
  }
  flush();
  return out.join(" ");
}

/**
 * One fingertip's print: its ridges, a whorl (a tight spiral round a core) or a loop (ridges that come in
 * from one side, turn round the core and go back), arches across its base, inside the fingertip's oval.
 */
function fingerprint(cx: number, cy: number, rx: number, rot: number, rnd: () => number): string {
  const ry = rx * 1.32;
  const c = Math.cos(rot), s = Math.sin(rot);
  const place = ([u, v]: Pt): Pt => [cx + u * c - v * s, cy + u * s + v * c];
  // Inside the fingertip (local coordinates), a little ragged at the edge where the pressure fell off.
  const inside = ([u, v]: Pt) => (u / rx) ** 2 + (v / ry) ** 2 <= 0.92 + (rnd() - 0.5) * 0.12;
  const n = Math.max(4, Math.min(9, Math.round(rx / 1.7)));
  const core: Pt = [(rnd() - 0.5) * rx * 0.2, -ry * (0.08 + rnd() * 0.1)];
  const ridges: string[] = [];
  const whorl = rnd() < 0.45;
  const lean = rnd() < 0.5 ? 1 : -1;
  for (let j = 1; j <= n + 2; j++) {
    const q = j / (n + 0.6);
    const pts: Pt[] = [];
    if (whorl) {
      // A spiral turn per ridge: the radius grows a ridge's width round the turn.
      const a0 = rnd() * Math.PI * 2;
      for (let i = 0; i <= 44; i++) {
        const a = a0 + (i / 44) * Math.PI * 2;
        const k = q + (i / 44) / (n + 0.6);
        pts.push([core[0] + Math.cos(a) * rx * k, core[1] + Math.sin(a) * ry * k * 0.92]);
      }
    } else {
      // A hairpin: up one side, round over the core, down the other, leaning to one side.
      const a = rx * q * 0.95, b = ry * q * 0.85;
      for (let i = 0; i <= 10; i++) pts.push([core[0] - a - lean * (1 - i / 10) * rx * 0.25, ry * 1.1 - (i / 10) * (ry * 1.1 - core[1])]);
      for (let i = 1; i <= 24; i++) {
        const t = Math.PI - (i / 24) * Math.PI;
        pts.push([core[0] + Math.cos(t) * a, core[1] - Math.sin(t) * b]);
      }
      for (let i = 1; i <= 10; i++) pts.push([core[0] + a - lean * (i / 10) * rx * 0.35, core[1] + (i / 10) * (ry * 1.1 - core[1])]);
    }
    ridges.push(clipped(pts.map((p) => p), (p) => inside(p), rnd));
  }
  // Arches across the base, under the pattern.
  for (let j = 0; j < 3; j++) {
    const base = ry * (0.5 + 0.17 * j);
    const pts: Pt[] = [];
    for (let i = 0; i <= 20; i++) {
      const u = -rx + (2 * rx * i) / 20;
      pts.push([u, base - ry * 0.16 * Math.sin((Math.PI * i) / 20)]);
    }
    ridges.push(clipped(pts, inside, rnd));
  }
  // Placed: each ridge's points, rotated onto the photo.
  return ridges.join(" ").replace(/([ML])(-?[\d.]+) (-?[\d.]+)/g, (_, cmd: string, u: string, v: string) => {
    const [x, y] = place([Number(u), Number(v)]);
    return `${cmd}${f1(x)} ${f1(y)}`;
  });
}

interface Drawn {
  /** A soft blot under it (a splash's wet, a palm's pressure, writing not yet read): blurred. */
  blot: string;
  fill: string;
  lines: string;
  /** The core line's width (points). */
  line: number;
  /** How far its cyan bloom spreads (1: a stroke's; less for fine ridges, which a wide bloom would fill in). */
  bloom?: number;
}

/** A trace's shapes in points, inside its box. */
export function drawTrace(t: Pick<StageTrace, "kind" | "surface" | "seed" | "box">, w: number, h: number, genre: Genre): Drawn {
  const rnd = mulberry(t.seed);
  const bx = t.box.x * w, by = t.box.y * h, bw = t.box.w * w, bh = t.box.h * h;
  switch (t.kind) {
    case "prints": {
      // Three or four fingertips pressed in an arc as a hand grips (the last one smaller and lower), and
      // sometimes the thumb below, each with its ridges over the faint glow of the skin's oils.
      const n = 3 + Math.floor(rnd() * 2);
      const rx = Math.min(bw * (n === 3 ? 0.17 : 0.14), bh * 0.27);
      const tilt = (rnd() - 0.5) * 0.4;
      const lines: string[] = [];
      const blots: string[] = [];
      const tip = (cx: number, cy: number, r: number, rot: number) => {
        lines.push(fingerprint(cx, cy, r, rot, rnd));
        blots.push(ellipse(cx, cy, r * 0.9, r * 1.2, rot, rnd, 0, 0, 0.1, 18));
      };
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const size = i === n - 1 && n === 4 ? 0.78 : 0.9 + rnd() * 0.2;
        const cx = bx + bw * (0.22 + 0.62 * u) + (rnd() - 0.5) * rx * 0.3;
        const cy = by + bh * (0.34 + 0.3 * (u - 0.4) ** 2) + (i === n - 1 ? bh * 0.08 : 0);
        tip(cx, cy, rx * size, (u - 0.5) * 0.45 + tilt);
      }
      if (rnd() < 0.6) tip(bx + bw * 0.12, by + bh * 0.74, rx * 1.15, -0.95 + tilt);
      return { blot: blots.join(" "), fill: "", lines: lines.join(" "), line: 0.7, bloom: 0.5 };
    }
    case "palm": {
      // A palm pressed flat: the pressure's blot, the creases across it, four spread fingers and a thumb
      // with ridged tips.
      const pcx = bx + bw * 0.52, pcy = by + bh * 0.7, prx = bw * 0.25, pry = bh * 0.19;
      const tilt = (rnd() - 0.5) * 0.3;
      const palm = ellipse(pcx, pcy, prx, pry, tilt, rnd, 0, 0, 0.12, 30);
      const fingers: string[] = [];
      const tips: string[] = [];
      const lengths = [0.25, 0.3, 0.28, 0.21];
      for (let i = 0; i < 4; i++) {
        const spread = (i - 1.5) * 0.16 + tilt;
        const len = bh * lengths[i] * (0.92 + rnd() * 0.16);
        const baseX = pcx + prx * (-0.72 + 0.48 * i), baseY = pcy - pry * (0.8 - Math.abs(i - 1.5) * 0.1);
        const dx = Math.sin(spread), dy = -Math.cos(spread);
        fingers.push(ellipse(baseX + dx * len * 0.5, baseY + dy * len * 0.5, bw * 0.05, len * 0.52, spread, rnd, 0, 0, 0.06, 22));
        tips.push(fingerprint(baseX + dx * len * 0.8, baseY + dy * len * 0.8, bw * 0.042, spread, rnd));
      }
      const ta = -1.05 + tilt;
      const tl = bh * 0.2;
      const tbx = pcx - prx * 0.85, tby = pcy - pry * 0.05;
      fingers.push(ellipse(tbx + Math.sin(ta) * tl * 0.5, tby - Math.cos(ta) * tl * 0.5, bw * 0.055, tl * 0.5, ta, rnd, 0, 0, 0.06, 20));
      tips.push(fingerprint(tbx + Math.sin(ta) * tl * 0.75, tby - Math.cos(ta) * tl * 0.75, bw * 0.045, ta, rnd));
      // (The tips' ridges are fine: the palm's bloom is kept tight.)
      // The palm's lines: heart, head and life.
      const crease = (q: number, bend: number, from: number, to: number) => poly(Array.from({ length: 11 }, (_, i) => {
        const x = pcx + prx * (from + ((to - from) * i) / 10);
        return [x, pcy - pry * 0.55 + pry * q + Math.sin(i * 0.6 + q * 5) * pry * 0.06 + (i - 5) ** 2 * pry * bend] as Pt;
      }));
      const life = poly(Array.from({ length: 10 }, (_, i) => {
        const a = -0.2 + (i / 9) * 1.5;
        return [pcx - prx * 0.5 + Math.cos(a) * prx * 0.35, pcy - pry * 0.3 + Math.sin(a) * pry * 0.95] as Pt;
      }));
      const lines = [crease(0.25, 0.012, -0.7, 0.75), crease(0.55, 0.006, -0.75, 0.45), life, ...tips].join(" ");
      return { blot: [palm, ...fingers].join(" "), fill: [palm, ...fingers].join(" "), lines, line: 0.8, bloom: 0.6 };
    }
    case "writing": {
      // Not yet read out: a latent smear where the words are, a word-shaped blur along one or two lines.
      const rows = bh > 34 ? 2 : 1;
      const blots: string[] = [];
      for (let row = 0; row < rows; row++) {
        const base = by + bh * ((row + 1) / (rows + 1));
        let x = bx + bw * 0.05;
        const end = bx + bw * (0.95 - rnd() * 0.2 * row);
        const ht = Math.min(bh / (rows + 1), 16) * 0.42;
        while (x < end - 8) {
          const len = Math.min(end - x, bw * (0.12 + rnd() * 0.2));
          blots.push(ellipse(x + len / 2, base - (x - bx) * 0.04, len / 2, ht, -0.06, rnd, 0, 0, 0.18, 22));
          x += len + ht * 1.4;
        }
      }
      return { blot: blots.join(" "), fill: "", lines: "", line: 1 };
    }
    case "stain": {
      // A splash dried where it landed: an uneven pool, spikes and satellite drops flung out the way it
      // was thrown (teardrops, their tails pointing back). Dried, so nothing runs: no drips, even on a wall.
      const cx = bx + bw * 0.45, cy = by + bh * 0.5;
      const R = Math.min(bw, bh) * 0.3;
      const k1 = rnd() * 6, k2 = rnd() * 6;
      const squash = t.surface === "floor" ? 0.6 : 1;
      const at = (a: number, d: number): Pt => [cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d * squash];
      const blob: Pt[] = Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2;
        return at(a, R * (1 + 0.2 * Math.sin(3 * a + k1) + 0.12 * Math.sin(7 * a + k2) + (rnd() - 0.5) * 0.08));
      });
      const pool = poly(blob, true);
      const fill: string[] = [pool];
      const lines: string[] = [pool];
      const dir = rnd() * Math.PI * 2;
      // Spikes off the pool's edge, thinning to a point.
      for (let i = 0; i < 7 + Math.floor(rnd() * 5); i++) {
        const a = dir + (rnd() - 0.5) * 2.6;
        const len = R * (0.35 + rnd() * 0.7);
        const half = 0.08 + rnd() * 0.06;
        fill.push(poly([at(a - half, R * 0.9), at(a, R + len), at(a + half, R * 0.9)], true));
      }
      // Satellite drops: teardrops pointing back at the pool.
      for (let i = 0; i < 8 + Math.floor(rnd() * 6); i++) {
        const a = dir + (rnd() - 0.5) * 2.4;
        const d = R * (1.6 + rnd() * 1.5);
        const dr = R * (0.05 + rnd() * 0.09);
        const [x, y] = at(a, d);
        const tail = dr * (2.5 + rnd() * 2);
        const ca2 = Math.cos(a), sa2 = Math.sin(a);
        // In the drop's own frame (u outward, v across): the bead's front half, then its tail.
        const put = (u: number, v: number): Pt => [x + (u * ca2 - v * sa2), y + (u * sa2 + v * ca2) * squash];
        const drop: Pt[] = [];
        for (let j = 0; j <= 12; j++) {
          const q = -Math.PI / 2 + (j / 12) * Math.PI;
          drop.push(put(Math.cos(q) * dr, Math.sin(q) * dr));
        }
        drop.push(put(-tail, 0));
        fill.push(poly(drop, true));
      }
      return { blot: pool, fill: fill.join(" "), lines: lines.join(" "), line: 0.9 };
    }
    case "footprints": {
      // A stride across the floor: shoe soles with their tread (bare feet in the paranormal), left and
      // right, laid out on the floor's plane, then flattened by its perspective (farther ones smaller).
      const bare = genre === "paranormal";
      const n = 4 + Math.floor(rnd() * 2);
      const ltr = rnd() < 0.5;
      const flatten = 0.58;
      const oy = by + bh / 2;
      const x0 = ltr ? bx + bw * 0.12 : bx + bw * 0.88, x1 = ltr ? bx + bw * 0.88 : bx + bw * 0.12;
      const y0 = oy + (bh * 0.36) / flatten, y1 = oy - (bh * 0.3) / flatten;
      // Perspective: the far end of the walk (up the photo) smaller.
      const toScreen = ([x, y]: Pt): Pt => {
        const depth = 1 - 0.22 * Math.max(0, Math.min(1, (y0 - y) / (y0 - y1)));
        const mx = bx + bw / 2;
        return [mx + (x - mx) * (0.9 + 0.1 * depth), oy + (y - oy) * flatten];
      };
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const L = Math.min(Math.hypot(x1 - x0, y1 - y0) / (n - 0.3), bw * 0.3);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const at = (px: number, py: number, u: number, v: number, turn: number): Pt => {
        const c = Math.cos(ang + turn), s2 = Math.sin(ang + turn);
        const ax = (u - 0.5) * L, ay = v * L;
        return toScreen([px + ax * c - ay * s2, py + ax * s2 + ay * c]);
      };
      const width = (u: number) => (bare ? 0.14 + 0.08 * Math.sin(Math.PI * Math.min(1, u * 1.05)) - (u < 0.55 && u > 0.3 ? 0.03 : 0) : u < 0.3 ? 0.13 : u < 0.5 ? 0.1 : 0.16 - (u - 0.75) ** 2 * 0.9);
      const lines: string[] = [];
      const fill: string[] = [];
      for (let i = 0; i < n; i++) {
        const k = (i + 0.4) / n;
        const side = i % 2 === 0 ? 1 : -1;
        const px = x0 + (x1 - x0) * k - sa * side * L * 0.2;
        const py = y0 + (y1 - y0) * k + ca * side * L * 0.2;
        const turn = side * 0.08 + (rnd() - 0.5) * 0.08;
        const outline = (from: number, to: number) => {
          const pts: Pt[] = [];
          const N = 16;
          for (let j = 0; j <= N; j++) { const u = from + ((to - from) * j) / N; pts.push(at(px, py, u, width(u) * side, turn)); }
          for (let j = N; j >= 0; j--) { const u = from + ((to - from) * j) / N; pts.push(at(px, py, u, -width(u) * side, turn)); }
          return poly(pts, true);
        };
        if (bare) {
          const sole = outline(0.02, 0.8);
          fill.push(sole);
          lines.push(sole);
          for (let t2 = 0; t2 < 5; t2++) {
            const v = (t2 - 2) * 0.075 * side - 0.01 * side;
            const u = 0.9 - Math.abs(t2 - 1) * 0.03 - (t2 > 2 ? 0.04 * (t2 - 2) : 0);
            const [tx2, ty2] = at(px, py, u, v, turn);
            const tr = L * (t2 === 0 ? 0.055 : 0.04);
            const toe = ellipse(tx2, ty2, tr, tr * flatten, 0, rnd, 0, 0, 0.1, 10);
            fill.push(toe);
            lines.push(toe);
          }
        } else {
          // A heel and a sole, each with its tread: chevrons across the sole, bars across the heel.
          const heel = outline(0.02, 0.28), sole = outline(0.36, 1);
          fill.push(heel, sole);
          lines.push(heel, sole);
          for (let u = 0.42; u < 0.95; u += 0.065) {
            const wv = width(u) * 0.72;
            const zig: Pt[] = [];
            for (let j = 0; j <= 6; j++) zig.push(at(px, py, u + (j % 2 ? 0.022 : -0.022), -wv + (2 * wv * j) / 6, turn));
            lines.push(poly(zig));
          }
          for (let u = 0.07; u < 0.25; u += 0.055) lines.push(poly([at(px, py, u, -0.095, turn), at(px, py, u, 0.095, turn)]));
        }
      }
      return { blot: "", fill: fill.join(" "), lines: lines.join(" "), line: 0.8 };
    }
  }
}

const styles = StyleSheet.create({
  a11y: { position: "absolute" },
  ink: { position: "absolute", alignItems: "center", justifyContent: "center" },
  inkInner: { alignItems: "center", justifyContent: "center" },
  over: { position: "absolute", left: 0, right: 0, top: 0 },
  // A hurried hand in invisible ink: the cyan bloom it bleeds, then the violet-white ink pressed into it.
  halo: {
    color: "rgba(150,110,255,0.55)", textAlign: "center",
    textShadowColor: "rgba(120,232,255,0.9)", textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 },
  },
  core: {
    color: "rgb(240,232,255)", textAlign: "center",
    textShadowColor: "rgba(190,150,255,0.95)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 },
  },
  markHalo: {
    color: "rgba(150,95,255,0.6)", fontWeight: "700", textAlign: "center",
    textShadowColor: "rgba(150,95,255,0.95)", textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 },
  },
  mark: { color: "rgb(214,186,255)", fontWeight: "700", textAlign: "center" },
});
