// The cat, sitting (assets/characters/cat_sit.png): on home's window sill,
// for the way out and case closed. It moves as the peeking cat does, at 12
// frames a second: it pops up with a squash and stretch and a burst of
// sparkles in the mode's candle glow (`cheer` changes for another),
// breathes, and now and then gives a little happy hop. It likes being
// stroked as the peeking cat does (usePetting): a hand on it and it shuts its
// eyes (lids drawn over the art's, in each eye's own frame) with a small
// flinch; rubbed, it leans into the hand, sways and purrs (a fine shiver, a
// soft beat in the hand, "prr"); let go, its eyes open slowly with a content
// blink (a gentle rub: a happy slow blink, and a few sparkles). Rough, quick
// taps and it pulls away from the hand for a while. It wears its outfit
// (catAccessory.ts: a bell collar, a scarf, spectacles, a deerstalker). Its
// art never changes, but its tail (cut out of the art,
// scripts/brand/cat_tail.py) moves all the time, smoothly, drawn as a
// textured mesh along a moving centre line bent by a chain of springs (WHIP):
// lazy swishes that sweep out and back, each running up the tail so the tip
// trails, swings past and snaps back; now and then a flick that whips up to
// the tip, a twitch of just the tip, or a rest curled into a question mark;
// fast and cross while it sulks, a slow curled sway while it purrs. Under reduced
// motion it simply sits, its tail still (its eyes still shut for a hand, and
// the "prr" shows).
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useDerivedValue, useFrameCallback, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from "react-native-reanimated";
import { Canvas, FilterMode, Group, ImageShader, MipmapMode, Vertices, useImage, vec, type SkPoint } from "@shopify/react-native-skia";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { Burst, EyeLid, OUTFIT_WORDS, PetLayer, Purr, pettingMotion, usePetting, useStopMotion } from "./PeekingCat";
import { CatOutfit, type Placements } from "./cat/Accessory";
import { useCatAccessory } from "./catAccessory";
import { SillMug } from "./cat/Mug";
import LINE from "../../assets/characters/cat_sit_tail.json";
import { WHIP, restTail, stepTail, type TailMood, type TailState } from "./cat/tail";

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
export const TAIL = { ...LINE, segments: LINE.points.length - 1, pad: { left: 0.02, top: 0.04, right: 0.5, bottom: 0.04 } } as const;
/** The tail's motion: cat/tail.ts (a chain of springs, a travelling S-wave, flicks). */
export { WHIP, restTail, stepTail, type TailMood, type TailState } from "./cat/tail";
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
/** Its outfit on its art (catAccessory), on its tipped head: a collar or a scarf, spectacles along its eyes, a deerstalker between its ears. */
const OUTFIT: Placements = {
  collar: { x: 206, y: 341, w: 170, rotate: -8 },
  scarf: { x: 206, y: 352, w: 200, rotate: -8 },
  specs: { x: 215, y: 217, w: 167, rotate: -29 },
  deerstalker: { x: 196, y: 144, w: 186, rotate: -18 },
};
/** Rough handling: it pulls away from a hand this long (ms). */
const ENOUGH_MS = 3000;
/** Now and then a blink (every `every` ms, plus up to `spread`); one in `double` is a double blink. No hops: it sits still unless something happens. */
const BLINK = { every: 3800, spread: 5200, double: 0.25 } as const;
/**
 * The mug by it on home's sill (`mug`). Once a visit, at a random moment
 * `first` to `first + spread` ms in (never in the first moments), it gets
 * curious: it leans to it, pats it twice (it wobbles), and nudges it off the
 * sill's edge (it tips and drops out of sight). `smash` ms after it leaves the
 * sill, the crash (feedback's mugBreak); it startles and runs off, is gone
 * `gone` ms, then comes back and sits down. The mug stays gone for the visit.
 * With a hand on it when the moment comes, it waits `retry` ms. The mug's body
 * is `size` of its width across, its right edge `edge` of its width in from
 * its left (by its haunch); its paw reaches from its chest (`chest`, shares of
 * its box). Not under reduced motion (the mug just sits there, steaming).
 */
export const MUG = {
  first: 50000, spread: 60000, retry: 8000, smash: 1000, gone: 5000,
  size: 0.27, edge: 0.3, chest: { x: 0.4, y: 0.7 },
} as const;

export function SittingCat({ width, delay = 0, cheer = 0, label = "The black cat", mug }: {
  /** On-screen width (points). */
  width: number;
  /** Before it pops up (ms). */
  delay?: number;
  /** Bump it for another happy pop and sparkles. */
  cheer?: number;
  label?: string;
  /**
   * Home's sill: a mug by it (MUG), its foot `base` points up from the cat's
   * box's bottom (the sill's top). A new `visit` (home opened again) brings it
   * back; while not `active` (home not in front) nothing happens to it.
   */
  mug?: { visit: number; active: boolean; base: number };
}) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const outfit = useCatAccessory();
  const height = width * ASPECT;
  const pop = useSharedValue(reducedMotion ? 1 : 0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const breath = useSharedValue(0);
  // Its own blinks (lids, 0..1).
  const blink = useSharedValue(0);
  // The mug business: leaning to it (degrees), the paw's reach (0..1+) and lift (points), its run (points across, and the hops' lift),
  // and the mug's slide, drop and turn.
  const look = useSharedValue(0);
  const reach = useSharedValue(0);
  const lift = useSharedValue(0);
  const runX = useSharedValue(0);
  const runY = useSharedValue(0);
  const mugX = useSharedValue(0);
  const mugY = useSharedValue(0);
  const mugR = useSharedValue(0);
  // The visit the mug went off the sill on (it's back on the next), and the one its steam stopped on.
  const [goneOn, setGoneOn] = useState<number | undefined>(undefined);
  const [coldOn, setColdOn] = useState<number | undefined>(undefined);
  const [startled, setStartled] = useState(false);
  const feedback = useFeedback();
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
  const tail = useTailSwish({ still: reducedMotion, sulking: sulking || startled, purring: petting.purring });
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
    return () => clearTimeout(t);
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

  // Blinks now and then (its lids only: it sits still unless something happens).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      const close = { duration: 70 }, open = { duration: 110 };
      blink.set(Math.random() < BLINK.double
        ? withSequence(withTiming(1, close), withTiming(0, open), withDelay(90, withTiming(1, close)), withTiming(0, open))
        : withSequence(withTiming(1, close), withTiming(0, open)));
      timer = setTimeout(next, BLINK.every + Math.random() * BLINK.spread);
    };
    timer = setTimeout(next, delay + 2200);
    return () => clearTimeout(timer);
  }, [blink, delay]);

  // The mug: back each visit; once a visit, knocked off (MUG).
  const visit = mug?.visit, active = !!mug?.active;
  const mugGone = goneOn !== undefined && goneOn === visit;
  const mugSteam = !(coldOn !== undefined && coldOn === visit);
  const acts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const knocked = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (visit === undefined) return;
    knocked.current = undefined;
    for (const v of [mugX, mugY, mugR]) v.set(0);
  }, [visit, mugX, mugY, mugR]);
  useEffect(() => {
    if (visit === undefined || !active || reducedMotion) return;
    const timers = acts.current;
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const w = width;
    const run = w * 1.5 + 40;
    const knock = () => {
      if (knocked.current === visit) return;
      // Not with a hand on it: a little later.
      if (petting.touch.get() > 0.05 || petting.purr.get() > 0.05) {
        later(MUG.retry, knock);
        return;
      }
      knocked.current = visit;
      const quick = Easing.out(Easing.quad);
      // It turns to the mug, curious.
      look.set(withTiming(-6, { duration: 380, easing: Easing.inOut(Easing.sin) }));
      // Two pats: the paw out to it, the mug wobbling; back a little.
      const pat = (at: number, wobble: number) => later(at, () => {
        reach.set(withSequence(withTiming(1, { duration: 110, easing: quick }), withDelay(90, withTiming(0.35, { duration: 150 }))));
        lift.set(withSequence(withTiming(-w * 0.03, { duration: 60 }), withTiming(0, { duration: 60 })));
        mugR.set(withDelay(100, withSequence(withTiming(wobble, { duration: 70 }), withTiming(-wobble * 0.6, { duration: 90 }), withSpring(0, { damping: 6, stiffness: 220 }))));
      });
      pat(600, 5);
      pat(1350, 8);
      // A look at it, head tipped, then the nudge: it slides, tips over the edge and drops out of sight.
      later(2050, () => look.set(withSequence(withTiming(-9, { duration: 200 }), withTiming(-6, { duration: 300 }))));
      later(2700, () => {
        setColdOn(visit);
        reach.set(withSequence(withTiming(1.3, { duration: 200, easing: quick }), withDelay(120, withTiming(0, { duration: 220 }))));
        mugX.set(withSequence(withTiming(-w * 0.12, { duration: 260, easing: Easing.inOut(Easing.quad) }), withTiming(-w * 0.2, { duration: 420 })));
        mugR.set(withDelay(200, withTiming(-80, { duration: 300, easing: Easing.in(Easing.quad) })));
        mugY.set(withDelay(260, withTiming(w * 1.2, { duration: 440, easing: Easing.in(Easing.quad) })));
      });
      // Out of sight, gone; a second after it left the sill, the crash.
      later(3500, () => setGoneOn(visit));
      later(3000 + MUG.smash, () => {
        feedback.mugBreak();
        setBurst({ at: Date.now(), text: "!" });
        setStartled(true);
        look.set(withTiming(4, { duration: 80 }));
        sy.set(withSequence(withTiming(1.14, { duration: 80 }), withTiming(0.9, { duration: 120 }), withTiming(1, { duration: 120 })));
        sx.set(withSequence(withTiming(0.92, { duration: 80 }), withTiming(1.08, { duration: 120 }), withTiming(1, { duration: 120 })));
      });
      // It runs off: a few bounding hops, out of the window.
      const hops = (from: number, to: number) => {
        const steps = [0.3, 0.6, 0.85, 1].map((k) => withTiming(from + (to - from) * k, { duration: 110, easing: Easing.linear }));
        runX.set(withSequence(steps[0], ...steps.slice(1)));
        const bob = [0, 1, 2, 3].flatMap(() => [withTiming(-w * 0.12, { duration: 55 }), withTiming(0, { duration: 55 })]);
        runY.set(withSequence(bob[0], ...bob.slice(1)));
      };
      const off = 3000 + MUG.smash + 380;
      later(off, () => {
        look.set(withTiming(0, { duration: 100 }));
        hops(0, run);
      });
      // Back after a while: it bounds in and sits down.
      later(off + 440 + MUG.gone, () => {
        setStartled(false);
        hops(run, 0);
      });
      later(off + 440 + MUG.gone + 460, () => bounce(0));
    };
    later(MUG.first + Math.random() * MUG.spread, knock);
    return () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      // Left mid-way: back on the sill at once (the mug, if it went, stays gone).
      for (const v of [look, reach, lift, runX, runY]) {
        cancelAnimation(v);
        v.set(0);
      }
      setStartled(false);
    };
    // bounce, petting's values and feedback are stable for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit, active, reducedMotion, width]);

  const f = useStopMotion(
    [pop, sx, sy, breath, petting.poke, petting.lean, petting.purr, petting.clock, petting.touch, blink, look, reach, lift, runX, runY],
    [reducedMotion ? 1 : 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  );
  const mugF = useStopMotion([mugX, mugY, mugR], [0, 0, 0]);
  const style = useAnimatedStyle(() => {
    const [p, x, y, b, poke, lean, purr, clock, , , turn, , , rx, ry] = f.get();
    // A hand on it: the flinch, the lean, the purr (its paws stay put: it turns from the bottom).
    const m = pettingMotion(poke, lean, purr, clock, width, height);
    return {
      opacity: Math.min(1, p * 3),
      transform: [
        { translateY: (1 - p) * height * 0.25 + m.y * 0.4 + ry },
        { translateX: m.x * 0.6 + rx + turn * width * 0.004 },
        { rotate: `${m.rotate * 0.6 + turn}deg` },
        { scaleX: x * m.sx * p * (1 - b * 0.012) },
        { scaleY: y * m.sy * p * (1 + b * 0.02) },
      ],
    };
  });

  const mark = { color: theme.glow, fontFamily: theme.hand.fontFamily };
  return (
    <View style={{ width, height }} pointerEvents="box-none">
      {mug && !mugGone ? (
        <SillMug size={width * MUG.size} left={width * (MUG.edge - MUG.size)} bottom={mug.base} f={mugF} steam={mugSteam} still={reducedMotion} />
      ) : null}
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
        {mug && !reducedMotion ? <PatPaw width={width} height={height} base={mug.base} f={f} /> : null}
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
          <Burst key={petting.happy} text="" size={width * 0.5} color={theme.glow} glyph={mark} />
        </View>
      ) : null}
      {burst !== null && !reducedMotion ? (
        <View style={[styles.burst, { left: width * 0.5, top: height * 0.12 }]} pointerEvents="none">
          <Burst key={burst.at} text={burst.text} size={width * 0.7} color={theme.glow} glyph={mark} />
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

/**
 * Its paw reaching from its chest to the mug (MUG) and patting it: a forearm of
 * fur and a paw, out as far as the frame's reach (0 tucked away, 1 on the mug,
 * more: a push), lifted by its lift.
 */
function PatPaw({ width, height, base, f }: { width: number; height: number; base: number; f: SharedValue<number[]> }) {
  const px = width * MUG.chest.x, py = height * MUG.chest.y;
  // The mug's shoulder, by the cat: its body's top right, a little down.
  const tx = width * (MUG.edge - 0.03), ty = height - base - width * MUG.size * 0.95;
  const L = Math.hypot(tx - px, ty - py);
  const a = Math.atan2(ty - py, tx - px);
  const arm = width * 0.085, paw = width * 0.12;
  const armStyle = useAnimatedStyle(() => {
    const r = f.get()[11];
    return { opacity: r > 0.04 ? 1 : 0, transform: [{ rotate: `${(a * 180) / Math.PI}deg` }, { scaleX: Math.max(0.01, r) }] };
  });
  const pawStyle = useAnimatedStyle(() => {
    const v = f.get();
    const r = v[11];
    return { opacity: r > 0.04 ? 1 : 0, transform: [{ translateX: Math.cos(a) * L * r }, { translateY: Math.sin(a) * L * r + v[12] }] };
  });
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.arm, { left: px, top: py - arm / 2, width: L, height: arm, borderRadius: arm / 2, transformOrigin: "0% 50%" }, armStyle]} />
      <Animated.View pointerEvents="none" style={[styles.paw, { left: px - paw / 2, top: py - paw * 0.4, width: paw, height: paw * 0.8, borderRadius: paw / 2 }, pawStyle]} testID="sitting-cat-paw" />
    </>
  );
}

/** The lids are shut while a hand is on it (the frame's touch). */
const touched = (v: number[]) => {
  "worklet";
  return Math.max(v[8], v[9]);
};

const styles = StyleSheet.create({
  cat: { transformOrigin: "50% 100%" },
  tail: { position: "absolute" },
  burst: { position: "absolute", width: 0, height: 0, alignItems: "center" },
  arm: { position: "absolute", backgroundColor: FUR },
  paw: { position: "absolute", backgroundColor: FUR, borderWidth: 1, borderColor: "#3A2C34" },
});
