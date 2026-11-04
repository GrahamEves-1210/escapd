// The cat, sitting (assets/characters/cat_sit.png): on home's window sill,
// for the way out and case closed. It moves as the peeking cat does, at 12
// frames a second: it pops up with a squash and stretch and a burst of
// sparkles in the mode's sweet colour (`cheer` changes for another),
// breathes, and now and then gives a little happy hop. It likes being
// stroked as the peeking cat does (usePetting): a hand on it and it shuts its
// eyes (lids drawn over the art's) with a small flinch; rubbed, it leans into
// the hand, sways and purrs (a fine shiver, a soft beat in the hand, "prr");
// let go, its eyes open slowly with a content blink. Rough, quick taps and it
// pulls away from the hand for a while. Its art never changes, but its tail
// (cut out of the art, scripts/brand/cat_tail.py) bends and swishes almost
// all the time, drawn as a textured mesh along a moving centre line: lazy
// S-curve sweeps travelling up it, the base nearly still and the tip moving
// most and trailing, now and then a pause or a quick flick of the tip; fast
// and cross while it sulks, a slow content curl while it purrs. Under reduced
// motion it simply sits, its tail still (its eyes still shut for a hand, and
// the "prr" shows).
import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing, useAnimatedStyle, useDerivedValue, useFrameCallback, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from "react-native-reanimated";
import { Canvas, FilterMode, Group, ImageShader, MipmapMode, Vertices, useImage, vec, type SkPoint } from "@shopify/react-native-skia";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { Burst, PetLayer, Purr, pettingMotion, usePetting, useStopMotion } from "./PeekingCat";
import LINE from "../../assets/characters/cat_sit_tail.json";

/** The cat without its tail (cat_sit.png less its tail), and its tail alone, both the art's size. */
const ART = require("../../assets/characters/cat_sit_body.png") as number;
const TAIL_ART = require("../../assets/characters/cat_sit_tail.png") as number;
const ASPECT = 640 / 444;
/**
 * The tail (scripts/brand/cat_tail.py writes cat_sit_tail.json): its centre
 * line in the art's pixels, base (under the haunch) to just past the tip, as
 * points an equal arc apart, and the tail's reach to the left and right of the
 * line at each. The mesh is a strip of quads along it, the tail image mapped
 * on as it lies. `room`: the canvas it's drawn on reaches this far past the
 * art's right edge (shares of its width), for the tip's swing.
 */
export const TAIL = { ...LINE, segments: LINE.points.length - 1, room: 0.2 } as const;
/**
 * The swish, as bends along the tail (degrees over its whole length; each
 * segment turns its share more than the one before, so the line bends
 * smoothly): a wave of `wave` degrees, thinning to `base` of it at the base
 * and growing as s^`grow` toward the tip (s 0 at the base, 1 at the tip),
 * `lag` radians later at the tip than the base (it runs up the tail); a
 * content `curl` and a `flick`, both at the tip. Its moods: `speed` radians a
 * second (a lazy sweep about every 3.5 s), at `size` of the full swing, for
 * `ms` (plus up to `spread`); after a sweep it pauses with chance `pauses`.
 * Speed, size and curl ease to a new mood at `ease` a second. Flicks every
 * `flicks` ms (plus up to `flicksSpread`), quicker when it's cross. Positive
 * bends clockwise.
 */
export const SWISH = {
  wave: 45,
  base: 0.06,
  grow: 1.4,
  lag: 2.6,
  curl: 40,
  flick: 45,
  ease: 2.2,
  sweep: { speed: 1.8, size: 1, ms: 3500, spread: 5000 },
  pause: { speed: 0.12, size: 0.7, ms: 1100, spread: 1600 },
  pauses: 0.4,
  /** Rough handling: a quick, cross thrash. Purring: a slow, content curl. */
  cross: { speed: 6.5, size: 1.3, curl: 0 },
  content: { speed: 0.75, size: 0.5, curl: 1 },
  flicks: 4500,
  flicksSpread: 6000,
  crossFlicks: 700,
  /** On the body's 12 fps stop motion (true), or smooth. */
  stepped: false,
} as const;
const RADIANS = Math.PI / 180;
/** Frames a second for the stop motion (as PeekingCat's). */
const FPS = 12;
/** The art's eyes (fractions of it: centre, half width, half height), and the tilt of its head (degrees) for the lashes. */
const EYES = [
  { x: 0.3863, y: 0.3781, rx: 0.0698, ry: 0.0367, tilt: -24 },
  { x: 0.5833, y: 0.3016, rx: 0.0462, ry: 0.0461, tilt: -24 },
] as const;
/** The art's fur round its eyes. */
const FUR = "#0E0C0B";
/** Rough handling: it pulls away from a hand this long (ms). */
const ENOUGH_MS = 3000;

export function SittingCat({ width, delay = 0, cheer = 0, label = "The black cat" }: {
  /** On-screen width (points). */
  width: number;
  /** Before it pops up (ms). */
  delay?: number;
  /** Bump it for another happy pop and sparkles. */
  cheer?: number;
  label?: string;
}) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const height = width * ASPECT;
  const pop = useSharedValue(reducedMotion ? 1 : 0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const breath = useSharedValue(0);
  const [burst, setBurst] = useState<{ at: number; text: string } | null>(null);
  const [sulking, setSulking] = useState(false);

  // A pop: crouch, stretch up, land squashed, settle.
  const bounce = (wait: number) => {
    // Pose to pose, a few frames each (it's drawn at 12 fps).
    sy.set(withDelay(wait, withSequence(withTiming(0.93, { duration: 80 }), withTiming(1.07, { duration: 90 }), withTiming(0.98, { duration: 90 }), withTiming(1, { duration: 90 }))));
    sx.set(withDelay(wait, withSequence(withTiming(1.05, { duration: 80 }), withTiming(0.96, { duration: 90 }), withTiming(1.01, { duration: 90 }), withTiming(1, { duration: 90 }))));
  };

  // Stroked, it purrs; rough taps, and it pulls away a while (a hard flinch down).
  const petting = usePetting({
    width,
    reducedMotion,
    sulking,
    onRough: () => {
      setSulking(true);
      if (reducedMotion) return;
      sy.set(withSequence(withTiming(0.86, { duration: 90 }), withDelay(420, withSpring(1, { damping: 7, stiffness: 150 }))));
      sx.set(withSequence(withTiming(1.08, { duration: 90 }), withDelay(420, withSpring(1, { damping: 7, stiffness: 150 }))));
    },
  });
  const tail = useTailSwish({ still: reducedMotion, sulking, purring: petting.purring });
  useEffect(() => {
    if (!sulking) return;
    const t = setTimeout(() => setSulking(false), ENOUGH_MS);
    return () => clearTimeout(t);
  }, [sulking]);

  useEffect(() => {
    if (reducedMotion) return;
    pop.set(withDelay(delay, withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) })));
    bounce(delay);
    breath.set(withDelay(delay, withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }), -1, true)));
    const t = setTimeout(() => setBurst({ at: Date.now(), text: "!" }), delay + 150);
    // A happy hop now and then (not with a hand on it).
    let hop: ReturnType<typeof setTimeout>;
    const again = () => {
      if (petting.touch.get() < 0.1) bounce(0);
      hop = setTimeout(again, 5000 + Math.random() * 5000);
    };
    hop = setTimeout(again, delay + 4000);
    return () => {
      clearTimeout(t);
      clearTimeout(hop);
    };
    // bounce reads shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, delay]);

  useEffect(() => {
    if (!cheer || reducedMotion) return;
    bounce(0);
    const t = setTimeout(() => setBurst({ at: Date.now(), text: "!" }), 150);
    return () => clearTimeout(t);
    // bounce reads shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheer, reducedMotion]);

  const f = useStopMotion(
    [pop, sx, sy, breath, petting.poke, petting.lean, petting.purr, petting.clock, petting.touch],
    [reducedMotion ? 1 : 0, 1, 1, 0, 0, 0, 0, 0, 0],
  );
  const style = useAnimatedStyle(() => {
    const [p, x, y, b, poke, lean, purr, clock] = f.get();
    // A hand on it: the flinch, the lean, the purr (its paws stay put: it turns from the bottom).
    const m = pettingMotion(poke, lean, purr, clock, width, height);
    return {
      opacity: Math.min(1, p * 3),
      transform: [
        { translateY: (1 - p) * height * 0.25 + m.y * 0.4 },
        { translateX: m.x * 0.6 },
        { rotate: `${m.rotate * 0.6}deg` },
        { scaleX: x * m.sx * p * (1 - b * 0.012) },
        { scaleY: y * m.sy * p * (1 + b * 0.02) },
      ],
    };
  });

  const mark = { color: theme.sweet, fontFamily: theme.hand.fontFamily };
  return (
    <View style={{ width, height }} pointerEvents="box-none">
      <Animated.View style={[styles.cat, { width, height }, style]}>
        <Tail width={width} height={height} bends={tail} />
        <Image source={ART} style={{ width, height }} resizeMode="contain" />
        {EYES.map((eye, i) => <Lid key={i} eye={eye} width={width} height={height} f={f} />)}
        {/* Over it all, the hand's layer: stroke it (it purrs), or give it a rub from a screen reader. */}
        <PetLayer petting={petting} label={`${label}. Pet the cat`} testID="sitting-cat" />
      </Animated.View>
      {petting.purring ? (
        <View style={[styles.burst, { left: width * 0.62, top: height * 0.12 }]} pointerEvents="none">
          <Purr size={width * 0.9} style={mark} still={reducedMotion} />
        </View>
      ) : null}
      {burst !== null && !reducedMotion ? (
        <View style={[styles.burst, { left: width * 0.5, top: height * 0.12 }]} pointerEvents="none">
          <Burst key={burst.at} text={burst.text} size={width * 0.7} color={theme.sweet} glyph={mark} />
        </View>
      ) : null}
    </View>
  );
}

const N = TAIL.segments;
/** Each segment of the centre line as it lies (art pixels, base to tip). */
const STEPS = TAIL.points.slice(1).map((p, i) => [p[0] - TAIL.points[i][0], p[1] - TAIL.points[i][1]]);
/**
 * At each point, the way across the line to the strip's left and right edges
 * (the normal: its segments' mean direction turned a quarter, as cat_tail.py).
 */
const EDGES = TAIL.points.map((_, i) => {
  const [a, b] = [STEPS[Math.max(0, i - 1)], STEPS[Math.min(N - 1, i)]];
  const dx = a[0] / Math.hypot(a[0], a[1]) + b[0] / Math.hypot(b[0], b[1]);
  const dy = a[1] / Math.hypot(a[0], a[1]) + b[1] / Math.hypot(b[0], b[1]);
  const n = Math.hypot(dx, dy);
  const [nx, ny] = [-dy / n, dx / n];
  return { left: [nx * TAIL.left[i], ny * TAIL.left[i]], right: [-nx * TAIL.right[i], -ny * TAIL.right[i]] };
});
/** The strip's triangles: its vertices go left, right, left, right... from the base. */
const INDICES = STEPS.flatMap((_, i) => [2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2]);

/** How much each segment of the tail turns from the last (radians, base to tip). See SWISH. */
export function tailBends(phase: number, size: number, curl: number, flick: number): number[] {
  "worklet";
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    const s = (i + 0.5) / N;
    const wave = SWISH.wave * size * ((SWISH.base + s ** SWISH.grow) / (SWISH.base + 1 / (SWISH.grow + 1))) * Math.sin(phase - s * SWISH.lag);
    // Curl and flick, at the tip: growing as s cubed (whole over the length: their totals).
    const tip = 4 * s ** 3;
    out.push(((wave + (SWISH.curl * curl + SWISH.flick * flick) * tip) / N) * RADIANS);
  }
  return out;
}

/**
 * The strip's vertices (art pixels) for the given bends: the centre line rebuilt
 * from the base, each segment its own length turned by all the bends up to it,
 * and at each point its edges turned with it. No bends: the tail as it lies.
 */
export function bendTail(bends: number[]): SkPoint[] {
  "worklet";
  const out: SkPoint[] = [];
  let [x, y] = TAIL.points[0];
  let turn = 0;
  for (let i = 0; i <= N; i++) {
    const before = turn;
    if (i < N) turn += bends[i];
    // A point turns with the mean of its two segments.
    const o = i < N ? (before + turn) / 2 : before;
    const c = Math.cos(o);
    const s = Math.sin(o);
    const { left, right } = EDGES[i];
    out.push(vec(x + c * left[0] - s * left[1], y + s * left[0] + c * left[1]));
    out.push(vec(x + c * right[0] - s * right[1], y + s * right[0] + c * right[1]));
    if (i < N) {
      const [dx, dy] = STEPS[i];
      const ct = Math.cos(turn);
      const st = Math.sin(turn);
      x += ct * dx - st * dy;
      y += st * dx + ct * dy;
    }
  }
  return out;
}

type Mood = { speed: number; size: number; curl: number };

/**
 * The tail's swish: its segments' bends, on the UI thread. A wave runs up the
 * tail at the mood's speed (sweeps and pauses, picked here on a timer, or cross
 * or content for a hand), the speed, size and curl easing to each new mood so
 * it never jumps; flicks on top. Still (all 0) under reduced motion.
 */
function useTailSwish({ still, sulking, purring }: { still: boolean; sulking: boolean; purring: boolean }): SharedValue<number[]> {
  const angles = useSharedValue<number[]>(STEPS.map(() => 0));
  const phase = useSharedValue(0);
  const now = useSharedValue<Mood>({ ...SWISH.sweep, curl: 0 });
  const goal = useSharedValue<Mood>({ ...SWISH.sweep, curl: 0 });
  const flick = useSharedValue(0);
  const last = useSharedValue(-1);
  const frames = useFrameCallback((frame) => {
    "worklet";
    const dt = Math.min(0.1, (frame.timeSincePreviousFrame ?? 0) / 1000);
    const k = 1 - Math.exp(-dt * SWISH.ease);
    const m = now.get();
    const g = goal.get();
    const eased = { speed: m.speed + (g.speed - m.speed) * k, size: m.size + (g.size - m.size) * k, curl: m.curl + (g.curl - m.curl) * k };
    now.set(eased);
    phase.set(phase.get() + eased.speed * dt);
    if (SWISH.stepped) {
      const step = Math.floor(frame.timeSinceFirstFrame / (1000 / FPS));
      if (step === last.get()) return;
      last.set(step);
    }
    angles.set(tailBends(phase.get(), eased.size, eased.curl, flick.get()));
  }, false);

  useEffect(() => {
    frames.setActive(!still);
    if (still) angles.set(STEPS.map(() => 0));
    // frames and angles are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  useEffect(() => {
    if (still) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    // A flick of the tip: out, back past rest, settle.
    const flickOnce = () => {
      const way = Math.random() < 0.5 ? -1 : 1;
      flick.set(withSequence(
        withTiming(way, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(-way * 0.35, { duration: 200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 380, easing: Easing.inOut(Easing.quad) }),
      ));
    };
    const flicking = (every: number, spread: number) => {
      const again = () => {
        flickOnce();
        later(again, every + Math.random() * spread);
      };
      later(again, every + Math.random() * spread);
    };
    if (sulking) {
      goal.set({ ...SWISH.cross });
      flicking(SWISH.crossFlicks, SWISH.crossFlicks);
    } else if (purring) {
      goal.set({ ...SWISH.content });
    } else {
      // Sweeps, a little faster or slower each time, now and then a pause.
      const next = (pause: boolean) => {
        const m = pause ? SWISH.pause : SWISH.sweep;
        goal.set({ speed: m.speed * (0.75 + Math.random() * 0.5), size: m.size * (0.8 + Math.random() * 0.3), curl: 0 });
        later(() => next(!pause && Math.random() < SWISH.pauses), m.ms + Math.random() * m.spread);
      };
      next(false);
      flicking(SWISH.flicks, SWISH.flicksSpread);
    }
    return () => timers.forEach(clearTimeout);
    // goal and flick are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, sulking, purring]);
  return angles;
}

/**
 * The tail: its image laid on a strip of triangles along its centre line
 * (bent by `bends`), on a canvas over the art's box and a little past its right
 * edge, under the body (which covers its base).
 */
function Tail({ width, height, bends }: { width: number; height: number; bends: SharedValue<number[]> }) {
  const image = useImage(TAIL_ART);
  const textures = useMemo(() => bendTail(STEPS.map(() => 0)), []);
  const vertices = useDerivedValue(() => bendTail(bends.get()));
  return (
    <View style={[styles.tail, { width: width * (1 + TAIL.room), height }]} pointerEvents="none" testID="sitting-cat-tail">
      <Canvas style={StyleSheet.absoluteFill}>
        {image ? (
          <Group transform={[{ scale: width / TAIL.size[0] }]}>
            <Vertices vertices={vertices} textures={textures} indices={INDICES} mode="triangles">
              <ImageShader image={image} tx="decal" ty="decal" sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }} />
            </Vertices>
          </Group>
        ) : null}
      </Canvas>
    </View>
  );
}

/**
 * A lid over one of the art's eyes, shown only while they're shut for a hand:
 * fur closing from the top down over the eye, and a content curve of lashes
 * where the eye was.
 */
function Lid({ eye, width, height, f }: { eye: (typeof EYES)[number]; width: number; height: number; f: SharedValue<number[]> }) {
  const w = eye.rx * 2 * width * 1.3;
  const h = eye.ry * 2 * height * 1.45;
  const lid = useAnimatedStyle(() => {
    const shut = f.get()[8];
    return { opacity: shut > 0.02 ? 1 : 0, transform: [{ scaleY: shut }] };
  });
  const lash = useAnimatedStyle(() => ({ opacity: Math.max(0, (f.get()[8] - 0.7) / 0.3), transform: [{ rotate: `${eye.tilt}deg` }] }));
  return (
    <>
      <Animated.View style={[styles.lid, { left: eye.x * width - w / 2, top: eye.y * height - h / 2, width: w, height: h, borderRadius: Math.max(w, h) / 2 }, lid]} />
      <Animated.View
        style={[styles.lash, {
          left: eye.x * width - w * 0.36, top: eye.y * height - h * 0.12, width: w * 0.72, height: h * 0.34,
          borderBottomWidth: Math.max(1.5, width * 0.014), borderBottomLeftRadius: w * 0.4, borderBottomRightRadius: w * 0.4,
        }, lash]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  cat: { transformOrigin: "50% 100%" },
  tail: { position: "absolute", left: 0, top: 0 },
  burst: { position: "absolute", width: 0, height: 0, alignItems: "center" },
  // Scaled from its top edge, as a lid closes (over the eye's whole box, so it never needs the head's tilt).
  lid: { position: "absolute", backgroundColor: FUR, transformOrigin: "50% 0%" },
  lash: { position: "absolute", borderColor: "rgba(232, 170, 60, 0.8)" },
});
