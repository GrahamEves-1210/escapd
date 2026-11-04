// A little celebration at something on the photo: tiny inky things pop out of
// it and drift (noir: little stars, a heart or two and a curl of smoke; crime
// scene: evidence markers and magnifier glints; paranormal: wisps and moons),
// and a handwritten word stamps on and fades ("Oh!" for a find; "Aha!" in a
// stamp's frame for a solved step, bigger). On a roll it grows: more of them, a
// warmer glow behind, and a row of little sparkles under the word, one per
// find. Drawn at (x, y) in its parent's points; it plays once and is removed by
// whoever mounted it. Reduced motion: the word fades in and out, nothing moves.
import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Canvas, Circle, Group, Path, RadialGradient, Skia, vec, type SkPath } from "@shopify/react-native-skia";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming, type SharedValue } from "react-native-reanimated";
import { SparkleIcon } from "phosphor-react-native";
import type { Genre } from "@/lib/puzzle-types";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import type { Strength } from "./celebrate";

export interface BurstProps {
  x: number;
  y: number;
  genre: Genre;
  strength: Strength;
  word: string;
  /** The roll's level (0: not on a roll) and how many finds it holds. */
  level: number;
  count: number;
  /** A seed for where the bits fly (each burst its own). */
  seed: number;
}

/** The look and timing of a burst, by strength. */
export const BURST = {
  find: { ms: 1250, bits: 7, reach: 44, size: 7, word: 24, wordAt: 0 },
  solve: { ms: 1650, bits: 11, reach: 64, size: 9, word: 30, wordAt: 90 },
  /** Per level of a roll: more bits, a little further, a little bigger. */
  perLevel: { bits: 2, reach: 8, size: 0.8, word: 2 },
  /** The word stamps down over this long, from this much bigger. */
  stampMs: 130,
  stampFrom: 1.55,
  /** The word sits this far above the burst's centre (points). */
  wordLift: 30,
} as const;

type Kind = "star" | "star5" | "heart" | "smoke" | "marker" | "glint" | "wisp" | "moon";

/** What each mode throws, in order of how often (the first most). */
const MIX: Record<Genre, readonly Kind[]> = {
  noir: ["star5", "star", "star5", "heart", "star", "smoke"],
  crime_scene: ["marker", "glint", "star", "marker", "glint", "star"],
  paranormal: ["wisp", "moon", "star", "wisp", "star", "moon"],
};

/** A #RRGGBB at an opacity. */
function alpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})` : hex;
}

/** A steady random number in [0, 1) from a seed and an index. */
function rand(seed: number, i: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(i + 1, 40503);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A five-point star (unit radius 10), slightly soft, as if inked. */
function star5(): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 4.4 : 10;
    pts.push(`${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/** Each kind's shape, about 20 across, centred on 0. */
const SHAPES: Record<Kind, string> = {
  star: "M0 -10 Q1.7 -1.7 10 0 Q1.7 1.7 0 10 Q-1.7 1.7 -10 0 Q-1.7 -1.7 0 -10 Z",
  star5: star5(),
  heart: "M0 8.5 C-8 3.5 -10.5 -2 -7.6 -6 C-5.2 -9.2 -1.6 -8 0 -4.8 C1.6 -8 5.2 -9.2 7.6 -6 C10.5 -2 8 3.5 0 8.5 Z",
  smoke: "M0 10 C-7 6 6 2 0 -2 C-5 -5 1 -10 5 -8",
  marker: "M-6.5 8 L-3 -8 L3 -8 L6.5 8 Z",
  glint: "M0 -12 Q0.9 -0.9 12 0 Q0.9 0.9 0 12 Q-0.9 0.9 -12 0 Q-0.9 -0.9 0 -12 Z",
  wisp: "M1 -9 C6 -8 7 -2 4 2 C1.5 5.5 -3 6 -7 10 C-5 6 -7.5 2.5 -6 -1.5 C-4.5 -6 -2.5 -9 1 -9 Z",
  moon: "M3 -9.5 A10 10 0 1 0 3 9.5 A7.6 7.6 0 1 1 3 -9.5 Z",
};
/** The band across an evidence marker (its number's place). */
const MARKER_BAND = "M-4.6 0.5 L4.6 0.5 L5.2 3.6 L-5.2 3.6 Z";

const paths = new Map<string, SkPath | null>();
function shape(d: string): SkPath | null {
  if (!paths.has(d)) paths.set(d, Skia.Path.MakeFromSVGString(d));
  return paths.get(d) ?? null;
}

interface Bit { kind: Kind; angle: number; reach: number; size: number; spin: number; delay: number; sway: number; color: string }

/** Where a burst's bits fly: fanned all round, a little upward, each its own size and spin. */
export function bitsFor(genre: Genre, strength: Strength, level: number, seed: number, colors: Record<Kind, string>): Bit[] {
  const b = BURST[strength];
  const n = b.bits + level * BURST.perLevel.bits;
  const reach = b.reach + level * BURST.perLevel.reach;
  const size = b.size + level * BURST.perLevel.size;
  const mix = MIX[genre];
  const out: Bit[] = [];
  const start = rand(seed, 0) * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const R = (k: number) => rand(seed, 10 + i * 8 + k);
    const kind = mix[Math.floor(R(0) * mix.length)];
    // Smoke and wisps rise rather than fly: a short way, mostly up.
    const rises = kind === "smoke" || kind === "wisp";
    const angle = rises ? -Math.PI / 2 + (R(1) - 0.5) * 1.4 : start + (i / n) * Math.PI * 2 + (R(1) - 0.5) * 0.7;
    out.push({
      kind,
      angle,
      reach: reach * (rises ? 0.55 + 0.3 * R(2) : 0.6 + 0.45 * R(2)),
      size: size * (kind === "glint" ? 1.1 : rises ? 1.15 : 0.75 + 0.5 * R(3)),
      spin: rises ? (R(4) - 0.5) * 30 : (R(4) - 0.5) * 220,
      delay: R(5) * 0.12,
      sway: (R(6) - 0.5) * 10,
      color: colors[kind],
    });
  }
  return out;
}

export function Burst({ x, y, genre, strength, word, level, count, seed }: BurstProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const b = BURST[strength];
  const ms = b.ms + level * 120;
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: ms, easing: Easing.linear }));
  }, [t, ms]);

  const ink = "rgba(24,14,28,0.85)";
  const colors: Record<Kind, string> = {
    star: theme.glow,
    star5: theme.foil,
    heart: theme.sweet,
    smoke: "rgba(236,226,232,0.75)",
    marker: theme.detail ?? theme.sweet,
    glint: "#FFFDF6",
    wisp: theme.glow,
    moon: theme.sweet,
  };
  const bits = useMemo(() => bitsFor(genre, strength, level, seed, colors),
    // The colours follow the mode, which a burst never changes mid-play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [genre, strength, level, seed]);
  const reach = b.reach + level * BURST.perLevel.reach;
  const S = Math.ceil(2 * (reach + 30));
  const c = S / 2;

  // The glow behind: a soft flash, warmer on a roll.
  const halo = useDerivedValue(() => {
    const p = t.get();
    return (p < 0.1 ? p / 0.1 : Math.max(0, 1 - (p - 0.1) / 0.5)) * (0.55 + 0.15 * level);
  });

  const fontSize = b.word + level * BURST.perLevel.word;
  const stamped = strength === "solve";
  const wordStyle = useAnimatedStyle(() => {
    const at = b.wordAt / ms;
    const p = t.get();
    const local = Math.max(0, p - at);
    const down = Math.min(1, (local * ms) / BURST.stampMs);
    const fadeFrom = 0.72;
    const opacity = p < at ? 0 : p > fadeFrom ? Math.max(0, (1 - p) / (1 - fadeFrom)) : Math.min(1, down * 2.2);
    if (reducedMotion) return { opacity };
    // Down hard, a hair past, and back: a rubber stamp's landing.
    const ease = 1 - (1 - down) * (1 - down);
    const scale = down < 1 ? BURST.stampFrom - (BURST.stampFrom - 0.96) * ease : 0.96 + 0.04 * Math.min(1, (local * ms - BURST.stampMs) / 90);
    return { opacity, transform: [{ translateY: -p * 8 }, { scale }] };
  });
  // Tilted a little, each burst its own way.
  const tilt = (rand(seed, 3) < 0.5 ? -1 : 1) * (3 + 5 * rand(seed, 4));

  return (
    <View pointerEvents="none" style={[styles.root, { left: x, top: y }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="v2-burst">
      {reducedMotion ? null : (
        <Canvas style={{ position: "absolute", left: -c, top: -c, width: S, height: S }}>
          <Group opacity={halo}>
            <Circle cx={c} cy={c} r={reach * 0.9}>
              <RadialGradient c={vec(c, c)} r={reach * 0.9} colors={[alpha(theme.glow, 0.4), alpha(theme.glow, 0.13), alpha(theme.glow, 0)]} positions={[0, 0.45, 1]} />
            </Circle>
          </Group>
          {bits.map((bit, i) => <BitView key={i} bit={bit} t={t} c={c} ink={ink} />)}
        </Canvas>
      )}
      <Animated.View style={[styles.word, { top: -BURST.wordLift - fontSize }, wordStyle]}>
        <View style={[stamped && styles.stamp, stamped && { borderColor: theme.stamp }, { transform: [{ rotate: `${tilt}deg` }] }]} testID="v2-burst-word">
          <Text
            allowFontScaling={false}
            style={[styles.text, {
              fontFamily: theme.hand.fontFamily, fontSize, lineHeight: Math.round(fontSize * 1.25),
              color: stamped ? theme.stamp : theme.sweet, textShadowColor: theme.ground,
            }]}
          >
            {word}
          </Text>
        </View>
        {level > 0 ? <Roll count={count} t={t} color={theme.foil} still={reducedMotion} /> : null}
      </Animated.View>
    </View>
  );
}

/** One bit: out from the middle on its angle, spinning, popping big then easing small, fading over its last half. */
function BitView({ bit, t, c, ink }: { bit: Bit; t: SharedValue<number>; c: number; ink: string }) {
  const d = SHAPES[bit.kind];
  const path = shape(d);
  const band = bit.kind === "marker" ? shape(MARKER_BAND) : null;
  const k = bit.size / 10;
  const rises = bit.kind === "smoke" || bit.kind === "wisp";
  const transform = useDerivedValue(() => {
    const p = Math.max(0, Math.min(1, (t.get() - bit.delay) / (1 - bit.delay)));
    const out = 1 - Math.pow(1 - p, 3);
    const r = bit.reach * (rises ? p : out);
    const px = c + Math.cos(bit.angle) * r + Math.sin(p * Math.PI * 1.5) * bit.sway * (rises ? 1 : 0.4);
    // Everything floats up a little as it goes, like warm air.
    const py = c + Math.sin(bit.angle) * r - p * p * 14;
    const pop = p < 0.14 ? (p / 0.14) * 1.18 : 1.18 - Math.min(1, (p - 0.14) / 0.2) * 0.18;
    const s = k * pop * (rises ? 0.7 + 0.5 * p : 1 - 0.35 * p);
    return [{ translateX: px }, { translateY: py }, { rotate: (bit.spin * p * Math.PI) / 180 }, { scale: s }];
  });
  const opacity = useDerivedValue(() => {
    const p = Math.max(0, (t.get() - bit.delay) / (1 - bit.delay));
    if (p <= 0) return 0;
    return p < 0.5 ? 1 : Math.max(0, 1 - (p - 0.5) / 0.5) * (rises ? 0.85 : 1);
  });
  if (!path) return null;
  return (
    <Group transform={transform} opacity={opacity}>
      {bit.kind === "smoke" ? (
        <Path path={path} color={bit.color} style="stroke" strokeWidth={2.2} strokeCap="round" />
      ) : (
        <>
          <Path path={path} color={bit.color} />
          {band ? <Path path={band} color={ink} /> : null}
          {/* The ink line round it, as if drawn with the cat's pen. */}
          <Path path={path} color={ink} style="stroke" strokeWidth={1.3} strokeJoin="round" />
        </>
      )}
    </Group>
  );
}

/** A roll's flourish: a row of little sparkles under the word, one per find (up to six), popping in one after another. */
function Roll({ count, t, color, still }: { count: number; t: SharedValue<number>; color: string; still: boolean }) {
  const n = Math.min(6, count);
  return (
    <View style={styles.roll}>
      {Array.from({ length: n }, (_, i) => <RollStar key={i} i={i} n={n} t={t} color={color} still={still} />)}
    </View>
  );
}

function RollStar({ i, n, t, color, still }: { i: number; n: number; t: SharedValue<number>; color: string; still: boolean }) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 1 };
    const p = Math.max(0, Math.min(1, (t.get() - 0.08 - i * 0.045) / 0.12));
    // The newest one (the last) lands a touch bigger.
    const big = i === n - 1 ? 1.35 : 1;
    return { opacity: p, transform: [{ scale: (p < 1 ? p * 1.3 : 1) * big }] };
  });
  return (
    <Animated.View style={style}>
      <SparkleIcon size={11} weight="fill" color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", width: 0, height: 0, overflow: "visible", zIndex: 30 },
  word: { position: "absolute", left: -120, width: 240, alignItems: "center", gap: 2 },
  stamp: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 8, paddingTop: 0, paddingBottom: 1 },
  text: { textAlign: "center", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  roll: { flexDirection: "row", gap: 3, alignItems: "center", justifyContent: "center" },
});
