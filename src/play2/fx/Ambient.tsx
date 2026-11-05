// Life in the dark room, drawn into the Stage's canvas, all of it very faint
// and cheap (one clock, a few shapes): dust motes that show only where the
// torch falls; in noir, now and then a moth that drifts in to the beam,
// flutters round it and goes; in paranormal a faint wisp crossing the room; in
// crime scene a passing car's light sliding slowly across the walls. Nothing
// under reduced motion (the Stage leaves it out).
import { useEffect, useMemo, useState } from "react";
import { BlurMask, Group, LinearGradient, Path, RadialGradient, Rect, Skia, vec, type SkPath } from "@shopify/react-native-skia";
import { Easing, cancelAnimation, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import type { Genre } from "@/lib/puzzle-types";

export const AMBIENT = {
  /** One loop of the room's life (ms); every drift beats a whole number of times in it. */
  loopMs: 48_000,
  /** Dust: how many motes, their radii (points), how far they wander (points), how bright at most. */
  motes: 28,
  moteR: [0.9, 2.2] as const,
  wander: [14, 34] as const,
  moteAlpha: 0.7,
  /** The once-a-loop visitor's slot in the loop (start, end; shares of it). */
  moth: [0.1, 0.24] as const,
  wisp: [0.42, 0.53] as const,
  car: [0.64, 0.72] as const,
  /** A second car, the other way, later. */
  car2: [0.9, 0.97] as const,
} as const;

/**
 * Where in the loop a view starts: anywhere (so a turn never brings the moth straight in). In development a
 * playtest can pin it (globalThis.__escapdAmbientStart, 0..1) to see a visitor on cue.
 */
function startPhase(): number {
  const pinned = (globalThis as { __escapdAmbientStart?: unknown }).__escapdAmbientStart;
  return __DEV__ && typeof pinned === "number" ? pinned : Math.random();
}

/** How far through an event (0..1) a moment of the loop is, or -1 outside it. */
export function eventAt(phase: number, [from, to]: readonly [number, number]): number {
  "worklet";
  const p = ((phase % 1) + 1) % 1;
  return p >= from && p < to ? (p - from) / (to - from) : -1;
}

const smooth = (x: number) => {
  "worklet";
  const k = Math.max(0, Math.min(1, x));
  return k * k * (3 - 2 * k);
};

/** A steady random number in [0, 1) from an index. */
function rand(i: number, salt: number): number {
  let h = Math.imul(i + 1, 2654435761) ^ Math.imul(salt + 7, 40503);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface Mote { x: number; y: number; r: number; ax: number; ay: number; cx: number; cy: number; ph: number }

export function Ambient({ genre, tx, ty, w, h, r, uv }: {
  genre: Genre; tx: SharedValue<number>; ty: SharedValue<number>; w: number; h: number; r: number; uv: boolean;
}) {
  const clock = useSharedValue(0);
  // Each view starts somewhere in the loop: a turn never brings the moth straight in.
  const [offset] = useState(startPhase);
  useEffect(() => {
    clock.set(0);
    clock.set(withRepeat(withTiming(1, { duration: AMBIENT.loopMs, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(clock);
  }, [clock]);
  const phase = useDerivedValue(() => (clock.get() + offset) % 1);
  if (w <= 0 || h <= 0) return null;
  return (
    <Group>
      <Dust phase={phase} tx={tx} ty={ty} w={w} h={h} r={r} uv={uv} />
      {genre === "noir" ? <Moth phase={phase} tx={tx} ty={ty} w={w} h={h} r={r} /> : null}
      {genre === "paranormal" ? <Wisp phase={phase} w={w} h={h} /> : null}
    </Group>
  );
}

/**
 * The passing car (crime scene): a soft, slanted band of light sliding across
 * the room, punched out of the dark a little. Drawn inside the Stage's dark
 * layer (it lightens the dark, so it must sit with the beam).
 */
export function CarLight({ w, h }: { w: number; h: number }) {
  const clock = useSharedValue(0);
  const [offset] = useState(startPhase);
  useEffect(() => {
    clock.set(withRepeat(withTiming(1, { duration: AMBIENT.loopMs, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(clock);
  }, [clock]);
  const band = w * 0.42;
  const transform = useDerivedValue(() => {
    const phase = (clock.get() + offset) % 1;
    const a = eventAt(phase, AMBIENT.car);
    const b = eventAt(phase, AMBIENT.car2);
    const e = a >= 0 ? a : b >= 0 ? 1 - b : -1;
    const x = e < 0 ? -w * 3 : -band * 1.6 + e * (w + band * 3.2);
    return [{ translateX: x }, { skewX: -0.35 }];
  });
  const opacity = useDerivedValue(() => {
    const phase = (clock.get() + offset) % 1;
    const a = eventAt(phase, AMBIENT.car);
    const b = eventAt(phase, AMBIENT.car2);
    const e = a >= 0 ? a : b;
    if (e < 0) return 0;
    // In and out softly, with the faintest flutter (blinds, a hedge going by).
    const env = Math.sin(Math.PI * e);
    return env * (0.85 + 0.15 * Math.sin(e * 40)) * (b >= 0 ? 0.7 : 1);
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Rect x={0} y={0} width={band} height={h} blendMode="dstOut">
        <LinearGradient start={vec(0, 0)} end={vec(band, 0)} colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.26)", "rgba(0,0,0,0.2)", "rgba(0,0,0,0)"]} positions={[0, 0.3, 0.5, 0.7, 1]} />
      </Rect>
    </Group>
  );
}

/** Dust in the air: lit only where the beam falls, hot at its centre and gone at its edge. */
function Dust({ phase, tx, ty, w, h, r, uv }: {
  phase: SharedValue<number>; tx: SharedValue<number>; ty: SharedValue<number>; w: number; h: number; r: number; uv: boolean;
}) {
  const motes = useMemo<Mote[]>(() => Array.from({ length: AMBIENT.motes }, (_, i) => ({
    x: rand(i, 1) * w,
    y: rand(i, 2) * h,
    r: AMBIENT.moteR[0] + (AMBIENT.moteR[1] - AMBIENT.moteR[0]) * rand(i, 3) ** 2,
    ax: AMBIENT.wander[0] + (AMBIENT.wander[1] - AMBIENT.wander[0]) * rand(i, 4),
    ay: AMBIENT.wander[0] + (AMBIENT.wander[1] - AMBIENT.wander[0]) * rand(i, 5),
    cx: 1 + Math.floor(rand(i, 6) * 3),
    cy: 1 + Math.floor(rand(i, 7) * 3),
    ph: rand(i, 8),
  })), [w, h]);
  const path = useDerivedValue<SkPath>(() => {
    const t = phase.get();
    const b = Skia.PathBuilder.Make();
    const TAU = Math.PI * 2;
    for (const m of motes) {
      // A slow lazy float, and a slow sink that wraps (dust settles).
      const x = m.x + m.ax * Math.sin(TAU * (t * m.cx + m.ph));
      const y = (((m.y + m.ay * Math.cos(TAU * (t * m.cy + m.ph * 1.3)) + t * h * 0.25) % h) + h) % h;
      b.addCircle(x, y, m.r);
    }
    return b.build();
  });
  const c = useDerivedValue(() => vec(tx.get() * w, ty.get() * h));
  const rgb = uv ? "214,196,255" : "255,236,206";
  const a = AMBIENT.moteAlpha;
  return (
    <Path path={path} antiAlias>
      <RadialGradient c={c} r={r * 0.95} colors={[`rgba(${rgb},${a})`, `rgba(${rgb},${a * 0.8})`, `rgba(${rgb},${a * 0.25})`, `rgba(${rgb},0)`]} positions={[0, 0.4, 0.75, 1]} />
      <BlurMask blur={0.6} style="normal" />
    </Path>
  );
}

/**
 * A moth (noir): in from an edge toward the light, a flutter round it, and off
 * the other way. It follows the beam as it moves; seen mostly in the light.
 */
function Moth({ phase, tx, ty, w, h, r }: {
  phase: SharedValue<number>; tx: SharedValue<number>; ty: SharedValue<number>; w: number; h: number; r: number;
}) {
  // Which side it comes in from and how high, and where it leaves: its own each visit to the view.
  const [dice] = useState(() => [Math.random(), Math.random(), Math.random()]);
  const from = { x: dice[0] < 0.5 ? -20 : w + 20, y: h * (0.15 + dice[1] * 0.4) };
  const to = { x: from.x < 0 ? w + 30 : -30, y: h * (0.05 + dice[2] * 0.3) };
  const shape = useDerivedValue<SkPath>(() => {
    const e = eventAt(phase.get(), AMBIENT.moth);
    const b = Skia.PathBuilder.Make();
    if (e < 0) return b.build();
    const t = e * AMBIENT.loopMs * (AMBIENT.moth[1] - AMBIENT.moth[0]) / 1000;
    const bx = tx.get() * w, by = ty.get() * h;
    // Round the light: an uneven loop, a little above the beam's middle.
    const orbit = r * 0.32;
    const ox = bx + orbit * Math.cos(t * 2.3) + orbit * 0.4 * Math.sin(t * 5.1);
    const oy = by - r * 0.12 + orbit * 0.6 * Math.sin(t * 1.9) + orbit * 0.3 * Math.cos(t * 4.3);
    const into = smooth(e / 0.3), out = smooth((e - 0.72) / 0.28);
    const x = from.x + (ox - from.x) * into + (to.x - ox) * out + 6 * Math.sin(t * 7);
    const y = from.y + (oy - from.y) * into + (to.y - oy) * out + 5 * Math.cos(t * 6);
    // Wings: a quick, uneven flap.
    const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 22 + Math.sin(t * 3)));
    const span = 10.5, lift = 7.5 * flap;
    const heading = Math.atan2(y - by, x - bx) * 0.15;
    const c = Math.cos(heading), s = Math.sin(heading);
    const P = (px: number, py: number) => [x + px * c - py * s, y + px * s + py * c] as const;
    for (const side of [-1, 1]) {
      const tip = P(side * span * flap, -lift);
      const back = P(side * span * 0.8 * flap, lift * 0.5);
      const root = P(side * 1.1, 0);
      b.moveTo(...P(0, -1.2));
      b.quadTo(tip[0], tip[1], back[0], back[1]);
      b.quadTo(root[0], root[1] + 1.4, ...P(0, 1.6));
      b.close();
    }
    b.addOval(Skia.XYWHRect(x - 1.5, y - 4, 3, 8.4));
    return b.build();
  });
  const c = useDerivedValue(() => vec(tx.get() * w, ty.get() * h));
  return (
    <Path path={shape} antiAlias>
      {/* Dusky wings against the lit wall; just a faint pale shape out of the light. */}
      <RadialGradient c={c} r={r * 1.1} colors={["rgba(84,64,58,0.88)", "rgba(96,76,68,0.8)", "rgba(150,130,118,0.3)", "rgba(170,150,136,0.12)"]} positions={[0, 0.5, 0.85, 1]} />
    </Path>
  );
}

/** A wisp (paranormal): a faint glowing trail drifting across the room, rising and falling as it goes. */
function Wisp({ phase, w, h }: { phase: SharedValue<number>; w: number; h: number }) {
  const [dice] = useState(() => [Math.random(), Math.random()]);
  const lane = { y: h * (0.25 + dice[0] * 0.35), dir: dice[1] < 0.5 ? 1 : -1 };
  const trail = useDerivedValue<SkPath>(() => {
    const e = eventAt(phase.get(), AMBIENT.wisp);
    const b = Skia.PathBuilder.Make();
    if (e < 0) return b.build();
    for (let i = 0; i < 7; i++) {
      const k = e - i * 0.018;
      if (k < 0) continue;
      const x = lane.dir > 0 ? -40 + k * (w + 80) : w + 40 - k * (w + 80);
      const y = lane.y + Math.sin(k * Math.PI * 3) * h * 0.04;
      b.addCircle(x, y, 7 - i * 0.8);
    }
    return b.build();
  });
  const opacity = useDerivedValue(() => {
    const e = eventAt(phase.get(), AMBIENT.wisp);
    return e < 0 ? 0 : Math.sin(Math.PI * e) * 0.3;
  });
  return (
    <Group opacity={opacity}>
      <Path path={trail} color="rgba(159,242,216,0.9)" antiAlias>
        <BlurMask blur={6} style="normal" />
      </Path>
    </Group>
  );
}
