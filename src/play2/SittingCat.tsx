// The cat, sitting (assets/characters/cat_sit.png): on home's window sill,
// for the way out and case closed. It moves as the peeking cat does, at 12
// frames a second: it pops up with a squash and stretch and a burst of
// sparkles in the mode's sweet colour (`cheer` changes for another),
// breathes, and now and then gives a little happy hop. It likes being
// stroked as the peeking cat does (usePetting): a hand on it and it shuts its
// eyes (lids drawn over the art's, in each eye's own frame) with a small
// flinch; rubbed, it leans into the hand, sways and purrs (a fine shiver, a
// soft beat in the hand, "prr"); let go, its eyes open slowly with a content
// blink (a gentle rub: a happy slow blink, and a few sparkles). Rough, quick
// taps and it pulls away from the hand for a while. It wears its outfit
// (catAccessory.ts: a bow, a bell collar, a beret, flowers). Its
// art never changes, but its tail (cut out of the art,
// scripts/brand/cat_tail.py) moves all the time, smoothly, drawn as a
// textured mesh along a moving centre line bent by a chain of springs (WHIP):
// lazy swishes that sweep out and back, each running up the tail so the tip
// trails, swings past and snaps back; now and then a flick that whips up to
// the tip, a twitch of just the tip, or a rest curled into a question mark;
// fast and cross while it sulks, a slow curled sway while it purrs. Under reduced
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
import { Burst, EyeLid, OUTFIT_WORDS, PetLayer, Purr, pettingMotion, usePetting, useStopMotion } from "./PeekingCat";
import { CatOutfit, type Placements } from "./cat/Accessory";
import { useCatAccessory } from "./catAccessory";
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
 * on as it lies. `pad`: the canvas it's drawn on reaches this far past the
 * art's box on each side (shares of its width), so the tip never clips at the
 * far end of a swish or a whip (the tests run it a long while to check).
 */
export const TAIL = { ...LINE, segments: LINE.points.length - 1, pad: { left: 0.02, top: 0.04, right: 0.32, bottom: 0.04 } } as const;
/**
 * The tail moves as a real one does: a chain of `joints` along it (s 0 at the
 * base, 1 at the tip), each a damped spring (`omega` rad/s, damping `zeta`)
 * following the one below it, so whatever the base does runs up the tail late,
 * and the tip, lightest and loosest, swings past where it's going and snaps
 * back (a whip). Its muscles pull each joint to bend from the one below by a
 * share of a `sweep` (`swing` degrees at full: most of it low, where the tail
 * lifts off the floor; positive swings it out, away from the body) and of a
 * `curl` (`hook` degrees, at the tip: the question mark). The sweep and the
 * curl ease to their goals as critically damped springs, at a rate the mood
 * sets; a `twitch` of the tip alone is a quick ringing spring of its own
 * (`twitchOmega`, `twitchZeta`), kicked by `twitchKick` rad/s. Its moods
 * (picked on the UI thread, `stepTail`):
 *   - calm: lazy swishes from side to side (`swish`: out further than in), now
 *     and then a slow question-mark curl while it rests (`rest`), and a quick
 *     flick out and back that whips up to the tip (`flick`); a twitch of the
 *     tip every `twitches` s,
 *   - cross (rough handling): a fast thrash, flicking, the tip twitching,
 *   - content (purring): a slow, small sway, the tip curled.
 * The base, under the haunch, never moves (no seam); the floor part barely.
 */
export const WHIP = {
  joints: [0.22, 0.4, 0.58, 0.76, 0.9, 1],
  omega: [15, 12.5, 10.5, 9, 8, 7.5],
  zeta: [0.75, 0.5, 0.4, 0.33, 0.28, 0.25],
  swing: 52,
  sweep: [0.04, 0.42, 0.26, 0.14, 0.09, 0.05],
  hook: 42,
  curl: [0, 0, 0.04, 0.16, 0.34, 0.46],
  twitch: [0, 0, 0, 0, 0.35, 1],
  twitchOmega: 32,
  twitchZeta: 0.2,
  twitchKick: 14,
  /** Calm: a swish out to `out` (plus up to `outSpread`) or in to `in` (less up to `inSpread`), easing at `omega` (plus up to `omegaSpread`), for `s` s (plus up to `sSpread`). */
  swish: { out: 0.55, outSpread: 0.35, in: -0.35, inSpread: 0.3, omega: 4, omegaSpread: 2, s: 1.1, sSpread: 1.6, curl: 0.15 },
  /** A rest, now and then (`chance` of each move): nearly still, curled into a question mark, eased in slowly. */
  rest: { chance: 0.2, at: 0.12, atSpread: 0.18, omega: 2, s: 2.2, sSpread: 2.4, curl: 1 },
  /** A flick (`chance` of each move): out to `to` fast and back, the whip running up the tail. */
  flick: { chance: 0.16, to: 0.9, omega: 26, hold: 0.12, back: 9 },
  twitches: { calm: [2.5, 4], cross: [0.5, 0.8], content: [3.5, 4] },
  cross: { at: 0.4, atSpread: 0.2, omega: 13, omegaSpread: 5, s: 0.26, sSpread: 0.2, curl: -0.2 },
  content: { at: 0.22, atSpread: 0.12, omega: 1.5, s: 2.4, sSpread: 1.2, curl: 1 },
  /** How fast the curl eases to its goal (rad/s, critically damped). */
  curlOmega: 2.6,
  /** Integration step (s): small enough for the stiffest spring, whatever the frame rate. */
  step: 1 / 240,
} as const;
const RADIANS = Math.PI / 180;
/**
 * The art's eyes (its irises, measured: art px): centre, half width and half
 * height, and the tilt of the width (degrees, clockwise). The lids close in
 * each eye's own frame (EyeLid).
 */
const EYES = [
  { x: 170.1, y: 242.9, a: 30.5, b: 22.6, tilt: 9.2 },
  { x: 258.9, y: 193.3, a: 20.1, b: 29.9, tilt: 12.1 },
] as const;
/** The art's fur round its eyes. */
const FUR = "#0E0C0B";
/** Its outfit on its art (catAccessory), on its tipped head: a bow by its right ear, a collar, a beret or flowers between its ears. */
const OUTFIT: Placements = {
  bow: { x: 276, y: 112, w: 150, rotate: 22 },
  bell: { x: 206, y: 341, w: 170, rotate: -8 },
  beret: { x: 176, y: 150, w: 150, rotate: -22 },
  flowers: { x: 170, y: 160, w: 190, rotate: -22 },
};
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
  const outfit = useCatAccessory();
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
        {EYES.map((eye, i) => (
          <EyeLid
            key={i}
            eye={{ cx: eye.x * (width / TAIL.size[0]), cy: eye.y * (width / TAIL.size[0]), a: eye.a * (width / TAIL.size[0]), b: eye.b * (width / TAIL.size[0]), tilt: eye.tilt }}
            f={f}
            amount={touched}
            fur={FUR}
            lash="rgba(232, 170, 60, 0.8)"
            lashWidth={Math.max(1.5, width * 0.014)}
          />
        ))}
        <CatOutfit kind={outfit} width={width} artWidth={TAIL.size[0]} at={OUTFIT} sweet={theme.sweet} foil={theme.foil} />
        {/* Over it all, the hand's layer: stroke it (it purrs), or give it a rub from a screen reader. */}
        <PetLayer petting={petting} label={`${label}${OUTFIT_WORDS[outfit] ? `,${OUTFIT_WORDS[outfit]}` : ""}. Pet the cat`} testID="sitting-cat" />
      </Animated.View>
      {petting.purring ? (
        <View style={[styles.burst, { left: width * 0.62, top: height * 0.12 }]} pointerEvents="none">
          <Purr size={width * 0.9} style={mark} still={reducedMotion} />
        </View>
      ) : null}
      {petting.happy !== null && !reducedMotion ? (
        <View style={[styles.burst, { left: width * 0.5, top: height * 0.1 }]} pointerEvents="none" testID="cat-happy">
          <Burst key={petting.happy} text="" size={width * 0.5} color={theme.sweet} glyph={mark} />
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

/**
 * How much each segment of the tail turns from the last (radians, base to tip),
 * given how far each joint (WHIP.joints) has turned from the tail as it lies:
 * the turn along the tail is a smooth curve through the joints' (cubic, from 0
 * at the base, flat there), each segment turned by its middle's share of it.
 */
export function tailBends(joints: number[]): number[] {
  "worklet";
  const S = WHIP.joints;
  const J = joints.length;
  // The curve's slope at each joint (Catmull-Rom; at the first, as the base's curve arrives).
  const slope: number[] = [];
  for (let j = 0; j < J; j++) {
    if (j === 0) slope.push((2 * joints[0]) / S[0]);
    else if (j === J - 1) slope.push((joints[j] - joints[j - 1]) / (S[j] - S[j - 1]));
    else slope.push((joints[j + 1] - joints[j - 1]) / (S[j + 1] - S[j - 1]));
  }
  const out: number[] = [];
  let before = 0;
  let j = 0;
  for (let i = 0; i < N; i++) {
    const s = (i + 0.5) / N;
    let turn: number;
    if (s <= S[0]) {
      turn = joints[0] * (s / S[0]) ** 2;
    } else {
      while (j < J - 2 && s > S[j + 1]) j++;
      const h = S[j + 1] - S[j];
      const u = Math.min(1, (s - S[j]) / h);
      const u2 = u * u, u3 = u2 * u;
      turn = (2 * u3 - 3 * u2 + 1) * joints[j] + (u3 - 2 * u2 + u) * h * slope[j] + (-2 * u3 + 3 * u2) * joints[j + 1] + (u3 - u2) * h * slope[j + 1];
    }
    out.push(turn - before);
    before = turn;
  }
  return out;
}

/** The tail's motion (see WHIP): each joint's turn and spin, the sweep's and curl's, the twitch's, and its timetable (s). */
export type TailState = {
  t: number; th: number[]; v: number[];
  sweep: number; sweepV: number; goal: number; omega: number;
  curl: number; curlV: number; curlGoal: number;
  tw: number; twV: number;
  next: number; back: number; backGoal: number; backOmega: number; twitchAt: number;
  /** The mood its moves were picked for (a new one starts a move at once). */
  mood: TailMood;
};
/** Calm, cross (rough handling) or content (purring). */
export type TailMood = 0 | 1 | 2;

/** The tail as it lies, about to start a swish. */
export function restTail(): TailState {
  "worklet";
  const n = WHIP.joints.length;
  const th: number[] = [], v: number[] = [];
  for (let j = 0; j < n; j++) {
    th.push(0);
    v.push(0);
  }
  return {
    t: 0, th, v, sweep: 0, sweepV: 0, goal: 0, omega: WHIP.swish.omega,
    curl: 0, curlV: 0, curlGoal: WHIP.swish.curl, tw: 0, twV: 0,
    next: 0.4, back: -1, backGoal: 0, backOmega: 0, twitchAt: 3, mood: 0,
  };
}

/** Its next move, when the last one's time is up (`rand` 0..1, as Math.random). */
function nextMove(st: TailState, mood: TailMood, rand: () => number) {
  "worklet";
  if (mood === 1) {
    const c = WHIP.cross;
    st.goal = (st.goal > 0 ? -1 : 1) * (c.at + c.atSpread * rand());
    st.omega = c.omega + c.omegaSpread * rand();
    st.curlGoal = c.curl;
    st.next = st.t + c.s + c.sSpread * rand();
    return;
  }
  if (mood === 2) {
    const c = WHIP.content;
    st.goal = (st.goal > 0.05 ? -0.3 : 1) * (c.at + c.atSpread * rand());
    st.omega = c.omega;
    st.curlGoal = c.curl;
    st.next = st.t + c.s + c.sSpread * rand();
    return;
  }
  const r = rand();
  if (r < WHIP.flick.chance) {
    // A flick out, then back to where it was going.
    const f = WHIP.flick;
    st.back = st.t + f.hold;
    st.backGoal = st.goal;
    st.backOmega = f.back;
    st.goal = f.to;
    st.omega = f.omega;
    st.next = st.t + 0.9 + rand() * 1.2;
  } else if (r < WHIP.flick.chance + WHIP.rest.chance) {
    const w = WHIP.rest;
    st.goal = w.at + w.atSpread * rand();
    st.omega = w.omega;
    st.curlGoal = w.curl;
    st.next = st.t + w.s + w.sSpread * rand();
  } else {
    // A swish the other way: out (away from the body) further than in.
    const w = WHIP.swish;
    st.goal = st.goal > 0.2 ? w.in - w.inSpread * rand() : w.out + w.outSpread * rand();
    st.omega = w.omega + w.omegaSpread * rand();
    st.curlGoal = w.curl;
    st.next = st.t + w.s + w.sSpread * rand();
  }
}

/**
 * The tail `dt` seconds on (on the UI thread, each frame): its moves picked as
 * they fall due, then its springs run in small steps. A new state; and the
 * joints' turns (radians) for tailBends.
 */
export function stepTail(from: TailState, mood: TailMood, dt: number, rand: () => number): { state: TailState; joints: number[] } {
  "worklet";
  const st: TailState = { ...from, th: from.th.slice(), v: from.v.slice() };
  const n = WHIP.joints.length;
  const steps = Math.max(1, Math.ceil(Math.min(0.1, dt) / WHIP.step));
  const h = Math.min(0.1, dt) / steps;
  const swing = WHIP.swing * RADIANS, hook = WHIP.hook * RADIANS;
  if (st.mood !== mood) {
    st.mood = mood;
    st.next = st.t;
    st.back = -1;
  }
  for (let k = 0; k < steps; k++) {
    st.t += h;
    if (st.back >= 0 && st.t >= st.back) {
      st.goal = st.backGoal;
      st.omega = st.backOmega;
      st.back = -1;
    }
    if (st.t >= st.next) nextMove(st, mood, rand);
    if (st.t >= st.twitchAt) {
      const [every, spread] = mood === 1 ? WHIP.twitches.cross : mood === 2 ? WHIP.twitches.content : WHIP.twitches.calm;
      st.twV += (rand() < 0.5 ? -1 : 1) * WHIP.twitchKick * (mood === 2 ? 0.5 : 1);
      st.twitchAt = st.t + every + spread * rand();
    }
    // The sweep and the curl ease to their goals (critically damped); the twitch rings and dies away.
    st.sweepV += (st.omega * st.omega * (st.goal - st.sweep) - 2 * st.omega * st.sweepV) * h;
    st.sweep += st.sweepV * h;
    const co = WHIP.curlOmega;
    st.curlV += (co * co * (st.curlGoal - st.curl) - 2 * co * st.curlV) * h;
    st.curl += st.curlV * h;
    const to = WHIP.twitchOmega;
    st.twV += (-to * to * st.tw - 2 * WHIP.twitchZeta * to * st.twV) * h;
    st.tw += st.twV * h;
    // Each joint follows the one below it, bent by its muscles' share (semi-implicit Euler).
    let below = 0;
    for (let j = 0; j < n; j++) {
      const w = WHIP.omega[j];
      const target = below + st.sweep * WHIP.sweep[j] * swing + st.curl * WHIP.curl[j] * hook;
      st.v[j] += (w * w * (target - st.th[j]) - 2 * WHIP.zeta[j] * w * st.v[j]) * h;
      st.th[j] += st.v[j] * h;
      below = st.th[j];
    }
  }
  const joints: number[] = [];
  for (let j = 0; j < n; j++) joints.push(st.th[j] + st.tw * WHIP.twitch[j]);
  return { state: st, joints };
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

/**
 * The tail's motion on the UI thread (stepTail, every frame): its segments'
 * bends. Its mood follows the hand: cross while it sulks, content while it
 * purrs. Still (all 0) under reduced motion.
 */
function useTailSwish({ still, sulking, purring }: { still: boolean; sulking: boolean; purring: boolean }): SharedValue<number[]> {
  const angles = useSharedValue<number[]>(STEPS.map(() => 0));
  const state = useSharedValue<TailState>(restTail());
  const mood = useSharedValue<TailMood>(0);
  useEffect(() => {
    mood.set(sulking ? 1 : purring ? 2 : 0);
  }, [sulking, purring, mood]);
  const frames = useFrameCallback((frame) => {
    "worklet";
    const dt = (frame.timeSincePreviousFrame ?? 0) / 1000;
    const { state: next, joints } = stepTail(state.get(), mood.get(), dt, Math.random);
    state.set(next);
    angles.set(tailBends(joints));
  }, false);

  useEffect(() => {
    frames.setActive(!still);
    if (still) {
      angles.set(STEPS.map(() => 0));
      state.set(restTail());
    }
    // frames, angles and state are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);
  return angles;
}

/**
 * The tail: its image laid on a strip of triangles along its centre line
 * (bent by `bends`), on a canvas over the art's box and past it on every side
 * (TAIL.pad) for the swing, under the body (which covers its base).
 */
function Tail({ width, height, bends }: { width: number; height: number; bends: SharedValue<number[]> }) {
  const image = useImage(TAIL_ART);
  const textures = useMemo(() => bendTail(STEPS.map(() => 0)), []);
  const vertices = useDerivedValue(() => bendTail(bends.get()));
  const pad = TAIL.pad;
  return (
    <View
      style={[styles.tail, {
        left: -pad.left * width, top: -pad.top * width,
        width: width * (1 + pad.left + pad.right), height: height + width * (pad.top + pad.bottom),
      }]}
      pointerEvents="none"
      testID="sitting-cat-tail"
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {image ? (
          <Group transform={[{ translateX: pad.left * width }, { translateY: pad.top * width }, { scale: width / TAIL.size[0] }]}>
            <Vertices vertices={vertices} textures={textures} indices={INDICES} mode="triangles">
              <ImageShader image={image} tx="decal" ty="decal" sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }} />
            </Vertices>
          </Group>
        ) : null}
      </Canvas>
    </View>
  );
}

/** The lids are shut while a hand is on it (the frame's touch). */
const touched = (v: number[]) => {
  "worklet";
  return v[8];
};

const styles = StyleSheet.create({
  cat: { transformOrigin: "50% 100%" },
  tail: { position: "absolute" },
  burst: { position: "absolute", width: 0, height: 0, alignItems: "center" },
});
