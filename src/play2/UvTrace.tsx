// Traces on the photo that only ultraviolet shows (gameplay v2: UV evidence):
// fingerprints on a drawer front, a palm print on a wall, smudged writing, a
// dried splash, a line of footprints across the floor. Each is drawn
// procedurally from its seed (whorls, droplets, a stride), in faint violet and
// cyan, and only where the UV beam falls: the beam is the mask. Once the
// engine has revealed one (the UV flashlight held on it), it keeps a faint
// residue in ordinary light, so the magnifier can find it again.
//
// Also here: writing revealed on objects (glow marks), seen under the UV beam
// or plainly while a lamp is lit.
//
// The trace under the beam's centre is reported (`onTrace`) while the UV light
// is on, worked out on the UI thread: the player keeps the light on it a moment
// and the room hears it.
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BlurMask, Canvas, Group, Paint, Path, RadialGradient, Rect, vec } from "@shopify/react-native-skia";
import Animated, { useAnimatedReaction, useAnimatedStyle, useDerivedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Rect as Box, TraceKind, TraceSpec } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";

export interface StageTrace {
  id: string;
  label: string;
  kind: TraceKind;
  surface: TraceSpec["surface"];
  seed: number;
  box: Box;
  /** The UV light has found it (the engine said so): it keeps a faint residue, and can be looked at. */
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

/** The glow: a violet core and a cyan halo, the colours of things that fluoresce. */
const UV = {
  core: "rgba(222,204,255,0.92)",
  halo: "rgba(120,232,255,0.55)",
  fill: "rgba(170,140,255,0.2)",
  /** Seen without the UV light, once found. */
  residue: 0.13,
  /** The beam's mask: full in its middle, gone at its edge. */
  mask: ["rgba(0,0,0,1)", "rgba(0,0,0,0.9)", "rgba(0,0,0,0)"],
  stops: [0, 0.5, 1],
  /** The beam's centre counts as on a trace this far outside its box (photo fractions). */
  slack: 0.02,
} as const;

export function UvTrace({ traces, marks, genre, w, h, tx, ty, r, uv, lampLit, onTrace, onOpen }: UvTraceProps) {
  // Writing that has been read out is drawn as its words (below); before that, as a scrawl.
  // (The parent builds `traces` afresh each render: the drawing is kept by what it's drawn from.)
  const shape = traces.map((t) => `${t.id}:${t.kind}:${t.surface}:${t.seed}:${t.box.x},${t.box.y},${t.box.w},${t.box.h}:${t.mark ? 1 : 0}`).join("|");
  const paths = useMemo(
    () => new Map(traces.filter((t) => !t.mark).map((t) => [t.id, drawTrace(t, w, h, genre)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `shape` is what `traces` draws from.
    [shape, w, h, genre],
  );
  const drawn = traces.filter((t) => paths.has(t.id)).map((t) => ({ t, ...paths.get(t.id)! }));
  const beam = useDerivedValue(() => vec(tx.get() * w, ty.get() * h));

  // Which trace the UV beam's centre is on: heard only when it changes.
  const boxes = traces.map((t) => [t.box.x, t.box.y, t.box.w, t.box.h] as const);
  const ids = traces.map((t) => t.id);
  const report = (i: number) => onTrace?.(i >= 0 ? ids[i] ?? null : null);
  useAnimatedReaction(
    () => {
      if (!uv) return -1;
      const x = tx.get(), y = ty.get(), s = UV.slack;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        if (x >= b[0] - s && x <= b[0] + b[2] + s && y >= b[1] - s && y <= b[1] + b[3] + s) return i;
      }
      return -1;
    },
    (cur, prev) => {
      if (cur !== prev) scheduleOnRN(report, cur);
    },
    [uv, boxes, ids],
  );

  if (w <= 0 || h <= 0) return null;
  const residue = drawn.filter((d) => d.t.revealed);
  return (
    <>
      {traces.length ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" testID="v2-uv-traces">
          {/* Found ones, faintly, in ordinary light. */}
          {!uv && residue.length ? (
            <Group opacity={UV.residue}>
              {residue.map((d) => <TraceShape key={d.t.id} fill={d.fill} lines={d.lines} />)}
            </Group>
          ) : null}
          {/* Under UV: every trace, seen only through the beam. */}
          {uv ? (
            <Group layer={<Paint />}>
              {drawn.map((d) => <TraceShape key={d.t.id} fill={d.fill} lines={d.lines} />)}
              <Rect x={0} y={0} width={w} height={h} blendMode="dstIn">
                <RadialGradient c={beam} r={r} colors={[...UV.mask]} positions={[...UV.stops]} />
              </Rect>
            </Group>
          ) : null}
        </Canvas>
      ) : null}
      {traces.filter((t) => t.mark).map((t) => (
        <Writing key={t.id} box={t.box} text={t.mark!} w={w} h={h} tx={tx} ty={ty} r={r} uv={uv} always={false} residue={t.revealed} />
      ))}
      {marks.map((m) => (
        <Writing key={m.object} box={m.box} text={m.text} w={w} h={h} tx={tx} ty={ty} r={r} uv={uv} always={lampLit} big />
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

function TraceShape({ fill, lines }: { fill: string; lines: string }) {
  return (
    <Group>
      {fill ? <Path path={fill} color={UV.fill} style="fill" /> : null}
      {/* A soft cyan bloom, then the violet line itself. */}
      <Path path={lines} color={UV.halo} style="stroke" strokeWidth={3.6} strokeJoin="round" strokeCap="round">
        <BlurMask blur={3.5} style="normal" />
      </Path>
      <Path path={lines} color={UV.core} style="stroke" strokeWidth={1.3} strokeJoin="round" strokeCap="round" />
    </Group>
  );
}

/**
 * Writing that glows: what a writing trace says once found (smudged, slanting),
 * or a glow mark on an object (big, as someone wrote it there). Seen where the
 * UV beam falls, fading at its edge; a found trace keeps a faint residue.
 */
function Writing({ box, text, w, h, tx, ty, r, uv, always, residue = false, big = false }: {
  box: Box; text: string; w: number; h: number; tx: SharedValue<number>; ty: SharedValue<number>; r: number; uv: boolean; always: boolean;
  residue?: boolean; big?: boolean;
}) {
  const cx = (box.x + box.w / 2) * w;
  const cy = (box.y + box.h / 2) * h;
  const fit = (box.w * w) / Math.max(1, text.length * 0.56);
  const size = big
    ? Math.max(16, Math.min(44, Math.min(box.w * w, box.h * h) * 0.45))
    : Math.max(11, Math.min(30, box.h * h * 0.62, fit));
  const style = useAnimatedStyle(() => {
    if (always) return { opacity: 1 };
    if (!uv) return { opacity: residue ? UV.residue * 1.6 : 0 };
    const d = Math.hypot(tx.get() * w - cx, ty.get() * h - cy);
    return { opacity: Math.max(0, Math.min(1, 1.6 * (1 - d / r))) };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.ink, { left: box.x * w, top: box.y * h, width: box.w * w, height: box.h * h }, style]}>
      <Text
        style={[big ? styles.inkText : styles.scrawl, { fontSize: size, lineHeight: size * 1.15 }]}
        accessibilityLabel={`Written in invisible ink: ${text}`}
      >
        {text}
      </Text>
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

const f1 = (v: number) => v.toFixed(1);
/** A polyline through points, optionally closed. */
const poly = (pts: [number, number][], close = false) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${f1(x)} ${f1(y)}`).join(" ") + (close ? " Z" : "");

/** An ellipse (or an arc of one, with a gap), rotated, with a little wobble. */
function ellipse(cx: number, cy: number, rx: number, ry: number, rot: number, rnd: () => number, gap = 0, start = 0, wobble = 0.05, n = 26): string {
  const pts: [number, number][] = [];
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

/** One fingertip: broken concentric ridges round a core. */
function fingertip(cx: number, cy: number, rx: number, rot: number, rnd: () => number): string {
  const ry = rx * 1.35;
  const rings = 5 + Math.floor(rnd() * 3);
  const parts: string[] = [];
  for (let k = 1; k <= rings; k++) {
    const q = k / rings;
    parts.push(ellipse(cx, cy + ry * 0.12 * (1 - q), rx * q, ry * q, rot, rnd, 0.5 + rnd() * 1.1, rnd() * Math.PI * 2, 0.08, 18 + k * 3));
  }
  return parts.join(" ");
}

interface Drawn { fill: string; lines: string }

/** A trace's shapes in points, inside its box. */
export function drawTrace(t: Pick<StageTrace, "kind" | "surface" | "seed" | "box">, w: number, h: number, genre: Genre): Drawn {
  const rnd = mulberry(t.seed);
  const bx = t.box.x * w, by = t.box.y * h, bw = t.box.w * w, bh = t.box.h * h;
  switch (t.kind) {
    case "prints": {
      // Three or four fingertips pressed in an arc, and sometimes the thumb below.
      const n = 3 + Math.floor(rnd() * 2);
      const rx = Math.min(bw * 0.1, bh * 0.22);
      const lines: string[] = [];
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const cx = bx + bw * (0.2 + 0.6 * u) + (rnd() - 0.5) * rx * 0.4;
        const cy = by + bh * (0.32 + 0.22 * Math.abs(u - 0.5) * 2) + (rnd() - 0.5) * rx * 0.4;
        lines.push(fingertip(cx, cy, rx * (0.85 + rnd() * 0.3), (u - 0.5) * 0.5, rnd));
      }
      if (rnd() < 0.6) lines.push(fingertip(bx + bw * 0.12, by + bh * 0.78, rx * 1.15, -0.9, rnd));
      return { fill: "", lines: lines.join(" ") };
    }
    case "palm": {
      // A palm, four spread fingers and a thumb; ridges at the fingertips, creases across the palm.
      const pcx = bx + bw * 0.52, pcy = by + bh * 0.7, prx = bw * 0.25, pry = bh * 0.19;
      const tilt = (rnd() - 0.5) * 0.3;
      const palm = ellipse(pcx, pcy, prx, pry, tilt, rnd, 0, 0, 0.1, 30);
      const fingers: string[] = [];
      const tips: string[] = [];
      const lengths = [0.25, 0.3, 0.28, 0.21];
      for (let i = 0; i < 4; i++) {
        const spread = (i - 1.5) * 0.16 + tilt;
        const len = bh * lengths[i] * (0.92 + rnd() * 0.16);
        const baseX = pcx + prx * (-0.72 + 0.48 * i), baseY = pcy - pry * (0.8 - Math.abs(i - 1.5) * 0.1);
        const dx = Math.sin(spread), dy = -Math.cos(spread);
        const fx = baseX + dx * len * 0.5, fy = baseY + dy * len * 0.5;
        fingers.push(ellipse(fx, fy, bw * 0.05, len * 0.52, spread, rnd, 0, 0, 0.06, 22));
        tips.push(fingertip(baseX + dx * len * 0.82, baseY + dy * len * 0.82, bw * 0.032, spread, rnd));
      }
      // The thumb, out to one side.
      const ta = -1.05 + tilt;
      const tl = bh * 0.2;
      const tbx = pcx - prx * 0.85, tby = pcy - pry * 0.05;
      fingers.push(ellipse(tbx + Math.sin(ta) * tl * 0.5, tby - Math.cos(ta) * tl * 0.5, bw * 0.055, tl * 0.5, ta, rnd, 0, 0, 0.06, 20));
      const creases = [0.25, 0.6].map((q) => poly(Array.from({ length: 9 }, (_, i) => {
        const x = pcx - prx * 0.7 + (prx * 1.4 * i) / 8;
        return [x, pcy - pry * 0.55 + pry * q + Math.sin(i * 0.7 + q * 7) * pry * 0.1 + (i - 4) ** 2 * pry * 0.012] as [number, number];
      })));
      return { fill: [palm, ...fingers].join(" "), lines: [palm, ...fingers, ...tips, ...creases].join(" ") };
    }
    case "writing": {
      // Handwriting: looping cursive strokes along one or two lines, broken into words, smudged.
      const rows = bh > 34 ? 2 : 1;
      const lines: string[] = [];
      for (let row = 0; row < rows; row++) {
        const base = by + bh * ((row + 1) / (rows + 1)) + bh * 0.08;
        let x = bx + bw * 0.04;
        const end = bx + bw * (0.96 - rnd() * 0.15 * row);
        const amp = Math.min(bh / (rows + 1), 14) * 0.55;
        while (x < end - 6) {
          const len = Math.min(end - x, bw * (0.15 + rnd() * 0.22));
          const loops = Math.max(2, Math.round(len / (amp * 0.9)));
          const pts: [number, number][] = [];
          const steps = loops * 10;
          // A trochoid: each turn a looped letter, some tall, some dipping below the line.
          const heights = Array.from({ length: loops }, () => (rnd() < 0.25 ? 1.6 : rnd() < 0.15 ? -0.9 : 0.7 + rnd() * 0.4));
          for (let i = 0; i <= steps; i++) {
            const t2 = i / steps;
            const a = t2 * loops * Math.PI * 2;
            const hgt = amp * heights[Math.min(loops - 1, Math.floor(t2 * loops))];
            pts.push([x + t2 * len - Math.sin(a) * amp * 0.5, base - (1 - Math.cos(a)) * hgt * 0.5 - t2 * amp * 0.2]);
          }
          lines.push(poly(pts));
          x += len + amp * (0.6 + rnd() * 0.6);
        }
      }
      return { fill: "", lines: lines.join(" ") };
    }
    case "stain": {
      // A dried splash: an uneven blob with a darker rim, droplets flung out, drips running down a wall.
      const cx = bx + bw * 0.45, cy = by + bh * (t.surface === "wall" ? 0.35 : 0.5);
      const R = Math.min(bw, bh) * 0.34;
      const k1 = rnd() * 6, k2 = rnd() * 6;
      const squash = t.surface === "floor" ? 0.62 : 1;
      const blob: [number, number][] = Array.from({ length: 44 }, (_, i) => {
        const a = (i / 44) * Math.PI * 2;
        const rr = R * (1 + 0.18 * Math.sin(3 * a + k1) + 0.1 * Math.sin(7 * a + k2) + (rnd() - 0.5) * 0.06);
        return [cx + Math.cos(a) * rr * 1.35, cy + Math.sin(a) * rr * squash];
      });
      const parts = [poly(blob, true)];
      const drops: string[] = [];
      const dir = rnd() * Math.PI * 2;
      for (let i = 0; i < 7 + Math.floor(rnd() * 5); i++) {
        const a = dir + (rnd() - 0.5) * 2.2;
        const d = R * (1.5 + rnd() * 1.3);
        const dr = R * (0.05 + rnd() * 0.1);
        drops.push(ellipse(cx + Math.cos(a) * d * 1.35, cy + Math.sin(a) * d * squash, dr, dr * squash, 0, rnd, 0, 0, 0.1, 10));
      }
      if (t.surface === "wall") {
        for (let i = 0; i < 2 + Math.floor(rnd() * 2); i++) {
          const x = cx + (rnd() - 0.5) * R * 1.8;
          const len = bh * (0.3 + rnd() * 0.3);
          drops.push(poly([[x, cy + R * 0.6], [x + (rnd() - 0.5) * 2, cy + R * 0.6 + len]]));
          drops.push(ellipse(x, cy + R * 0.6 + len + 2, 2.2, 3, 0, rnd, 0, 0, 0.1, 8));
        }
      }
      return { fill: [...parts, ...drops].join(" "), lines: [...parts, ...drops].join(" ") };
    }
    case "footprints": {
      // A stride across the floor: shoe soles (or bare feet) alternating left and right, laid out on the
      // floor's plane, then flattened by its perspective.
      const bare = genre === "paranormal";
      const n = 4 + Math.floor(rnd() * 2);
      const ltr = rnd() < 0.5;
      const flatten = 0.6;
      const oy = by + bh / 2;
      const toScreen = ([x, y]: [number, number]): [number, number] => [x, oy + (y - oy) * flatten];
      // The walk, in plane coordinates: from one lower corner towards the far upper one.
      const x0 = ltr ? bx + bw * 0.12 : bx + bw * 0.88, x1 = ltr ? bx + bw * 0.88 : bx + bw * 0.12;
      const y0 = oy + (bh * 0.36) / flatten, y1 = oy - (bh * 0.3) / flatten;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const L = Math.min(Math.hypot(x1 - x0, y1 - y0) / (n - 0.3), bw * 0.3);   // one foot's length
      const ca = Math.cos(ang), sa = Math.sin(ang);
      // A point `u` along the foot (0 heel, 1 toe) and `v` across it, for a foot centred at (px, py).
      const at = (px: number, py: number, u: number, v: number, turn: number): [number, number] => {
        const c = Math.cos(ang + turn), s2 = Math.sin(ang + turn);
        const ax = (u - 0.5) * L, ay = v * L;
        return toScreen([px + ax * c - ay * s2, py + ax * s2 + ay * c]);
      };
      // Half-width along the foot: heel, waist, ball.
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
          const pts: [number, number][] = [];
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
          // A heel, then the sole, with tread bars across it.
          lines.push(outline(0.02, 0.28), outline(0.36, 1));
          for (let u = 0.45; u < 0.95; u += 0.09) lines.push(poly([at(px, py, u, -width(u) * 0.7, turn), at(px, py, u, width(u) * 0.7, turn)]));
          for (let u = 0.07; u < 0.25; u += 0.08) lines.push(poly([at(px, py, u, -0.09, turn), at(px, py, u, 0.09, turn)]));
        }
      }
      return { fill: fill.join(" "), lines: lines.join(" ") };
    }
  }
}

const styles = StyleSheet.create({
  a11y: { position: "absolute" },
  ink: { position: "absolute", alignItems: "center", justifyContent: "center" },
  inkText: {
    color: "rgb(205,170,255)", fontWeight: "700", textAlign: "center", transform: [{ rotate: "-6deg" }],
    textShadowColor: "rgba(150,95,255,0.95)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 },
  },
  // Smudged writing on a wall: thinner, slanting, a cyan bloom.
  scrawl: {
    color: "rgb(222,204,255)", fontWeight: "600", fontStyle: "italic", textAlign: "center", letterSpacing: 1,
    transform: [{ rotate: "-4deg" }, { skewX: "-8deg" }],
    textShadowColor: "rgba(120,232,255,0.85)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 },
  },
});
