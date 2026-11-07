// The cat: Escapd's black cat, peering over the bottom edge of the room with
// its paws on the ledge. Its art never changes; it moves like a character:
//   - it rises from behind the ledge with a springy overshoot,
//   - it breathes (a slow squash and stretch), blinks now and then, and
//     tilts its head toward the light,
//   - its pupils are a real cat's: thin slits in ordinary light, rounder as
//     the light goes far off and it sits in the dark, rounder still when
//     something has its interest (a glance, thinking), and wide and round for
//     a moment when the player finds something, easing back to slits. They
//     follow the flashlight's beam, or wherever it's glancing,
//   - it reacts with squash and stretch: a crouch, a happy pop and a burst of
//     sparkles when the player finds something; a flinch and a quick duck when
//     they get something wrong (`reaction` changes),
//   - it has moods, shown with floating marks like a mascot's: "?"s drift up
//     while the case is thinking (`mood`), its eyes on what it's thinking
//     about (the light on the photo, or `lookAt`), and when the light hasn't
//     moved for a long while it dozes off on the ledge, eyes shut, "z"s
//     rising, until the light moves again (or it has something to show) and it
//     pops back up,
//   - now and then it ducks behind the ledge and peeks back up,
//   - it keeps an eye on the game: it perks up when the light passes over
//     something worth a look and yawns at an empty drawer (`reaction`), glances
//     at what the player hasn't looked at yet when they're stuck (`lookAt`:
//     it leans that way, a "!" or "?" bobbing on that side, now and then a paw
//     patting the ledge toward it), gives a slow, level blink and a huff (a
//     puff from its nose, a shake of its head) at guessing (`reaction` "guess"),
//     and sits with its lids half shut while a wrong answer's cooldown runs
//     (`waiting`),
//   - it likes being stroked (usePetting): a hand on it and it shuts its eyes
//     with a small flinch; rubbed, it leans into the hand, sways and purrs (a
//     fine shiver through it, a soft beat in the hand, "prr"); let go, its eyes
//     open slowly and it gives a content blink. Rough, quick taps, and it has
//     had enough for a while (a huff and a flinch, lids half shut),
//   - on the ledge over the room (`playful`), the light held still near it (or
//     drawn slowly past) is a laser pointer (cat/laser.ts): its eyes lock on,
//     pupils round, it crouches, its tail comes up behind the ledge, the butt
//     wiggle, then it springs up and swats at it, pink beans showing, swipe
//     lines; caught, it shuts its eyes, pleased, with sparkles; the light
//     whisked away, a miss: a blush, a look away and a lick of its paw, as if
//     that was the plan. Rare (a long cooldown), cut short by anything
//     that happens, and never in the way: it's all drawn, nothing to tap,
//   - now and then it washes: licks a paw, or rubs behind an ear (its paws cut
//     out of the art for it, cat/rig.tsx),
//   - the player back after a long while (the light untouched a minute, or the
//     app away), a big stretch and a yawn; a gentle rub, a happy slow blink,
//   - it wears its outfit (catAccessory.ts, cat/Accessory.tsx),
//   - and it never says a word: everything it means is in its eyes, its face,
//     its head and its paws.
// It all moves at 12 frames a second, like stop motion: the animations run
// smoothly underneath, and what's drawn is a snapshot of them every 1/12 s.
// The art's own pupils are painted out (assets/characters/cat_peek.png); the
// pupils and eyelids are drawn over the eyes. Under reduced motion it sits
// still apart from its eyes; its marks (a purr's "prr", a glance's "!") show
// without moving.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { AppState, StyleSheet, Text, View, type AccessibilityActionEvent } from "react-native";
import { SparkleIcon } from "phosphor-react-native";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing, cancelAnimation, useAnimatedReaction, useAnimatedStyle, useFrameCallback, useSharedValue, withDelay, withRepeat, withSequence, withSpring,
  withTiming, type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback, type Feedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { measureInWindow } from "@/render/PickupFlight";
import { useTheme } from "@/theme/ThemeProvider";
import { F } from "./cat/frame";
import { caught, initialLaser, laserTick } from "./cat/laser";
import { Face, HuntTail, PeekArt, PeekPaws, Swipe } from "./cat/rig";
import { CatOutfit, type Placements } from "./cat/Accessory";
import { useCatAccessory, type CatAccessory } from "./catAccessory";

const ART = require("../../assets/characters/cat_peek.png") as number;
/** The art's size (px). */
const ART_W = 560;
const ART_H = 585;
/**
 * Its eyes (the art's irises, measured: art px): centre, half width and half
 * height, and the tilt of the width (degrees, clockwise). Its lids close in
 * each eye's own frame; its pupils stay inside them. The irises are nearly
 * round and slant 32 and -38 degrees; the frame takes half that slant (a lid
 * along all of it reads as a frown), and its lid, a little over the outline,
 * still covers all of the iris.
 */
const EYES = [
  { x: 186.6, y: 314.1, a: 56.2, b: 46.5, tilt: 16 },
  { x: 396.5, y: 313.0, a: 57.4, b: 45.5, tilt: -19 },
] as const;
/**
 * Pupils: a slit `slitW` of the art's width across and `slitH` of its height
 * tall in ordinary light; fully open (`dilate` 1: surprised), a disc `round`
 * of its width across. In between, a tall oval. Centred on the iris, and
 * however they look or open, all of them inside `inside` of it (clear of its
 * outline): `reach` of the room there is, toward where it's looking.
 */
const PUPIL = { slitW: 0.02, slitH: 0.115, round: 0.15, minW: 1.2, inside: 0.9, reach: 0.85 };
/**
 * How open the pupils go (0 slit, 1 round): the light far off (the dark),
 * thinking, glancing, perking up. Thinking and glancing only just open them
 * (still slits, a touch fuller), so it's the same cat's eyes wherever it is.
 */
const DILATE = { dark: 0.6, darkFrom: 300, darkOver: 500, think: 0.18, glance: 0.12, warm: 0.65, hunt: 0.92 };
const FUR = "#0B0806";
/** The art's fur round its eyes (measured), for its lids. */
const LID_FUR = "#130F0C";
/**
 * Lids: their clip reaches `over` of the eye's outline (over its inked edge);
 * their edge is a circle `curve` times the eye's half width (a gentle curve);
 * shut, the lashes are `meet` of its half height below its middle.
 */
const LID = { over: 1.22, curve: 1.8, meet: 0.25 };
/**
 * Its paws rest on the ledge (the art ends at their bottom, on the bottom of
 * its box: where it's put, its paws show): it sits only `sink` of its height
 * lower. As it turns (about the middle of its bottom edge) one end of that
 * edge lifts; past `slack` points it sinks as much, so the edge never shows
 * above the ledge. The art's bottom edge reaches `left` and `right` of its
 * width either side of the middle. Breathing out lowers it `breath` points;
 * dozing, it slumps `doze` of its height (its paws' tops still showing).
 */
const PAWS = { sink: 0.005, slack: 1, left: 0.36, right: 0.5, breath: 0.6, doze: 0.07 };
/** Drawn at this many frames a second: stop motion. */
const FPS = 12;
/** It dozes off when the light has been still this long (ms): well after a stuck player's first glance (useCatCues). */
const DOZE_AFTER = 70000;
/** Rough handling: more than this many quick taps in PET_WINDOW ms and it's had enough for ENOUGH_MS. Rubbing never counts. */
const PET_LIMIT = 4;
const PET_WINDOW = 3000;
const ENOUGH_MS = 3000;
/**
 * Petting: a touch shorter than `tap` ms that never moved is a tap (a poke, not
 * a stroke). A hand held `settle` ms, or moving, starts the purr: a breath of
 * it (its sound and a haptic pulse, useFeedback's purr) every `beat` ms, and
 * it sways over `cycle` ms. A screen
 * reader's pet purrs `a11y` ms (its rub action, `a11yRub`). A gentle rub (a
 * purr of at least `gentle` ms, the hand moving under `gentleSpeed` pt/s on
 * average) and, let go, it gives a happy slow blink: the cat's "I love you".
 */
export const PET = { tap: 260, settle: 350, beat: 1500, cycle: 2400, a11y: 1600, a11yRub: 3200, gentle: 1400, gentleSpeed: 420 } as const;
/** A huff's puffs last this long (ms). */
const HUFF_MS = 1200;
/** Its nose (art px), where a huff comes out. */
const NOSE = { x: 289, y: 372 };
/**
 * Pointing with a paw (art px and degrees, as `pose` takes them, away from its middle): lifted `lift` off the
 * ledge and out `out` toward the side, turned `turn`; patting down to `low`, a pat each `beat` ms.
 */
const POINT = { lift: 210, low: 90, out: 120, turn: 34, beat: 190 };
/** Glancing, it leans this far (degrees, and of its width) toward the place: more than toward the light. */
const GLANCE_LEAN = { deg: 6, shift: 0.1 };
/**
 * Its acts (ms). Laser play: it crouches `crouch` in, starts the butt wiggle at
 * `wiggle` (one shimmy each `wigglePeriod`: four drawn frames) and pounces at
 * `pounce`. A lick's tongue flicks
 * each `lickBeat`, an ear's rub each `rubBeat`. It grooms now and then (`groom`
 * of its idle moments), never twice within `groomGap`; and no act within
 * `afterReaction` of a reaction. Back after `away` ms gone, it stretches and yawns.
 */
const ACT = {
  crouch: 380, wiggle: 720, wigglePeriod: 333, pounce: 1780, lickBeat: 170, rubBeat: 190,
  groom: 0.14, groomGap: 35000, afterReaction: 1500, away: 60000,
} as const;
/** Its outfit on its art (catAccessory): a collar or a scarf under its chin, spectacles on its eyes, a deerstalker between its ears. */
const OUTFIT: Placements = {
  collar: { x: 290, y: 494, w: 210, rotate: 0 },
  scarf: { x: 290, y: 512, w: 270, rotate: 0 },
  specs: { x: 291.5, y: 309.5, w: 344, rotate: 0 },
  deerstalker: { x: 300, y: 146, w: 320, rotate: -6 },
};
/** What it's wearing, in its label ("A black cat in a deerstalker watches your light"). */
export const OUTFIT_WORDS: Record<CatAccessory, string> = { none: "", collar: " in a bell collar", scarf: " in a knitted scarf", specs: " in round spectacles", deerstalker: " in a deerstalker" };
/**
 * Peeking: now and then (`chance` of its idle moments) it sinks `depth` of its
 * height behind the ledge, holds `hold` ms and comes back up, slowly. A cat
 * mounted within `swap` ms of the last one going (a close-up opened or closed)
 * doesn't rise from behind the ledge again: it's the same cat, already there.
 */
const PEEK = { chance: 0.1, depth: 0.4, hold: 900, swap: 1500 } as const;
/** When the last peeking cat went (ms). */
let lastPeekGone = -Infinity;
/** The time (ms), for its handlers. */
const msNow = () => Date.now();

/**
 * Stop motion: the sources' values, snapshotted FPS times a second. Styles read
 * the snapshot (by index), so they only change on a new frame.
 */
export function useStopMotion(sources: SharedValue<number>[], initial: number[]): SharedValue<number[]> {
  // Seeded with the sources' starting values (reading them during render isn't allowed).
  const shown = useSharedValue(initial);
  const last = useSharedValue(-1);
  useFrameCallback((frame) => {
    "worklet";
    const step = Math.floor(frame.timeSinceFirstFrame / (1000 / FPS));
    if (step === last.get()) return;
    last.set(step);
    shown.set(sources.map((v) => v.get()));
  });
  return shown;
}

/**
 * A find, a wrong answer, the light over something worth a look ("warm"), nothing there ("empty"), or
 * guessing (wrong after wrong: "guess", a slow level blink and a huff).
 */
export type CatReaction = { kind: "found" | "wrong" | "warm" | "empty" | "guess"; at: number } | null;
/** What the cat is doing between reactions: watching, or thinking along with the case. */
export type CatMood = "idle" | "thinking";
/**
 * Somewhere to look instead of the light: window points, or (`from: "cat"`)
 * points from the cat's own centre. With a "!" toward it (`wonder`: a "?";
 * `quiet`: no mark, just its eyes and a lean), and maybe a paw patting the ledge that way (`paw`).
 * `track`: the spot drifts left at `speed` pt/s for `span` pt and flicks back,
 * over and over (watching prints go by on a moving string). Not under reduced motion.
 */
export type CatLook = {
  x: number; y: number; wonder?: boolean; paw?: boolean; quiet?: boolean; from?: "cat"; track?: { speed: number; span: number };
} | null;

/**
 * One breath of a purr: the feedback module's purr (a soft purr, one breath
 * out and in, and a light haptic), and halfway through it a fainter tick in
 * the hand, so the purr is felt as a rhythm.
 */
function purrBreath(feedback: Feedback) {
  feedback.purr();
  return setTimeout(() => feedback.tick(), PET.beat / 2);
}

/** What a screen reader can do with the cat: pet it (a double tap), or give it a longer rub. */
export const PET_ACTIONS = [{ name: "activate", label: "Pet the cat" }, { name: "rub", label: "Rub the cat" }];

/**
 * A hand on the cat (both cats): touch-down shuts its eyes (`touch` 0..1) with
 * a small flinch (`poke`, a few frames); held or rubbed, it leans toward the
 * hand (`lean` -1..1) and purrs (`purr` 0..1, `clock` running round 0..1 for
 * the sway and the shiver; useFeedback's purr each breath, `purring` for the "prr"); let go,
 * its eyes open slowly with a content blink. Quick taps, more than PET_LIMIT
 * in PET_WINDOW, are rough handling: `onRough`. While `sulking` a hand gets a
 * flinch away and nothing else. `gesture` goes on the touch layer, `onAction`
 * on its accessibility actions (PET_ACTIONS). Under reduced motion only the
 * eyes move (and the purr's beat and mark).
 */
export function usePetting({ width, reducedMotion, sulking, onRough, onTouch }: {
  width: number;
  reducedMotion: boolean;
  sulking: boolean;
  onRough: () => void;
  /** Any touch, and each purr beat (the peeking cat stays awake). */
  onTouch?: () => void;
}) {
  const feedback = useFeedback();
  const touch = useSharedValue(0);
  const lean = useSharedValue(0);
  const poke = useSharedValue(0);
  const purr = useSharedValue(0);
  const clock = useSharedValue(0);
  // Read on the UI thread at touch-down.
  const cross = useSharedValue(sulking);
  const still = useSharedValue(reducedMotion);
  useEffect(() => {
    cross.set(sulking);
    still.set(reducedMotion);
  }, [sulking, reducedMotion, cross, still]);
  const [purring, setPurring] = useState(false);
  // A happy slow blink, after a gentle rub (a new time each).
  const [happy, setHappy] = useState<number | null>(null);
  const hand = useRef({ at: 0, purring: false, purredAt: 0, taps: [] as number[] });
  const timers = useRef<{
    settle?: ReturnType<typeof setTimeout>; beat?: ReturnType<typeof setInterval>; half?: ReturnType<typeof setTimeout>;
    stop?: ReturnType<typeof setTimeout>; a11y?: ReturnType<typeof setTimeout>;
  }>({});
  // The latest callbacks and props for the handlers below, which the gesture keeps from its first render.
  const latest = useRef({ feedback, onRough, onTouch, sulking, reducedMotion });
  useEffect(() => {
    latest.current = { feedback, onRough, onTouch, sulking, reducedMotion };
  });

  const startPurr = () => {
    const l = latest.current;
    if (hand.current.purring || l.sulking) return;
    hand.current.purring = true;
    hand.current.purredAt = Date.now();
    setPurring(true);
    clearTimeout(timers.current.stop);
    if (!l.reducedMotion) {
      purr.set(withTiming(1, { duration: 400 }));
      clock.set(withSequence(withTiming(0, { duration: 0 }), withRepeat(withTiming(1, { duration: PET.cycle, easing: Easing.linear }), -1, false)));
    }
    timers.current.half = purrBreath(l.feedback);
    clearInterval(timers.current.beat);
    timers.current.beat = setInterval(() => {
      timers.current.half = purrBreath(latest.current.feedback);
      latest.current.onTouch?.();
    }, PET.beat);
  };
  const stopPurr = () => {
    clearTimeout(timers.current.settle);
    clearInterval(timers.current.beat);
    clearTimeout(timers.current.half);
    if (!hand.current.purring) return;
    hand.current.purring = false;
    setPurring(false);
    purr.set(withTiming(0, { duration: 450 }));
    // The sway's clock stops once the purr has faded.
    timers.current.stop = setTimeout(() => cancelAnimation(clock), 500);
  };
  /** Its eyes open slowly, then a content blink: shut slowly, and open. */
  const contentBlink = () => {
    touch.set(withSequence(
      withTiming(0.45, { duration: 420, easing: Easing.out(Easing.quad) }),
      withDelay(220, withTiming(1, { duration: 240, easing: Easing.inOut(Easing.sin) })),
      withDelay(160, withTiming(0, { duration: 520, easing: Easing.inOut(Easing.sin) })),
    ));
    if (!latest.current.reducedMotion) lean.set(withSpring(0, { damping: 12, stiffness: 90 }));
  };
  /** A happy slow blink, twice: eyes open slowly, shut slowly, held, open; and once more, softer. */
  const slowBlink = () => {
    const slow = Easing.inOut(Easing.sin);
    touch.set(withSequence(
      withTiming(0.4, { duration: 520, easing: Easing.out(Easing.quad) }),
      withDelay(200, withTiming(1, { duration: 650, easing: slow })),
      withDelay(380, withTiming(0, { duration: 760, easing: slow })),
      withDelay(420, withTiming(0.85, { duration: 560, easing: slow })),
      withDelay(220, withTiming(0, { duration: 700, easing: slow })),
    ));
    if (!latest.current.reducedMotion) lean.set(withSpring(0, { damping: 12, stiffness: 90 }));
    setHappy(Date.now());
  };

  // The gesture's JS side: touch-down, the first rub, let go.
  const down = () => {
    hand.current.at = Date.now();
    latest.current.onTouch?.();
    clearTimeout(timers.current.settle);
    if (latest.current.sulking) return;
    timers.current.settle = setTimeout(startPurr, PET.settle);
  };
  const rubbed = () => {
    if (!latest.current.sulking) startPurr();
  };
  const up = (moved: boolean, speed: number) => {
    const now = Date.now();
    const wasTap = !moved && now - hand.current.at < PET.tap;
    const gentle = hand.current.purring && now - hand.current.purredAt >= PET.gentle && speed < PET.gentleSpeed;
    stopPurr();
    if (latest.current.sulking) return;
    if (gentle) slowBlink();
    else contentBlink();
    if (!wasTap) return;
    // Rough handling: quick taps, one after another.
    hand.current.taps = [...hand.current.taps.filter((t) => now - t < PET_WINDOW), now];
    if (hand.current.taps.length > PET_LIMIT) {
      hand.current.taps = [];
      touch.set(withTiming(0, { duration: 120 }));
      latest.current.onRough();
    }
  };

  const rubbing = useSharedValue(false);
  // How fast the hand moves (pt/s, summed over the rub's updates, and how many), for a gentle rub.
  const speed = useSharedValue({ sum: 0, n: 0 });
  const half = width / 2;
  const gesture = usePanGesture({
    minDistance: 4,
    maxPointers: 1,
    testID: "cat-rub",
    onBegin: (e) => {
      "worklet";
      rubbing.set(false);
      speed.set({ sum: 0, n: 0 });
      const side = Math.max(-1, Math.min(1, (e.x - half) / half));
      if (!still.get()) poke.set(withSequence(withTiming(cross.get() ? 1.4 : 1, { duration: 60 }), withSpring(0, { damping: 9, stiffness: 160 })));
      if (cross.get()) {
        // Had enough: it pulls away from the hand.
        if (!still.get()) lean.set(withSequence(withTiming(-side * 0.8, { duration: 90 }), withSpring(0, { damping: 10, stiffness: 100 })));
      } else {
        touch.set(withTiming(1, { duration: 90 }));
        if (!still.get()) lean.set(withTiming(side * 0.5, { duration: 160 }));
      }
      scheduleOnRN(down);
    },
    onActivate: () => {
      "worklet";
      rubbing.set(true);
      scheduleOnRN(rubbed);
    },
    onUpdate: (e) => {
      "worklet";
      const sp = speed.get();
      speed.set({ sum: sp.sum + Math.hypot(e.velocityX || 0, e.velocityY || 0), n: sp.n + 1 });
      if (cross.get() || still.get()) return;
      // It leans into the hand, toward where it is and the way it's going.
      const at = (e.x - half) / half + e.velocityX / 2500;
      lean.set(withTiming(Math.max(-1, Math.min(1, at)), { duration: 120 }));
    },
    onFinalize: () => {
      "worklet";
      const moved = rubbing.get();
      rubbing.set(false);
      const sp = speed.get();
      scheduleOnRN(up, moved, sp.n ? sp.sum / sp.n : 0);
    },
  });

  // A screen reader's pet: eyes shut, a purr a moment, then the content blink.
  const onAction = (e: AccessibilityActionEvent) => {
    const name = e.nativeEvent.actionName;
    if (name !== "activate" && name !== "rub") return;
    latest.current.onTouch?.();
    if (latest.current.sulking) return;
    clearTimeout(timers.current.a11y);
    touch.set(withTiming(1, { duration: 120 }));
    startPurr();
    // A rub is gentle: a happy slow blink after.
    timers.current.a11y = setTimeout(() => {
      stopPurr();
      if (name === "rub") slowBlink();
      else contentBlink();
    }, name === "rub" ? PET.a11yRub : PET.a11y);
  };

  // Rough handling ends any purr; and nothing outlives the cat.
  useEffect(() => {
    if (sulking) stopPurr();
    // stopPurr reads refs and shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sulking]);
  useEffect(() => () => {
    const t = timers.current;
    clearTimeout(t.settle);
    clearInterval(t.beat);
    clearTimeout(t.half);
    clearTimeout(t.stop);
    clearTimeout(t.a11y);
  }, []);

  return { touch, lean, poke, purr, clock, purring, happy, gesture, onAction };
}

/** The petting's motion on a cat's body (not under reduced motion): the flinch, the lean, the purr's sway and shiver. */
export function pettingMotion(touchDown: number, lean: number, purr: number, clock: number, width: number, height: number) {
  "worklet";
  const sway = Math.sin(clock * Math.PI * 2) * purr;
  // The shiver: a new tiny offset each drawn frame (the clock is somewhere new every 1/12 s).
  const jx = Math.sin(clock * 5023.3) * purr;
  const jy = Math.abs(Math.sin(clock * 3911.7)) * purr;
  const jr = Math.sin(clock * 7741.9) * purr;
  return {
    x: lean * width * 0.05 + jx * width * 0.012,
    y: touchDown * height * 0.04 + jy * height * 0.008,
    rotate: lean * 5 + sway * 1.8 + jr * 0.5,
    sx: 1 + touchDown * 0.04,
    sy: 1 - touchDown * 0.06,
  };
}


/** Where it sits and the photo's frame (window points). `known`: both measured; `seated`: where it sits is. */
type At = { ox: number; oy: number; fx: number; fy: number; fw: number; fh: number; known: boolean; seated: boolean };

/**
 * Where it's looking, from a point on the cat (`ex`, `ey`, from its top-left):
 * the light, or where it's glancing, blended by the glance. `weight`: how far
 * its eyes go there (a glance easing in or out, with no light to fall back
 * on); `dark`: how far off the light is (points), when there is one.
 */
function aim(v: number[], ex: number, ey: number, w: number, h: number, at: At) {
  "worklet";
  const g = v[F.gaze];
  let lx = 0, ly = 0, light = false;
  if (at.known) {
    lx = at.fx + v[F.bx] * at.fw - (at.ox + ex);
    ly = at.fy + v[F.by] * at.fh - (at.oy + ey);
    light = true;
  }
  let gx = 0, gy = 0, glance = false;
  if (g > 0) {
    if (v[F.rel] > 0.5) {
      gx = v[F.gx] + v[F.track] - (ex - w / 2);
      gy = v[F.gy] - (ey - h / 2);
      glance = true;
    } else if (at.seated) {
      gx = v[F.gx] - (at.ox + ex);
      gy = v[F.gy] - (at.oy + ey);
      glance = true;
    }
  }
  const dark = light ? Math.hypot(lx, ly) : 0;
  if (light && glance) return { dx: lx * (1 - g) + gx * g, dy: ly * (1 - g) + gy * g, weight: 1, has: true, light, dark };
  if (glance) return { dx: gx, dy: gy, weight: g, has: true, light, dark };
  return { dx: lx, dy: ly, weight: light ? 1 : 0, has: light, light, dark };
}

export function PeekingCat({
  width, beamX, beamY, frame, reaction, mood = "idle", lookAt = null, waiting = false, playful = false, onSeat,
}: {
  /** On-screen width (points). */
  width: number;
  beamX: SharedValue<number>;
  beamY: SharedValue<number>;
  /** The room photo's frame in window points: where the beam's fractions land. */
  frame: { x: number; y: number; width: number; height: number } | null;
  /** The latest thing that happened, to react to (a new `at` each time). */
  reaction?: CatReaction;
  mood?: CatMood;
  /** Where its eyes go while set, over the light (while thinking too: what it's thinking about). */
  lookAt?: CatLook;
  /** A wrong answer's cooldown is running: it sits with its lids half shut. */
  waiting?: boolean;
  /** It's on the ledge over the room: the light held near it is a laser pointer to it (cat/laser.ts). */
  playful?: boolean;
  /** Where its head is (window points), once measured: where a hint's paw prints start. */
  onSeat?: (head: { x: number; y: number }) => void;
}) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const outfit = useCatAccessory();
  const height = (width * ART_H) / ART_W;
  const viewRef = useRef<ComponentRef<typeof View>>(null);
  // Where it sits at rest (its box's top-left, window points): from its own untransformed box, so never mid-rise.
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const seat = () => measureInWindow(viewRef.current).then((r) => r && setOrigin((o) => {
    const x = r.x + width * 0.15, y = r.y + height * 0.25;
    return o && o.x === x && o.y === y ? o : { x, y };
  }));
  // Measured again once the screen's entrance has settled.
  useEffect(() => {
    const timers = [500, 1400].map((ms) => setTimeout(seat, ms));
    return () => timers.forEach(clearTimeout);
    // seat reads a ref and the cat's size only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const headX = origin ? origin.x + width / 2 : null, headY = origin ? origin.y + height * 0.45 : null;
  useEffect(() => {
    if (headX !== null && headY !== null) onSeat?.({ x: headX, y: headY });
    // onSeat is a fresh closure each render; only where it sits matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headX, headY]);

  // Rise from behind the ledge.
  // A cat swapped in for another (the room for a close-up, the casebook) is already there: it rises only when it's new.
  const [entering] = useState(() => !reducedMotion && Date.now() - lastPeekGone > PEEK.swap);
  const rise = useSharedValue(entering ? height : 0);
  // Breathing: 0..1, a slow loop.
  const breath = useSharedValue(0);
  // Hop (negative up) and flinch/duck (positive down), on reactions.
  const hop = useSharedValue(0);
  // Head tilt (degrees), drifting toward the light, with an idle tilt now and then.
  const idleTilt = useSharedValue(0);
  // Eyelids: 0 open, 1 shut.
  const lid = useSharedValue(0);
  // Squash and stretch (1 at rest), scaled from the ledge.
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  // Dozing (0 awake, 1 asleep) and thinking (0..1: head cocked, up a little higher, pupils half open).
  const doze = useSharedValue(0);
  const think = useSharedValue(0);
  // Its pupils thrown open (to 1: a find's surprise) or narrowed (to -1: a flinch), easing back.
  const excite = useSharedValue(0);
  // When the light last moved (ms), for dozing off.
  const lastMove = useSharedValue(0);
  const [asleep, setAsleep] = useState(false);
  // Lids half shut (0..1): waiting out a cooldown, or had enough of rough handling.
  const droop = useSharedValue(0);
  // Looking somewhere other than the light (0..1), and where (window points, or from its centre: `rel`),
  // the spot drifting by `track` (points).
  const gaze = useSharedValue(0);
  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const rel = useSharedValue(0);
  const track = useSharedValue(0);
  const [annoyed, setAnnoyed] = useState(false);
  // Rough handling's huff (a new time each); guessing's comes with its reaction.
  const [snort, setSnort] = useState<number | null>(null);

  /** A pop: crouch, stretch up, land with a squash, settle. */
  const pop = (up: number) => {
    "worklet";
    // Pose to pose, a few frames each (it's drawn at 12 fps): crouch, up, settle.
    hop.set(withSequence(withTiming(height * 0.03, { duration: 80 }), withTiming(0, { duration: 80 })));
    sy.set(withSequence(withTiming(0.93, { duration: 80 }), withTiming(1 + up * 0.5, { duration: 90 }), withTiming(0.98, { duration: 90 }), withTiming(1, { duration: 90 })));
    sx.set(withSequence(withTiming(1.05, { duration: 80 }), withTiming(0.96, { duration: 90 }), withTiming(1.01, { duration: 90 }), withTiming(1, { duration: 90 })));
  };
  /** A flinch: squashed down behind the ledge (`depth` of its height), a shiver, then back up. */
  const flinch = (depth: number) => {
    "worklet";
    hop.set(withSequence(withTiming(height * depth, { duration: 90 }), withDelay(450, withSpring(0, { damping: 9, stiffness: 120 }))));
    sy.set(withSequence(withTiming(0.88, { duration: 90 }), withDelay(450, withSpring(1, { damping: 7, stiffness: 150 }))));
    sx.set(withSequence(withTiming(1.08, { duration: 90 }), withDelay(450, withSpring(1, { damping: 7, stiffness: 150 }))));
    idleTilt.set(withSequence(
      withTiming(-4, { duration: 50 }), withTiming(4, { duration: 50 }), withTiming(-3, { duration: 50 }), withTiming(3, { duration: 50 }),
      withSpring(0, { damping: 10, stiffness: 120 }),
    ));
    lid.set(withSequence(withTiming(0.55, { duration: 80 }), withDelay(500, withTiming(0, { duration: 160 }))));
    excite.set(withSequence(withTiming(-1, { duration: 80 }), withDelay(500, withTiming(0, { duration: 400 }))));
  };

  // Its acts, one at a time, each a few poses on timers: laser play, grooming, a yawn (see ACT).
  const hunt = useSharedValue(0);
  const crouch = useSharedValue(0);
  const wiggle = useSharedValue(0);
  const wclock = useSharedValue(0);
  const pawLY = useSharedValue(0), pawLX = useSharedValue(0), pawLR = useSharedValue(0);
  const pawRY = useSharedValue(0), pawRX = useSharedValue(0), pawRR = useSharedValue(0);
  const mouth = useSharedValue(0);
  const tongue = useSharedValue(0);
  const blush = useSharedValue(0);
  const tailUp = useSharedValue(0);
  const smug = useSharedValue(0);
  const away = useSharedValue(0);
  // A swat's swipe lines (0..1 as they play), on its side (-1 left, 1 right).
  const swipe = useSharedValue(0);
  const swipeSide = useSharedValue(1);
  // Its paws cut out of the art (cat/rig.tsx) while it uses one.
  const [rigged, setRigged] = useState(false);
  // A catch's sparkles (a new time each).
  const [cheer, setCheer] = useState<number | null>(null);
  const feedback = useFeedback();
  const act = useRef<{ kind: "play" | "groom" | "yawn" | "point"; timers: ReturnType<typeof setTimeout>[] } | null>(null);
  const unrig = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Set as it mounts: no wash in its first moments.
  const lastGroom = useRef(Infinity);
  const reactedAt = useRef(0);
  const paws = { left: [pawLY, pawLX, pawLR], right: [pawRY, pawRX, pawRR] } as const;
  const acting = [hunt, crouch, wiggle, wclock, pawLY, pawLX, pawLR, pawRY, pawRX, pawRR, mouth, tongue, blush, tailUp, smug, away, swipe, swipeSide];

  /** Later in the act (ms), unless the act is cut short. */
  const later = (ms: number, fn: () => void) => {
    act.current?.timers.push(setTimeout(fn, ms));
  };
  /** An act starts (any other ends); `rig`: it uses its paws. */
  const begin = (kind: "play" | "groom" | "yawn" | "point", rig: boolean) => {
    stopAct();
    act.current = { kind, timers: [] };
    clearTimeout(unrig.current);
    if (rig) setRigged(true);
  };
  /** The act is over (everything back at rest by now): the paws go back into the art. */
  const finish = () => {
    act.current?.timers.forEach(clearTimeout);
    act.current = null;
    unrig.current = setTimeout(() => setRigged(false), 120);
  };
  /** Cut short (something happened): back to rest, quickly. */
  const stopAct = () => {
    if (!act.current) return;
    for (const v of acting) {
      cancelAnimation(v);
      v.set(withTiming(0, { duration: 140 }));
    }
    finish();
    unrig.current = setTimeout(() => setRigged(false), 260);
  };
  /**
   * A paw through poses, each [lift, out, turn, ms to get there, ms held before]
   * (art px and degrees; `out` and `turn` away from its middle, so either paw
   * takes the same poses).
   */
  const pose = (side: "left" | "right", poses: [number, number, number, number, number?][]) => {
    const m = side === "left" ? -1 : 1;
    const [y, x, r] = paws[side];
    const chain = (i: 0 | 1 | 2, k: number) => {
      const steps = poses.map((p) => withDelay(p[4] ?? 0, withTiming(p[i] * k, { duration: p[3], easing: Easing.out(Easing.quad) })));
      return withSequence(steps[0], ...steps.slice(1));
    };
    y.set(chain(0, 1));
    x.set(chain(1, m));
    r.set(chain(2, m));
  };
  /** Free for an act: awake, idle, no hand on it, not glancing or sulking. */
  const free = () => !act.current && doze.get() < 0.5 && think.get() < 0.5 && petting.touch.get() < 0.05 && gaze.get() < 0.1 && droop.get() < 0.1
    && msNow() - reactedAt.current > ACT.afterReaction;

  /** A lick of a paw: up to its mouth, eyes shut, head toward it, the tongue out `licks` times. */
  const lick = (side: "left" | "right", licks: number) => {
    const beat = ACT.lickBeat;
    const out = side === "left" ? -134 : -193;
    const hold = licks * beat * 2;
    pose(side, [[115, out, -20, 220], [100, out, -18, beat, hold * 0.3], [115, out, -20, beat, hold * 0.3], [0, 0, 0, 220, hold * 0.4]]);
    lid.set(withSequence(withDelay(120, withTiming(1, { duration: 120 })), withDelay(hold + 120, withTiming(0, { duration: 160 }))));
    idleTilt.set(withSequence(withTiming(side === "left" ? -4 : 4, { duration: 220 }), withDelay(hold, withSpring(0, { damping: 10, stiffness: 90 }))));
    const flicks = Array.from({ length: licks }, () => [withTiming(1, { duration: beat * 0.6 }), withTiming(0, { duration: beat * 1.4 })]).flat();
    tongue.set(withDelay(240, withSequence(flicks[0], ...flicks.slice(1))));
    return 460 + hold + beat * 2;
  };
  /** Grooming, now and then: a paw licked, or washed behind an ear (and licked after). */
  const groom = () => {
    begin("groom", true);
    lastGroom.current = Date.now();
    const side = Math.random() < 0.5 ? "left" : "right";
    if (Math.random() < 0.5) {
      later(lick(side, 3) + 100, finish);
      return;
    }
    // Behind the ear: the paw up to it, rubbing down over it, the head tipped into it, eyes shut.
    const [out, turn] = side === "left" ? [15, -15] : [-42, -15];
    const rub = ACT.rubBeat;
    pose(side, [[345, out, turn, 260], [315, out + 8, turn + 8, rub], [350, out, turn, rub], [315, out + 8, turn + 8, rub], [350, out, turn, rub], [0, 0, 0, 260, 60]]);
    lid.set(withSequence(withDelay(160, withTiming(1, { duration: 120 })), withDelay(rub * 4 + 60, withTiming(0, { duration: 160 }))));
    idleTilt.set(withSequence(withTiming(side === "left" ? -7 : 7, { duration: 260 }), withDelay(rub * 4, withSpring(0, { damping: 10, stiffness: 90 }))));
    later(260 + rub * 4 + 380, () => later(lick(side, 2) + 100, finish));
  };
  /** Back after a long while: a big stretch and a yawn, paws pushed out, eyes squeezed shut, then a blink. */
  const yawn = () => {
    begin("yawn", true);
    const slow = Easing.inOut(Easing.sin);
    lid.set(withSequence(withTiming(1, { duration: 200 }), withDelay(1250, withTiming(0, { duration: 260 })), withDelay(300, withTiming(1, { duration: 70 })), withTiming(0, { duration: 110 })));
    sy.set(withSequence(withTiming(1.13, { duration: 650, easing: slow }), withDelay(550, withTiming(0.96, { duration: 260 })), withSpring(1, { damping: 7, stiffness: 150 })));
    sx.set(withSequence(withTiming(0.95, { duration: 650, easing: slow }), withDelay(550, withTiming(1.03, { duration: 260 })), withSpring(1, { damping: 7, stiffness: 150 })));
    idleTilt.set(withSequence(withTiming(-3, { duration: 650, easing: slow }), withDelay(550, withSpring(0, { damping: 10, stiffness: 80 }))));
    mouth.set(withSequence(withDelay(200, withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) })), withDelay(520, withTiming(0, { duration: 240 }))));
    for (const side of ["left", "right"] as const) pose(side, [[40, 26, 16, 600], [0, 0, 0, 300, 560]]);
    later(2200, finish);
  };

  // Laser play: where the light is (window points).
  const spotNow = () => {
    const fr = latest.current.frame;
    return fr ? { x: fr.x + beamX.get() * fr.width, y: fr.y + beamY.get() * fr.height } : null;
  };
  /** The light held near it: eyes locked on, a crouch, the butt wiggle, a pounce and a swat; then pleased with itself, or not. */
  const play = (spot: { x: number; y: number }, side: -1 | 1) => {
    begin("play", !reducedMotion);
    lastMove.set(Date.now());
    const paw = side < 0 ? "left" : "right";
    // It's seen it: eyes wide open, pupils round, locked on.
    hunt.set(withTiming(1, { duration: 120 }));
    lid.set(withTiming(0, { duration: 60 }));
    if (reducedMotion) {
      // Its eyes only: locked on a moment, then a pleased half-lid.
      later(1600, () => {
        hunt.set(withTiming(0, { duration: 500 }));
        smug.set(withSequence(withTiming(1, { duration: 200 }), withDelay(1200, withTiming(0, { duration: 400 }))));
      });
      later(3500, finish);
      return;
    }
    later(ACT.crouch, () => {
      crouch.set(withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) }));
      tailUp.set(withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.6)) }));
    });
    later(ACT.wiggle, () => {
      wiggle.set(withTiming(1, { duration: 120 }));
      wclock.set(withRepeat(withTiming(1, { duration: ACT.wigglePeriod, easing: Easing.linear }), -1, false));
    });
    later(ACT.pounce, () => {
      const now = spotNow();
      const hit = !!now && caught(spot, now, Math.random());
      wiggle.set(withTiming(0, { duration: 60 }));
      // The tail drops out of sight as it springs (the swat is the thing to see).
      tailUp.set(withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }));
      // Up tall, the paw nearest the spot cocked back and swatting down at it.
      crouch.set(withSequence(withTiming(-1, { duration: 90, easing: Easing.out(Easing.quad) }), withDelay(280, withTiming(0.3, { duration: 110 })), withTiming(0, { duration: 180 })));
      pose(paw, [[300, -16, -30, 90], [170, 96, 48, 80, 80], [0, 0, 0, 200, 240]]);
      swipe.set(withSequence(withTiming(0, { duration: 0 }), withDelay(170, withTiming(1, { duration: 330, easing: Easing.linear })), withTiming(0, { duration: 0 })));
      swipeSide.set(side);
      feedback.press();
      later(700, () => {
        cancelAnimation(wclock);
        wclock.set(0);
        hunt.set(withTiming(0, { duration: 300 }));
        if (hit) {
          // Got it: a pleased half-lid, chin up, sparkles.
          smug.set(withSequence(withTiming(1, { duration: 200 }), withDelay(1300, withTiming(0, { duration: 400 }))));
          idleTilt.set(withSequence(withSpring(-side * 4, { damping: 8, stiffness: 120 }), withDelay(1100, withSpring(0, { damping: 10, stiffness: 90 }))));
          setCheer(Date.now());
          later(2100, finish);
        } else {
          // Missed: a blush, a look away, and a lick of the paw, as if that was the plan all along.
          blush.set(withSequence(withTiming(1, { duration: 160 }), withDelay(2200, withTiming(0, { duration: 500 }))));
          away.set(withSequence(withTiming(-side, { duration: 220 }), withDelay(1900, withTiming(0, { duration: 400 }))));
          later(600, () => later(lick(paw, 2) + 200, finish));
        }
      });
    });
  };

  // Stroked: eyes shut, it leans in and purrs (usePetting). Rough, quick taps: it's had enough, flinches,
  // and won't be petted for a while. Any touch wakes it (and ends whatever it was up to).
  const petting = usePetting({
    width,
    reducedMotion,
    sulking: annoyed,
    onTouch: () => {
      lastMove.set(Date.now());
      stopAct();
    },
    onRough: () => {
      // Had enough: a huff, a flinch, lids half shut a while.
      setAnnoyed(true);
      setSnort(Date.now());
      if (!reducedMotion) flinch(0.12);
    },
  });

  // Had enough: lids half shut for a while, then it lets you pet it again.
  useEffect(() => {
    if (!annoyed) return;
    const timer = setTimeout(() => setAnnoyed(false), ENOUGH_MS);
    return () => clearTimeout(timer);
  }, [annoyed]);
  const sulk = waiting || annoyed;
  useEffect(() => {
    droop.set(withTiming(sulk ? 1 : 0, { duration: sulk ? 160 : 260 }));
  }, [sulk, droop]);

  /**
   * A paw that way: lifted off the ledge, reaching out toward the side it's looking, two pats on the ledge,
   * and back. Its eyes stay on the place.
   */
  const pat = (side: -1 | 1) => {
    begin("point", true);
    const paw = side < 0 ? "left" : "right";
    const b = POINT.beat;
    pose(paw, [[POINT.lift, POINT.out, POINT.turn, 200, 120], [POINT.low, POINT.out + 10, POINT.turn, b], [POINT.lift * 0.7, POINT.out + 6, POINT.turn, b],
      [POINT.low, POINT.out + 10, POINT.turn, b], [0, 0, 0, 240, 320]]);
    later(200 + 120 + b * 3 + 560 + 80, finish);
  };

  // A glance somewhere: the eyes go there and it leans that way (a glance
  // wakes it: it comes before dozing), maybe a paw that way too, then back to the light.
  const lookX = lookAt?.x, lookY = lookAt?.y, lookPaw = !!lookAt?.paw, lookRel = lookAt?.from === "cat";
  const trackSpeed = lookAt?.track?.speed ?? 0, trackSpan = lookAt?.track?.span ?? 0;
  useEffect(() => {
    if (lookX === undefined || lookY === undefined) {
      gaze.set(withTiming(0, { duration: 260 }));
      return;
    }
    stopAct();
    gx.set(lookX);
    gy.set(lookY);
    rel.set(lookRel ? 1 : 0);
    gaze.set(withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }));
    lastMove.set(Date.now());
    if (lookPaw && !reducedMotion) {
      // Which side the place is on: from the cat itself, or against where it sits.
      const toward = lookRel ? lookX : lookX - (headX ?? lookX);
      // A beat after its eyes get there.
      const timer = setTimeout(() => pat(toward < 0 ? -1 : 1), 260);
      return () => clearTimeout(timer);
    }
    // stopAct and pat read refs and shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookX, lookY, lookPaw, lookRel, gaze, gx, gy, rel, lastMove]);
  // Watching something go by: its eyes follow it left, then flick back to the next.
  useEffect(() => {
    if (reducedMotion || trackSpeed <= 0 || trackSpan <= 0) {
      track.set(withTiming(0, { duration: 200 }));
      return;
    }
    track.set(withRepeat(withSequence(
      withTiming(-trackSpan, { duration: (trackSpan / trackSpeed) * 1000, easing: Easing.linear }),
      withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) }),
    ), -1, false));
  }, [reducedMotion, trackSpeed, trackSpan, track]);

  useEffect(() => {
    if (reducedMotion) return;
    if (entering) {
      rise.set(withDelay(500, withSpring(0, { damping: 14, stiffness: 140, mass: 0.8 })));
      // Stretched as it springs up, squashed as it lands on its paws.
      sy.set(withDelay(500, withSequence(withTiming(1.12, { duration: 180 }), withTiming(0.92, { duration: 120 }), withSpring(1, { damping: 6, stiffness: 160 }))));
      sx.set(withDelay(500, withSequence(withTiming(0.92, { duration: 180 }), withTiming(1.07, { duration: 120 }), withSpring(1, { damping: 6, stiffness: 160 }))));
    }
    breath.set(withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reducedMotion, entering, rise, breath, sx, sy]);

  // Blinks (sometimes a double), and the odd curious head tilt.
  useEffect(() => {
    let blink: ReturnType<typeof setTimeout>;
    let tilt: ReturnType<typeof setTimeout>;
    const doBlink = () => {
      const close = { duration: 70 }, open = { duration: 110 };
      if (!act.current) lid.set(Math.random() < 0.25
        ? withSequence(withTiming(1, close), withTiming(0, open), withDelay(90, withTiming(1, close)), withTiming(0, open))
        : withSequence(withTiming(1, close), withTiming(0, open)));
      blink = setTimeout(doBlink, 2600 + Math.random() * 3800);
    };
    const doTilt = () => {
      if (!reducedMotion && !act.current && doze.get() < 0.5 && think.get() < 0.5 && petting.touch.get() < 0.1) {
        if (Math.random() < ACT.groom && Date.now() - lastGroom.current > ACT.groomGap && free()) {
          // A wash: a paw licked, or behind an ear.
          groom();
        } else if (Math.random() < PEEK.chance) {
          // Now and then it sinks behind the ledge and peeks back up, slowly (no spring, no stretch: never a bounce).
          rise.set(withSequence(
            withTiming(height * PEEK.depth, { duration: 420, easing: Easing.inOut(Easing.sin) }),
            withDelay(PEEK.hold, withTiming(0, { duration: 520, easing: Easing.inOut(Easing.sin) })),
          ));
        } else {
          const to = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 2);
          idleTilt.set(withSequence(withSpring(to, { damping: 7, stiffness: 90 }), withDelay(900, withSpring(0, { damping: 10, stiffness: 80 }))));
        }
      }
      tilt = setTimeout(doTilt, 6000 + Math.random() * 7000);
    };
    blink = setTimeout(doBlink, 1800);
    tilt = setTimeout(doTilt, 4500);
    return () => {
      clearTimeout(blink);
      clearTimeout(tilt);
    };
    // groom and free read refs and shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lid, idleTilt, reducedMotion, rise, sy, doze, think, height, petting.touch]);

  // Reactions.
  useEffect(() => {
    if (!reaction) return;
    // Whatever happened wakes it, and ends whatever it was up to.
    lastMove.set(Date.now());
    reactedAt.current = Date.now();
    stopAct();
    if (reaction.kind === "found") {
      // Surprised: eyes wide, pupils thrown open round, easing back to slits. (Its eyes move under reduced motion too.)
      lid.set(withTiming(0, { duration: 60 }));
      excite.set(withSequence(withTiming(1, { duration: 80 }), withDelay(650, withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }))));
    } else if (reaction.kind === "warm") {
      excite.set(withSequence(withTiming(DILATE.warm, { duration: 100 }), withDelay(400, withTiming(0, { duration: 900 }))));
    } else if (reaction.kind === "guess") {
      // Guessing: a slow, level blink (lids down, held, up), and a huff from its nose.
      lid.set(withSequence(withTiming(0.85, { duration: 420, easing: Easing.inOut(Easing.sin) }), withDelay(520, withTiming(0, { duration: 460, easing: Easing.inOut(Easing.sin) }))));
    }
    if (reducedMotion) return;
    if (reaction.kind === "found") {
      pop(0.2);
    } else if (reaction.kind === "warm") {
      // Perks up: eyes wide, sitting up a touch (eased, not a hop), a small "!".
      lid.set(withTiming(0, { duration: 60 }));
      sy.set(withSequence(withTiming(1.04, { duration: 160, easing: Easing.out(Easing.quad) }), withDelay(300, withTiming(1, { duration: 380, easing: Easing.inOut(Easing.sin) }))));
    } else if (reaction.kind === "guess") {
      // A slow shake of its head as it huffs, and it settles.
      idleTilt.set(withDelay(380, withSequence(
        withTiming(-4, { duration: 200, easing: Easing.inOut(Easing.sin) }), withTiming(4, { duration: 260, easing: Easing.inOut(Easing.sin) }),
        withTiming(-2, { duration: 220, easing: Easing.inOut(Easing.sin) }), withSpring(0, { damping: 10, stiffness: 90 }),
      )));
      sy.set(withSequence(withTiming(1.03, { duration: 300 }), withTiming(0.98, { duration: 220 }), withTiming(1, { duration: 300 })));
    } else if (reaction.kind === "empty") {
      // A yawn: eyes squeezed shut, a slow stretch with the head tipped back, then it settles.
      lid.set(withSequence(withTiming(0.9, { duration: 250 }), withDelay(600, withTiming(0, { duration: 200 }))));
      sy.set(withSequence(withTiming(1.07, { duration: 500, easing: Easing.inOut(Easing.sin) }), withDelay(350, withTiming(1, { duration: 400, easing: Easing.inOut(Easing.sin) }))));
      sx.set(withSequence(withTiming(0.97, { duration: 500 }), withDelay(350, withTiming(1, { duration: 400 }))));
      idleTilt.set(withSequence(withTiming(-3, { duration: 500 }), withDelay(350, withSpring(0, { damping: 10, stiffness: 80 }))));
    } else {
      flinch(0.22);
    }
    // pop, flinch and stopAct read refs and shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reaction, reducedMotion, hop, lid, excite, height]);

  // Thinking: head cocked, raised a little, pupils half open on what it's thinking about, "?"s rising.
  useEffect(() => {
    lastMove.set(Date.now());
    if (mood === "thinking") stopAct();
    think.set(withSpring(mood === "thinking" ? 1 : 0, { damping: 9, stiffness: 120 }));
    // stopAct reads refs and shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, think, lastMove]);

  // The light moving keeps it awake.
  useAnimatedReaction(
    () => beamX.get() + beamY.get() * 1000,
    (now, prev) => {
      if (prev !== null && now !== prev) lastMove.set(Date.now());
    },
  );

  // Dozing off, and waking with a start.
  useEffect(() => {
    const timer = setInterval(() => {
      const still = Date.now() - lastMove.get();
      if (!asleep && still > DOZE_AFTER && mood === "idle") {
        setAsleep(true);
        doze.set(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }));
      } else if (asleep && still < 1000) {
        setAsleep(false);
        doze.set(withTiming(0, { duration: 120 }));
        // Back after a long while: a big stretch and a yawn (or, if something's up, a start).
        if (!reducedMotion && !act.current && mood === "idle" && Date.now() - reactedAt.current > 1000 && petting.touch.get() < 0.05) yawn();
        else if (!reducedMotion) pop(0.14);
      }
    }, 400);
    return () => clearInterval(timer);
    // pop and yawn read refs and shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asleep, mood, reducedMotion, doze, lastMove]);

  // Laser play: the light sampled ten times a second against its head (cat/laser.ts).
  const latest = useRef({ frame, ready: false, calm: false, head: null as { x: number; y: number } | null });
  useEffect(() => {
    latest.current = {
      frame,
      ready: playful && !asleep && mood === "idle" && !lookAt && !annoyed && !waiting,
      // Free for a stretch (a glance may run on over it).
      calm: playful && !asleep && mood === "idle" && !annoyed && !waiting,
      head: headX !== null && headY !== null ? { x: headX, y: headY } : null,
    };
  });
  const laser = useRef(initialLaser());
  // When the light last moved (ms), for the player coming back.
  const stillSince = useRef(0);
  useEffect(() => {
    if (!playful) return;
    stillSince.current = Date.now();
    const timer = setInterval(() => {
      const spot = spotNow();
      const { head, ready, calm } = latest.current;
      if (!spot || !head) return;
      const now = Date.now();
      const before = laser.current.last;
      const { state, start } = laserTick(laser.current, spot.x, spot.y, now, head, ready && free());
      laser.current = state;
      if (start) play(spot, spot.x < head.x ? -1 : 1);
      // The player back after a long while (the light untouched, awake or not): a big stretch and a yawn.
      if (before && Math.hypot(spot.x - before.x, spot.y - before.y) > 2) {
        const idle = now - stillSince.current;
        stillSince.current = now;
        if (!start && idle > ACT.away && !act.current && doze.get() < 0.5 && petting.touch.get() < 0.05 && !reducedMotion && calm) yawn();
      }
    }, 100);
    return () => clearInterval(timer);
    // play, free and spotNow read refs and shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playful]);

  // Back in the app after a long while: it wakes (if it dozed) and stretches.
  useEffect(() => {
    let left = 0;
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") {
        left = left || Date.now();
        return;
      }
      const gone = left ? Date.now() - left : 0;
      left = 0;
      if (gone < ACT.away) return;
      lastMove.set(Date.now());
      if (!reducedMotion && !latest.current.ready) return;
      if (!reducedMotion && free()) yawn();
    });
    return () => sub.remove();
    // yawn and free read refs and shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);
  // No wash in its first moments; and nothing it was up to outlives it.
  useEffect(() => {
    lastGroom.current = Date.now();
    return () => {
      lastPeekGone = Date.now();
      act.current?.timers.forEach(clearTimeout);
      clearTimeout(unrig.current);
    };
  }, []);

  // The light's position against the cat (window points), for the lean and the pupils.
  const at: At = {
    ox: origin?.x ?? 0, oy: origin?.y ?? 0,
    fx: frame?.x ?? 0, fy: frame?.y ?? 0, fw: frame?.width ?? 0, fh: frame?.height ?? 0,
    known: !!origin && !!frame, seated: !!origin,
  };

  // Everything the cat's drawn from, at 12 frames a second (indices: F).
  const f = useStopMotion(
    [rise, hop, breath, idleTilt, lid, sx, sy, doze, think, beamX, beamY, droop, gaze, gx, gy,
      excite, petting.touch, petting.lean, petting.purr, petting.clock, rel, track, petting.poke, ...acting],
    [reducedMotion ? 0 : height, 0, 0, 0, 0, 1, 1, 0, 0, 0.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...acting.map(() => 0)],
  );
  const body = useAnimatedStyle(() => {
    const v = f.get();
    const g = v[F.gaze], z = v[F.doze], t = v[F.think], b = v[F.breath], hu = v[F.hunt];
    let lean = 0, shift = 0;
    const a = aim(v, width / 2, height / 2, width, height, at);
    if (a.has) {
      // Toward the light, or (further, so it reads) toward where it's glancing; hunting it, further still.
      const dx = a.dx * a.weight;
      const most = 4 + (GLANCE_LEAN.deg - 4) * g + 4 * hu;
      lean = Math.max(-most, Math.min(most, dx / (60 - 40 * g - 25 * hu)));
      shift = Math.max(-1, Math.min(1, dx / 60)) * GLANCE_LEAN.shift * width * Math.max(g, hu * 0.6);
    }
    // Laser play: down low (crouch > 0) or up tall for the pounce (< 0); the butt wiggle a shimmy of its shoulders.
    const c = v[F.crouch], low = Math.max(0, c), tall = Math.max(0, -c);
    const shimmy = Math.sin(v[F.wclock] * Math.PI * 2) * v[F.wiggle] * 1.6;
    // Embarrassed, it turns its head away.
    lean += v[F.away] * 5;
    // A hand on it: the flinch, the lean into the hand, the purr.
    const p = pettingMotion(v[F.poke], v[F.lean], v[F.purr], v[F.clock], width, height);
    // Asleep it slumps lower and breathes deeper; thinking it sits up with its head cocked.
    const deep = 1 + z * 1.6;
    const turn = lean * (1 - z) + v[F.tilt] + t * 4 - z * 3 + p.rotate + shimmy * 3.5;
    // Turning lifts one end of its bottom edge: it sinks that much, so that paw stays on the ledge and the edge never shows.
    const tilt = Math.sin((turn * Math.PI) / 180);
    const lift = Math.max(0, width * (tilt > 0 ? PAWS.left * tilt : -PAWS.right * tilt) - PAWS.slack);
    return {
      transform: [
        // Its paws stay on the ledge (the art ends there): a pop is a stretch up, never a lift off.
        { translateY: Math.max(0, v[F.rise] + v[F.hop] + (1 - b) * PAWS.breath + z * height * PAWS.doze + p.y + low * height * 0.13) + height * PAWS.sink + lift },
        { translateX: shift * (1 - z) + p.x + shimmy * width * 0.035 },
        { rotate: `${turn}deg` },
        // Breathing: a little taller as it breathes in, a touch narrower; with the squash and stretch on top.
        { scaleY: v[F.sy] * p.sy * (1 + b * 0.025 * deep) * (1 + t * 0.05) * (1 - low * 0.07 + tall * 0.15) },
        { scaleX: v[F.sx] * p.sx * (1 - b * 0.012 * deep) * (1 + low * 0.05 - tall * 0.05) },
      ],
    };
  });

  // A huff from its nose: at guessing, or at rough hands (it plays once and ends invisible).
  const huff = Math.max(reaction?.kind === "guess" ? reaction.at : -1, snort ?? -1);
  // A find's sparkles play once per find (they end invisible).
  const burst = reaction?.kind === "found" ? reaction.at : null;
  // The light over something worth a look: a small "!".
  const perk = reaction?.kind === "warm" ? reaction.at : null;
  const mark = { color: theme.ink, fontFamily: theme.display.fontFamily };
  // Which side a glance is toward (-1 left, 1 right), for its mark.
  const side = lookAt && origin ? (lookAt.x < origin.x + width / 2 ? -1 : 1) : 1;
  return (
    <View ref={viewRef} onLayout={seat} pointerEvents="box-none" style={{ width: width * 1.75, height: height * 1.25 }}>
    {/* Its marks float above its head, outside the ledge's clip. */}
    <View pointerEvents="none" style={[styles.marks, { left: width * 0.55, bottom: height * 0.8, width: width, height: height }]}>
      {mood === "thinking" && !reducedMotion ? (
        <>
          <Mark glyph="?" size={width * 0.34} dx={0} delay={250} style={mark} still={false} />
          <Mark glyph="?" size={width * 0.26} dx={width * 0.32} delay={750} style={mark} still={false} />
          <Mark glyph="?" size={width * 0.22} dx={-width * 0.22} delay={1250} style={mark} still={false} />
        </>
      ) : null}
      {asleep ? (
        <>
          <Mark glyph="z" size={width * 0.24} dx={0} delay={0} style={mark} drift still={reducedMotion} />
          <Mark glyph="z" size={width * 0.3} dx={width * 0.1} delay={1100} style={mark} drift still={reducedMotion} />
        </>
      ) : null}
      {petting.purring ? <Purr size={width} style={mark} still={reducedMotion} /> : null}
      {burst !== null && !reducedMotion ? (
        <View style={{ transform: [{ translateX: -width * 0.35 }] }}>
          <Burst key={burst} size={width} color={theme.ink} glyph={mark} text="!" />
        </View>
      ) : null}
      {cheer !== null && !reducedMotion ? (
        // Caught the light: sparkles, no mark.
        <View style={{ transform: [{ translateX: -width * 0.4 }] }}>
          <Burst key={cheer} size={width * 0.75} color={theme.glow} glyph={mark} text="" />
        </View>
      ) : null}
      {petting.happy !== null && !reducedMotion ? (
        // A gentle rub's happy slow blink: a couple of small sparkles.
        <View style={{ transform: [{ translateX: -width * 0.4 }] }} testID="cat-happy">
          <Burst key={petting.happy} size={width * 0.55} color={theme.glow} glyph={mark} text="" />
        </View>
      ) : null}
      {perk !== null && !reducedMotion ? (
        <View style={{ transform: [{ translateX: -width * 0.3 }] }}>
          <Burst key={perk} size={width * 0.6} color={theme.ink} glyph={mark} text="!" sparkles={false} />
        </View>
      ) : null}
      {lookAt && !lookAt.quiet ? (
        // Beside its head on the side it's looking (the marks' row is centred 0.4 of its width right of it).
        <View style={{ transform: [{ translateX: -width * 0.4 + side * width * 0.55 }] }}>
          <Pointer key={`${lookAt.x},${lookAt.y}`} size={width * 0.7} side={side} glyph={mark} text={lookAt.wonder ? "?" : "!"} still={reducedMotion} />
        </View>
      ) : null}
    </View>
    {/* The ledge hides what's below it: the cat rises from behind it. */}
    <View style={[styles.clip, StyleSheet.absoluteFill]} pointerEvents="box-none">
      {/* Its tail, behind it, up from behind the ledge for the butt wiggle. */}
      {reducedMotion ? null : <HuntTail width={width} height={height} f={f} left={width * 1.22} />}
      <Animated.View
        style={[styles.cat, { width, height, left: width * 0.15 }, body]}
        accessibilityLabel={`A black cat${OUTFIT_WORDS[outfit]} watches your light`}
        testID="v2-cat"
      >
        <PeekArt art={ART} width={width} height={height} f={f} rigged={rigged} />
        {EYES.map((eye, i) => (
          <Eye key={i} eye={eye} width={width} height={height} at={at} f={f} />
        ))}
        <Face width={width} f={f} sweet={theme.sweet} />
        {huff > 0 && !reducedMotion ? <Huff key={huff} width={width} color={theme.ink} /> : null}
        <CatOutfit kind={outfit} width={width} artWidth={ART_W} at={OUTFIT} sweet={theme.sweet} foil={theme.foil} />
        {rigged ? <PeekPaws art={ART} width={width} height={height} f={f} /> : null}
        {rigged ? <Swipe width={width} f={f} color={theme.ink} /> : null}
        {/* Over it all, the hand's layer: stroke it (it purrs), or give it a rub from a screen reader. */}
        <PetLayer petting={petting} label="Pet the cat" testID="v2-cat-pet" />
      </Animated.View>
    </View>
    </View>
  );
}

/**
 * The hand's layer over a cat: the petting gesture, and the button a screen
 * reader finds ("Pet the cat"; double tap pets it, its rub action rubs it).
 * It brings its own gesture root, so a cat works wherever it's drawn (inside
 * the app's root this adds nothing).
 */
export function PetLayer({ petting, label, testID }: { petting: ReturnType<typeof usePetting>; label: string; testID: string }) {
  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <GestureDetector gesture={petting.gesture}>
        <View
          style={StyleSheet.absoluteFill}
          collapsable={false}
          accessible
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Stroke it and it purrs."
          accessibilityActions={PET_ACTIONS}
          onAccessibilityAction={petting.onAction}
          testID={testID}
        />
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

/** A purr, written out: a small "prr" drifting up off its head while it purrs (still under reduced motion). */
export function Purr({ size, style, still }: { size: number; style: { color: string; fontFamily?: string }; still: boolean }) {
  return (
    <View style={{ transform: [{ translateX: size * 0.3 }] }} testID="cat-purr">
      <Mark glyph="prr" size={size * 0.2} dx={0} delay={0} style={style} drift still={still} />
    </View>
  );
}

/** A mark floating up from its head and fading, over and over: a "?" while it thinks, a "z" while it dozes. */
function Mark({ glyph, size, dx, delay, style, drift = false, still }: {
  glyph: string; size: number; dx: number; delay: number; style: { color: string; fontFamily?: string }; drift?: boolean; still: boolean;
}) {
  const t = useSharedValue(still ? 0.5 : 0);
  useEffect(() => {
    if (still) return;
    const period = drift ? 2200 : 1500;
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: period, easing: Easing.out(Easing.quad) }), -1, false)));
  }, [t, delay, drift, still]);
  const shown = useStopMotion([t], [still ? 0.5 : 0]);
  const anim = useAnimatedStyle(() => {
    const p = shown.get()[0];
    // Pops in with a little overshoot, rises (a "z" drifts sideways too), fades near the top.
    const grow = p < 0.18 ? (p / 0.18) * 1.15 : p < 0.3 ? 1.15 - ((p - 0.18) / 0.12) * 0.15 : 1;
    const fade = p < 0.08 ? p / 0.08 : p > 0.7 ? (1 - p) / 0.3 : 1;
    return {
      opacity: fade,
      transform: [
        { translateX: dx + (drift ? p * size * 0.9 : Math.sin(p * Math.PI * 2) * size * 0.15) },
        { translateY: -p * size * (drift ? 2.2 : 1.6) },
        { rotate: `${drift ? -12 : Math.sin(p * Math.PI * 3) * 14}deg` },
        { scale: grow },
      ],
    };
  });
  return (
    <Animated.View style={[styles.mark, anim]}>
      <Text allowFontScaling={false} style={[styles.markText, style, { fontSize: size, lineHeight: size * 1.15 }]}>{glyph}</Text>
    </Animated.View>
  );
}

/**
 * A glance's mark: a "!" (or "?") that pops in beside its head on the side it's
 * looking and nods that way while the glance holds. Still under reduced motion.
 */
function Pointer({ size, side, glyph, text, still }: {
  size: number; side: number; glyph: { color: string; fontFamily?: string }; text: string; still: boolean;
}) {
  const t = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    // In over a few frames, then a nod toward the place, over and over.
    t.set(withSequence(withTiming(1, { duration: 250 }), withRepeat(withSequence(withTiming(2, { duration: 450 }), withTiming(1, { duration: 450 })), -1, false)));
  }, [t, still]);
  const shown = useStopMotion([t], [still ? 1 : 0]);
  const anim = useAnimatedStyle(() => {
    const p = shown.get()[0];
    const grow = p < 1 ? (p < 0.6 ? (p / 0.6) * 1.2 : 1.2 - ((p - 0.6) / 0.4) * 0.2) : 1;
    const nod = p > 1 ? p - 1 : 0;
    return {
      opacity: Math.min(1, p * 3),
      transform: [{ translateX: side * nod * size * 0.18 }, { translateY: -size * 0.2 }, { rotate: `${side * (12 + nod * 8)}deg` }, { scale: grow }],
    };
  });
  return (
    <Animated.View style={[styles.mark, anim]} testID="v2-cat-point">
      <Text allowFontScaling={false} style={[styles.markText, glyph, { fontSize: size * 0.9, lineHeight: size }]}>{text}</Text>
    </Animated.View>
  );
}

/**
 * A huff: two small puffs of breath out of its nose, either side, drifting off and fading (a sigh at
 * guessing, a snort at rough hands). Not under reduced motion (its slow blink says it).
 */
function Huff({ width, color }: { width: number; color: string }) {
  const k = width / ART_W;
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: HUFF_MS, easing: Easing.out(Easing.quad) }));
  }, [t]);
  const shown = useStopMotion([t], [0]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill]} testID="cat-huff">
      {[-1, 1].map((side) => (
        <Puff key={side} t={shown} side={side} x={NOSE.x * k} y={NOSE.y * k} size={width * 0.2} color={color} />
      ))}
    </View>
  );
}

function Puff({ t, side, x, y, size, color }: { t: SharedValue<number[]>; side: number; x: number; y: number; size: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = t.get()[0];
    return {
      opacity: p < 0.1 ? (p / 0.1) * 0.9 : 0.9 * Math.max(0, 1 - (p - 0.1) / 0.9),
      transform: [{ translateX: side * (size * 0.5 + p * size * 1.8) }, { translateY: p * size * 0.6 }, { rotate: `${side * 18}deg` }, { scale: 0.6 + p * 0.9 }],
    };
  });
  return (
    <Animated.View style={[styles.puff, { left: x - size / 2, top: y - size / 2, width: size, height: size * 0.62, borderRadius: size, borderColor: color }, style]} />
  );
}

/** A find: sparkles burst out around its head and an "!" pops up, once (or just the mark, without `sparkles`). */
export function Burst({ size, color, glyph, text = "!", sparkles = true }: {
  size: number; color: string; glyph: { color: string; fontFamily?: string }; text?: string; sparkles?: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }));
  }, [t]);
  const shown = useStopMotion([t], [0]);
  const bang = useAnimatedStyle(() => {
    const p = shown.get()[0];
    return {
      opacity: p > 0.75 ? (1 - p) / 0.25 : 1,
      transform: [{ translateY: -p * size * 0.35 }, { scale: p < 0.2 ? (p / 0.2) * 1.1 : 1.1 - Math.min(1, (p - 0.2) / 0.2) * 0.1 }],
    };
  });
  return (
    <>
      {(sparkles ? [-0.9, -0.35, 0.35, 0.9] : []).map((a, i) => (
        <Spark key={i} t={shown} angle={a - Math.PI / 2} reach={size * (0.55 + (i % 2) * 0.2)} size={size * (i % 2 ? 0.24 : 0.32)} color={color} />
      ))}
      <Animated.View style={[styles.mark, bang]}>
        <Text allowFontScaling={false} style={[styles.markText, glyph, { fontSize: size * 0.6, lineHeight: size * 0.7 }]}>{text}</Text>
      </Animated.View>
    </>
  );
}

function Spark({ t, angle, reach, size, color }: { t: SharedValue<number[]>; angle: number; reach: number; size: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = t.get()[0];
    return {
      opacity: p > 0.6 ? (1 - p) / 0.4 : 1,
      transform: [
        { translateX: Math.cos(angle) * reach * p },
        { translateY: Math.sin(angle) * reach * p },
        { rotate: `${p * 90}deg` },
        { scale: p < 0.25 ? p / 0.25 : 1 - (p - 0.25) * 0.6 },
      ],
    };
  });
  return (
    <Animated.View style={[styles.mark, style]}>
      <SparkleIcon size={size} weight="fill" color={color} />
    </Animated.View>
  );
}

/** An eye's outline on screen (points): its centre, half width and half height (along and across its tilt), and its tilt (degrees, clockwise). */
export type EyeShape = { cx: number; cy: number; a: number; b: number; tilt: number };

/** Whether a point (from the eye's centre) is inside the eye's outline, shrunk to `k` of it. */
function inEye(x: number, y: number, e: EyeShape, k: number) {
  "worklet";
  const t = (e.tilt * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  const u = (x * c + y * s) / (e.a * k);
  const v = (-x * s + y * c) / (e.b * k);
  return u * u + v * v <= 1;
}

/**
 * How far (points) a pupil `hw` by `hh` (half sizes, upright) can go from the
 * eye's centre toward (`ux`, `uy`) with all of it inside `k` of the eye.
 */
export function pupilRoom(e: EyeShape, ux: number, uy: number, hw: number, hh: number, k: number) {
  "worklet";
  const fits = (d: number) => {
    for (let i = 0; i < 12; i++) {
      const q = (i / 12) * Math.PI * 2;
      if (!inEye(ux * d + Math.cos(q) * hw, uy * d + Math.sin(q) * hh, e, k)) return false;
    }
    return true;
  };
  if (!fits(0)) return 0;
  let lo = 0, hi = Math.max(e.a, e.b);
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * A lid over an eye (both cats), drawn in the eye's own frame so it always
 * sits on it, whatever the body does (it's drawn inside the body's transform):
 * fur clipped to the eye's outline (a touch over it), its curved edge coming
 * down across the eye from its top as `amount` of the frame `f` goes 0 to 1;
 * shut, a curve of lashes along the eye where the lids meet.
 */
export function EyeLid({ eye, f, amount, fur, lash, lashWidth }: {
  eye: EyeShape;
  f: SharedValue<number[]>;
  /** How shut (0..1), from the frame (a worklet). */
  amount: (v: number[]) => number;
  fur: string;
  lash: string;
  lashWidth: number;
}) {
  // The clip: a circle as wide as the eye (and a little), squashed to its height and turned to its tilt.
  const r = eye.a * LID.over;
  const squash = (eye.b * LID.over) / r;
  // The lid: a big circle (its edge a gentle curve), from just above the clip down past its bottom.
  const R = r * LID.curve;
  const lid = useAnimatedStyle(() => {
    const shut = Math.max(0, Math.min(1, amount(f.get())));
    return { opacity: shut > 0.02 ? 1 : 0, transform: [{ translateY: shut * (2 * r + 1) }] };
  });
  const lw = eye.a * 1.7, lh = eye.b * 0.55;
  const lashStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, (amount(f.get()) - 0.7) / 0.3) }));
  return (
    <>
      <View
        pointerEvents="none"
        style={[styles.lidClip, {
          left: eye.cx - r, top: eye.cy - r, width: 2 * r, height: 2 * r, borderRadius: r,
          transform: [{ rotate: `${eye.tilt}deg` }, { scaleY: squash }],
        }]}
      >
        <Animated.View style={[styles.lid, { left: r - R, top: -2 * R, width: 2 * R, height: 2 * R, borderRadius: R, backgroundColor: fur }, lid]} />
      </View>
      {/* Where the lids meet: a little below the eye's middle, along it. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.lash, {
          left: eye.cx - lw / 2, top: eye.cy - lh / 2, width: lw, height: lh, borderColor: lash,
          borderBottomWidth: lashWidth, borderBottomLeftRadius: lw * 0.45, borderBottomRightRadius: lw * 0.45,
          transform: [{ rotate: `${eye.tilt}deg` }, { translateY: eye.b * LID.meet - lh / 2 }],
        }, lashStyle]}
      />
    </>
  );
}

function Eye({ eye, width, height, at, f }: {
  eye: (typeof EYES)[number]; width: number; height: number; at: At;
  /** The cat's stop-motion frame (useStopMotion; indices F). */
  f: SharedValue<number[]>;
}) {
  const k = width / ART_W;
  const shape: EyeShape = { cx: eye.x * k, cy: eye.y * k, a: eye.a * k, b: eye.b * k, tilt: eye.tilt };
  const { cx, cy } = shape;
  const pupil = useAnimatedStyle(() => {
    const v = f.get();
    const t = v[F.think], g = v[F.gaze];
    const a = aim(v, cx, cy, width, height, at);
    // How open: a slit in ordinary light; the light far off (the room dark round it), rounder; thinking or
    // glancing (interested), a touch fuller; a find throws it wide open, a flinch narrows it.
    let open = a.light ? DILATE.dark * Math.max(0, Math.min(1, (a.dark - DILATE.darkFrom) / DILATE.darkOver)) : 0;
    open = Math.max(open, DILATE.think * t, DILATE.glance * g, DILATE.hunt * v[F.hunt]);
    const ex = v[F.excite];
    open = Math.max(0, Math.min(1, ex >= 0 ? Math.max(open, ex) : open * (1 + ex)));
    const pw = Math.max(PUPIL.minW, width * (PUPIL.slitW + (PUPIL.round - PUPIL.slitW) * open));
    const ph = height * PUPIL.slitH + (width * PUPIL.round - height * PUPIL.slitH) * open;
    // Toward where it's looking, as far as the iris lets it (a slit, as tall as the eye, barely moves up or
    // down); thinking with nothing to look at: up and off to the side.
    let ux = 0.6, uy = -0.8, pull = t;
    if (a.has) {
      const d = Math.hypot(a.dx, a.dy) || 1;
      ux = a.dx / d;
      uy = a.dy / d;
      pull = Math.min(1, d / 160) * a.weight;
    }
    // Hunting the light: locked on it, all the way. Embarrassed: looking off to the side and down.
    if (a.has) pull = Math.max(pull, v[F.hunt] * a.weight);
    const aw = v[F.away], awk = Math.abs(aw);
    if (awk > 0) {
      ux = ux * (1 - awk) + Math.sign(aw) * 0.9 * awk;
      uy = uy * (1 - awk) + 0.45 * awk;
      const n = Math.hypot(ux, uy) || 1;
      ux /= n;
      uy /= n;
      pull = Math.max(pull, awk);
    }
    const room = pull > 0 ? pupilRoom(shape, ux, uy, pw / 2, ph / 2, PUPIL.inside) * PUPIL.reach * pull : 0;
    return {
      width: pw, height: ph, borderRadius: Math.min(pw, ph) / 2, left: cx - pw / 2, top: cy - ph / 2,
      transform: [{ translateX: ux * room }, { translateY: uy * room }],
    };
  });
  // Dozing, the lids sit shut (a blink can't open them); sulking, half shut; a hand on it, shut, content.
  const shut = (v: number[]) => {
    "worklet";
    return Math.max(v[F.lid], v[F.doze], v[F.touch], v[F.droop] * 0.5, v[F.smug]);
  };
  return (
    <>
      <Animated.View style={[styles.pupil, pupil]} />
      <EyeLid eye={shape} f={f} amount={shut} fur={LID_FUR} lash="rgba(232, 170, 60, 0.75)" lashWidth={Math.max(1.5, width * 0.016)} />
    </>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden", justifyContent: "flex-end" },
  cat: { position: "absolute", bottom: 0, transformOrigin: "50% 100%" },
  marks: { position: "absolute", alignItems: "center", justifyContent: "flex-end" },
  mark: { position: "absolute", bottom: 0 },
  markText: {
    fontWeight: "900", textShadowColor: "rgba(0,0,0,0.85)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 },
  },
  pupil: { position: "absolute", backgroundColor: FUR },
  // An eye's outline: what its lid is clipped to.
  lidClip: { position: "absolute", overflow: "hidden" },
  lid: { position: "absolute" },
  lash: { position: "absolute" },
  puff: { position: "absolute", borderWidth: 2, borderStyle: "solid", borderTopColor: "transparent" },
});
