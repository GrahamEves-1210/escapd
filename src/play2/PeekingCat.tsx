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
//     it leans that way, a "!" or "?" bobbing on that side, now and then a word),
//     and sits with its lids half shut while a wrong answer's cooldown runs
//     (`waiting`),
//   - it likes being stroked (usePetting): a hand on it and it shuts its eyes
//     with a small flinch; rubbed, it leans into the hand, sways and purrs (a
//     fine shiver through it, a soft beat in the hand, "prr"); let go, its eyes
//     open slowly and it gives a content blink. Rough, quick taps, and it has
//     had enough for a while ("Enough."),
//   - and it says a short line now and then in a speech bubble (`say`).
// It all moves at 12 frames a second, like stop motion: the animations run
// smoothly underneath, and what's drawn is a snapshot of them every 1/12 s.
// The art's own pupils are painted out (assets/characters/cat_peek.png); the
// pupils and eyelids are drawn over the eyes. Under reduced motion it sits
// still apart from its eyes; its marks (a purr's "prr", a glance's "!") show
// without moving.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Image, StyleSheet, Text, View, type AccessibilityActionEvent } from "react-native";
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
import { ref } from "@/theme/tokens";

const ART = require("../../assets/characters/cat_peek.png") as number;
/** The art's size (px) and its eyes, as fractions of it. */
const ART_W = 560;
const ART_H = 585;
const EYES = [{ x: 0.3329, y: 0.5336 }, { x: 0.7061, y: 0.5336 }] as const;
const EYE_R = { x: 0.0949, y: 0.0833 };
/**
 * Pupils: a slit `slitW` of the art's width across and `slitH` of its height
 * tall in ordinary light; fully open (`dilate` 1: surprised), a disc `round`
 * of its width across. In between, a tall oval. Centred `drop` (of its height)
 * below the eye's centre, the middle of the art's iris.
 */
const PUPIL = { slitW: 0.02, slitH: 0.115, round: 0.15, minW: 1.2, drop: 0.006 };
/** How open the pupils go (0 slit, 1 round): the light far off (the dark), thinking, glancing, perking up. */
const DILATE = { dark: 0.6, darkFrom: 300, darkOver: 500, think: 0.45, glance: 0.3, warm: 0.65 };
const FUR = "#0B0806";
/** It sits this far (of its height) behind the ledge, so its bottom edge never shows when it turns. */
const SINK = 0.05;
/** Drawn at this many frames a second: stop motion. */
const FPS = 12;
/** It dozes off when the light has been still this long (ms): well after a stuck player's first glance (useCatCues). */
const DOZE_AFTER = 70000;
/** A line is up this long (ms): it pops in, stays about 2.2 s, and fades. */
const SPEECH_MS = 2650;
/** At most one line this often (ms); a rule line may cut in on a flavour one. */
const SPEECH_GAP = 6000;
/** Rough handling: more than this many quick taps in PET_WINDOW ms and it's had enough for ENOUGH_MS. Rubbing never counts. */
const PET_LIMIT = 4;
const PET_WINDOW = 3000;
const ENOUGH_MS = 3000;
/**
 * Petting: a touch shorter than `tap` ms that never moved is a tap (a poke, not
 * a stroke). A hand held `settle` ms, or moving, starts the purr: a breath of
 * it (its sound and a haptic pulse, useFeedback's purr) every `beat` ms, and
 * it sways over `cycle` ms. A screen
 * reader's pet purrs `a11y` ms (its rub action, `a11yRub`).
 */
export const PET = { tap: 260, settle: 350, beat: 1500, cycle: 2400, a11y: 1600, a11yRub: 3200 } as const;
/** Glancing, it leans this far (degrees, and of its width) toward the place: more than toward the light. */
const GLANCE_LEAN = { deg: 6, shift: 0.1 };

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

/** A find, a wrong answer, the light over something worth a look ("warm"), or nothing there ("empty"). */
export type CatReaction = { kind: "found" | "wrong" | "warm" | "empty"; at: number } | null;
/** What the cat is doing between reactions: watching, or thinking along with the case. */
export type CatMood = "idle" | "thinking";
/** A line for it to say (a new `at` each time). `rule` lines (the game's rules) win over flavour ones. */
export type CatLine = { text: string; at: number; rule?: boolean } | null;
/**
 * Somewhere to look instead of the light: window points, or (`from: "cat"`)
 * points from the cat's own centre. With a "!" toward it (`wonder`: a "?";
 * `quiet`: no mark, just its eyes and a lean), and maybe a word (`line`).
 * `track`: the spot drifts left at `speed` pt/s for `span` pt and flicks back,
 * over and over (watching prints go by on a moving string). Not under reduced motion.
 */
export type CatLook = {
  x: number; y: number; wonder?: boolean; line?: string; quiet?: boolean; from?: "cat"; track?: { speed: number; span: number };
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
  const hand = useRef({ at: 0, purring: false, taps: [] as number[] });
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
  const up = (moved: boolean) => {
    const now = Date.now();
    const wasTap = !moved && now - hand.current.at < PET.tap;
    stopPurr();
    if (latest.current.sulking) return;
    contentBlink();
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
  const half = width / 2;
  const gesture = usePanGesture({
    minDistance: 4,
    maxPointers: 1,
    testID: "cat-rub",
    onBegin: (e) => {
      "worklet";
      rubbing.set(false);
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
      if (cross.get() || still.get()) return;
      // It leans into the hand, toward where it is and the way it's going.
      const at = (e.x - half) / half + e.velocityX / 2500;
      lean.set(withTiming(Math.max(-1, Math.min(1, at)), { duration: 120 }));
    },
    onFinalize: () => {
      "worklet";
      const moved = rubbing.get();
      rubbing.set(false);
      scheduleOnRN(up, moved);
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
    timers.current.a11y = setTimeout(() => {
      stopPurr();
      contentBlink();
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

  return { touch, lean, poke, purr, clock, purring, gesture, onAction };
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

/** Indices into the cat's stop-motion frame. */
const F = {
  rise: 0, hop: 1, breath: 2, tilt: 3, lid: 4, sx: 5, sy: 6, doze: 7, think: 8, bx: 9, by: 10, droop: 11, gaze: 12, gx: 13, gy: 14,
  excite: 15, touch: 16, lean: 17, purr: 18, clock: 19, rel: 20, track: 21, poke: 22,
} as const;

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

export function PeekingCat({ width, beamX, beamY, frame, reaction, mood = "idle", say = null, lookAt = null, waiting = false }: {
  /** On-screen width (points). */
  width: number;
  beamX: SharedValue<number>;
  beamY: SharedValue<number>;
  /** The room photo's frame in window points: where the beam's fractions land. */
  frame: { x: number; y: number; width: number; height: number } | null;
  /** The latest thing that happened, to react to (a new `at` each time). */
  reaction?: CatReaction;
  mood?: CatMood;
  /** Something to say (a new `at` each time); shown if no other line was up too recently. */
  say?: CatLine;
  /** Where its eyes go while set, over the light (while thinking too: what it's thinking about). */
  lookAt?: CatLook;
  /** A wrong answer's cooldown is running: it sits with its lids half shut. */
  waiting?: boolean;
}) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const height = (width * ART_H) / ART_W;
  const viewRef = useRef<ComponentRef<typeof View>>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  // Rise from behind the ledge.
  const rise = useSharedValue(reducedMotion ? 0 : height);
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
  // The line it's saying, and when the last one went up (and whether it was a rule).
  const [line, setLine] = useState<{ text: string; at: number } | null>(null);
  const lastLine = useRef({ at: -Infinity, rule: false });

  /** Say a line, unless one went up too recently (a rule line may cut in on a flavour one). */
  const speak = (text: string, rule: boolean) => {
    const now = Date.now();
    const last = lastLine.current;
    if (now - last.at < SPEECH_GAP && (last.rule || !rule)) return;
    lastLine.current = { at: now, rule };
    setLine({ text, at: now });
  };

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

  // Stroked: eyes shut, it leans in and purrs (usePetting). Rough, quick taps: it's had enough, flinches,
  // and won't be petted for a while. Any touch wakes it.
  const petting = usePetting({
    width,
    reducedMotion,
    sulking: annoyed,
    onTouch: () => lastMove.set(Date.now()),
    onRough: () => {
      setAnnoyed(true);
      speak("Enough.", true);
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

  // Lines: what it's told to say, each taken down after a moment.
  useEffect(() => {
    if (say) speak(say.text, !!say.rule);
  }, [say]);
  useEffect(() => {
    if (!line) return;
    const timer = setTimeout(() => setLine(null), SPEECH_MS);
    return () => clearTimeout(timer);
  }, [line]);

  // A glance somewhere: the eyes go there and it leans that way (a glance
  // wakes it: it comes before dozing), maybe with a word, then back to the light.
  const lookX = lookAt?.x, lookY = lookAt?.y, lookLine = lookAt?.line, lookRel = lookAt?.from === "cat";
  const trackSpeed = lookAt?.track?.speed ?? 0, trackSpan = lookAt?.track?.span ?? 0;
  useEffect(() => {
    if (lookX === undefined || lookY === undefined) {
      gaze.set(withTiming(0, { duration: 260 }));
      return;
    }
    gx.set(lookX);
    gy.set(lookY);
    rel.set(lookRel ? 1 : 0);
    gaze.set(withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }));
    lastMove.set(Date.now());
    if (lookLine) speak(lookLine, false);
  }, [lookX, lookY, lookLine, lookRel, gaze, gx, gy, rel, lastMove]);
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
    rise.set(withDelay(500, withSpring(0, { damping: 14, stiffness: 140, mass: 0.8 })));
    // Stretched as it springs up, squashed as it lands on its paws.
    sy.set(withDelay(500, withSequence(withTiming(1.12, { duration: 180 }), withTiming(0.92, { duration: 120 }), withSpring(1, { damping: 6, stiffness: 160 }))));
    sx.set(withDelay(500, withSequence(withTiming(0.92, { duration: 180 }), withTiming(1.07, { duration: 120 }), withSpring(1, { damping: 6, stiffness: 160 }))));
    breath.set(withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reducedMotion, rise, breath, sx, sy]);

  // Blinks (sometimes a double), and the odd curious head tilt.
  useEffect(() => {
    let blink: ReturnType<typeof setTimeout>;
    let tilt: ReturnType<typeof setTimeout>;
    const doBlink = () => {
      const close = { duration: 70 }, open = { duration: 110 };
      lid.set(Math.random() < 0.25
        ? withSequence(withTiming(1, close), withTiming(0, open), withDelay(90, withTiming(1, close)), withTiming(0, open))
        : withSequence(withTiming(1, close), withTiming(0, open)));
      blink = setTimeout(doBlink, 2600 + Math.random() * 3800);
    };
    const doTilt = () => {
      if (!reducedMotion && doze.get() < 0.5 && think.get() < 0.5 && petting.touch.get() < 0.1) {
        if (Math.random() < 0.3) {
          // Duck behind the ledge, then peek back up.
          rise.set(withSequence(
            withTiming(height * 0.55, { duration: 220, easing: Easing.in(Easing.quad) }),
            withDelay(700, withSpring(0, { damping: 14, stiffness: 150, mass: 0.8 })),
          ));
          sy.set(withDelay(920, withSequence(withTiming(1.1, { duration: 160 }), withSpring(1, { damping: 6, stiffness: 160 }))));
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
  }, [lid, idleTilt, reducedMotion, rise, sy, doze, think, height, petting.touch]);

  // Reactions.
  useEffect(() => {
    if (!reaction) return;
    // Whatever happened wakes it.
    lastMove.set(Date.now());
    if (reaction.kind === "found") {
      // Surprised: eyes wide, pupils thrown open round, easing back to slits. (Its eyes move under reduced motion too.)
      lid.set(withTiming(0, { duration: 60 }));
      excite.set(withSequence(withTiming(1, { duration: 80 }), withDelay(650, withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }))));
    } else if (reaction.kind === "warm") {
      excite.set(withSequence(withTiming(DILATE.warm, { duration: 100 }), withDelay(400, withTiming(0, { duration: 900 }))));
    }
    if (reducedMotion) return;
    if (reaction.kind === "found") {
      pop(0.2);
    } else if (reaction.kind === "warm") {
      // Perks up: eyes wide, a quick stretch up (ears up), a small "!".
      lid.set(withTiming(0, { duration: 60 }));
      pop(0.12);
    } else if (reaction.kind === "empty") {
      // A yawn: eyes squeezed shut, a slow stretch with the head tipped back, then it settles.
      lid.set(withSequence(withTiming(0.9, { duration: 250 }), withDelay(600, withTiming(0, { duration: 200 }))));
      sy.set(withSequence(withTiming(1.07, { duration: 500, easing: Easing.inOut(Easing.sin) }), withDelay(350, withTiming(1, { duration: 400, easing: Easing.inOut(Easing.sin) }))));
      sx.set(withSequence(withTiming(0.97, { duration: 500 }), withDelay(350, withTiming(1, { duration: 400 }))));
      idleTilt.set(withSequence(withTiming(-3, { duration: 500 }), withDelay(350, withSpring(0, { damping: 10, stiffness: 80 }))));
    } else {
      flinch(0.22);
    }
    // pop and flinch read shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reaction, reducedMotion, hop, lid, excite, height]);

  // Thinking: head cocked, raised a little, pupils half open on what it's thinking about, "?"s rising.
  useEffect(() => {
    lastMove.set(Date.now());
    think.set(withSpring(mood === "thinking" ? 1 : 0, { damping: 9, stiffness: 120 }));
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
        if (!reducedMotion) pop(0.14);
      }
    }, 400);
    return () => clearInterval(timer);
    // pop reads shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asleep, mood, reducedMotion, doze, lastMove]);

  // The light's position against the cat (window points), for the lean and the pupils.
  const at: At = {
    ox: origin?.x ?? 0, oy: origin?.y ?? 0,
    fx: frame?.x ?? 0, fy: frame?.y ?? 0, fw: frame?.width ?? 0, fh: frame?.height ?? 0,
    known: !!origin && !!frame, seated: !!origin,
  };

  // Everything the cat's drawn from, at 12 frames a second (indices: F).
  const f = useStopMotion(
    [rise, hop, breath, idleTilt, lid, sx, sy, doze, think, beamX, beamY, droop, gaze, gx, gy,
      excite, petting.touch, petting.lean, petting.purr, petting.clock, rel, track, petting.poke],
    [reducedMotion ? 0 : height, 0, 0, 0, 0, 1, 1, 0, 0, 0.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  );
  const body = useAnimatedStyle(() => {
    const v = f.get();
    const g = v[F.gaze], z = v[F.doze], t = v[F.think], b = v[F.breath];
    let lean = 0, shift = 0;
    const a = aim(v, width / 2, height / 2, width, height, at);
    if (a.has) {
      // Toward the light, or (further, so it reads) toward where it's glancing.
      const dx = a.dx * a.weight;
      const most = 4 + (GLANCE_LEAN.deg - 4) * g;
      lean = Math.max(-most, Math.min(most, dx / (60 - 40 * g)));
      shift = Math.max(-1, Math.min(1, dx / 60)) * GLANCE_LEAN.shift * width * g;
    }
    // A hand on it: the flinch, the lean into the hand, the purr.
    const p = pettingMotion(v[F.poke], v[F.lean], v[F.purr], v[F.clock], width, height);
    // Asleep it slumps lower and breathes deeper; thinking it sits up with its head cocked.
    const deep = 1 + z * 1.6;
    return {
      transform: [
        // Its paws stay on the ledge (the art ends there): a pop is a stretch up, never a lift off.
        { translateY: Math.max(0, v[F.rise] + v[F.hop] + (1 - b) * 1.5 + z * height * 0.14 + p.y) + height * SINK },
        { translateX: shift * (1 - z) + p.x },
        // Small turns only, so a tilt never lifts the art's cut-off bottom edge into view.
        { rotate: `${lean * (1 - z) + v[F.tilt] + t * 4 - z * 3 + p.rotate}deg` },
        // Breathing: a little taller as it breathes in, a touch narrower; with the squash and stretch on top.
        { scaleY: v[F.sy] * p.sy * (1 + b * 0.025 * deep) * (1 + t * 0.05) },
        { scaleX: v[F.sx] * p.sx * (1 - b * 0.012 * deep) },
      ],
    };
  });

  // A find's sparkles play once per find (they end invisible).
  const burst = reaction?.kind === "found" ? reaction.at : null;
  // The light over something worth a look: a small "!".
  const perk = reaction?.kind === "warm" ? reaction.at : null;
  const mark = { color: theme.ink, fontFamily: theme.display.fontFamily };
  // Which side a glance is toward (-1 left, 1 right), for its mark.
  const side = lookAt && origin ? (lookAt.x < origin.x + width / 2 ? -1 : 1) : 1;
  return (
    <View pointerEvents="box-none" style={{ width: width * 1.3, height: height * 1.25 }}>
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
    {/* What it says, above-right of its head. */}
    {line ? (
      <View pointerEvents="none" style={[styles.speechAt, { left: width * 0.95, bottom: height * 0.92, width: width * 3.2 }]}>
        <CatSpeech key={line.at} text={line.text} still={reducedMotion} />
      </View>
    ) : null}
    {/* The ledge hides what's below it: the cat rises from behind it. */}
    <View style={[styles.clip, StyleSheet.absoluteFill]} pointerEvents="box-none">
      <Animated.View
        ref={viewRef}
        onLayout={() => measureInWindow(viewRef.current).then((r) => r && setOrigin({ x: r.x, y: r.y }))}
        style={[styles.cat, { width, height, left: width * 0.15 }, body]}
        accessibilityLabel="A black cat watches your light"
        testID="v2-cat"
      >
        <Image source={ART} style={{ position: "absolute", left: 0, top: 0, width, height }} resizeMode="contain" />
        {EYES.map((eye, i) => (
          <Eye key={i} eye={eye} width={width} height={height} at={at} f={f} />
        ))}
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

/** A line in a speech bubble, its tail toward the cat: it pops in (pose to pose, at 12 fps), stays a moment, and fades. */
export function CatSpeech({ text, still }: { text: string; still: boolean }) {
  const theme = useModeTheme();
  const t = useSharedValue(still ? 0.5 : 0);
  useEffect(() => {
    if (still) return;
    t.set(withTiming(1, { duration: SPEECH_MS, easing: Easing.linear }));
  }, [t, still]);
  const shown = useStopMotion([t], [still ? 0.5 : 0]);
  const anim = useAnimatedStyle(() => {
    if (still) return { opacity: 1, transform: [{ scale: 1 }] };
    const ms = shown.get()[0] * SPEECH_MS;
    // Small, too big, settled; it holds, then fades.
    const scale = ms < 170 ? 0.5 + (ms / 170) * 0.62 : ms < 300 ? 1.12 - ((ms - 170) / 130) * 0.12 : 1;
    const opacity = ms < 80 ? ms / 80 : ms > SPEECH_MS - 350 ? Math.max(0, (SPEECH_MS - ms) / 350) : 1;
    return { opacity, transform: [{ scale }] };
  });
  return (
    <Animated.View
      style={[styles.speech, { backgroundColor: theme.raised, borderColor: theme.rim }, anim]}
      accessibilityLiveRegion="polite"
      testID="v2-cat-speech"
    >
      <View style={[styles.tail, { backgroundColor: theme.raised, borderColor: theme.rim }]} />
      <Text maxFontSizeMultiplier={1.4} style={[ref.type.label, { color: theme.ink }]}>{text}</Text>
    </Animated.View>
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

function Eye({ eye, width, height, at, f }: {
  eye: { x: number; y: number }; width: number; height: number; at: At;
  /** The cat's stop-motion frame (useStopMotion; indices F). */
  f: SharedValue<number[]>;
}) {
  const cx = eye.x * width;
  const cy = eye.y * height;
  const ew = EYE_R.x * width * 2.35;
  const eh = EYE_R.y * height * 2.45;
  const rangeX = width * EYE_R.x * 0.55;
  const rangeY = height * EYE_R.y * 0.35;
  const pupil = useAnimatedStyle(() => {
    const v = f.get();
    const t = v[F.think], g = v[F.gaze];
    const a = aim(v, cx, cy, width, height, at);
    // How open: a slit in ordinary light; the light far off (the room dark round it), rounder; thinking or
    // glancing (interested), half open; a find throws it wide open, a flinch narrows it.
    let open = a.light ? DILATE.dark * Math.max(0, Math.min(1, (a.dark - DILATE.darkFrom) / DILATE.darkOver)) : 0;
    open = Math.max(open, DILATE.think * t, DILATE.glance * g);
    const ex = v[F.excite];
    open = ex >= 0 ? Math.max(open, ex) : open * (1 + ex);
    // A round pupil has less room to move across the eye than a slit; a slit, as tall as the eye, barely moves up or down.
    const rx = rangeX * (1 - 0.55 * open);
    const ry = rangeY * (0.35 + 0.25 * open);
    let dx = 0, dy = 0;
    if (a.has) {
      const d = Math.hypot(a.dx, a.dy) || 1;
      const pull = Math.min(1, d / 160) * a.weight;
      dx = (a.dx / d) * rx * pull;
      dy = (a.dy / d) * ry * pull;
    } else {
      // Thinking with nothing to look at: up and off to the side.
      dx = rx * 0.7 * t;
      dy = -ry * 1.1 * t;
    }
    const pw = Math.max(PUPIL.minW, width * (PUPIL.slitW + (PUPIL.round - PUPIL.slitW) * open));
    const ph = height * PUPIL.slitH + (width * PUPIL.round - height * PUPIL.slitH) * open;
    return {
      width: pw, height: ph, borderRadius: Math.min(pw, ph) / 2, left: cx - pw / 2, top: cy + height * PUPIL.drop - ph / 2,
      transform: [{ translateX: dx }, { translateY: dy }],
    };
  });
  // Dozing, the lids sit shut (a blink can't open them); sulking, half shut; a hand on it, shut, content.
  const shut = (v: number[]) => {
    "worklet";
    return Math.max(v[F.lid], v[F.doze], v[F.touch]);
  };
  const lidStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(shut(f.get()), f.get()[F.droop] * 0.5) }] }));
  // Shut (asleep, petted, or mid-blink), a curved lash line where the eye was.
  const lash = useAnimatedStyle(() => ({ opacity: Math.max(0, (shut(f.get()) - 0.7) / 0.3) }));
  return (
    <>
      <Animated.View style={[styles.pupil, pupil]} />
      {/* The eyelid closes from the top down over the eye. */}
      <Animated.View style={[styles.lid, { left: cx - ew / 2, top: cy - eh / 2, width: ew, height: eh, borderRadius: ew / 2 }, lidStyle]} />
      <Animated.View
        style={[styles.lash, {
          left: cx - ew * 0.38, top: cy - eh * 0.05, width: ew * 0.76, height: eh * 0.3,
          borderBottomWidth: Math.max(1.5, width * 0.016), borderBottomLeftRadius: ew * 0.4, borderBottomRightRadius: ew * 0.4,
        }, lash]}
      />
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
  lid: { position: "absolute", backgroundColor: FUR, transformOrigin: "50% 0%" },
  lash: { position: "absolute", borderColor: "rgba(232, 170, 60, 0.75)" },
  speechAt: { position: "absolute", alignItems: "flex-start" },
  speech: {
    maxWidth: "100%", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 6,
    transformOrigin: "0% 100%",
  },
  // A small diamond half under the bubble's bottom-left edge: its tail, pointing down to the cat.
  tail: {
    position: "absolute", left: 10, bottom: -5, width: 10, height: 10, transform: [{ rotate: "45deg" }],
    borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
