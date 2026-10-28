// The cat: Escapd's black cat, peering over the bottom edge of the room with
// its paws on the ledge. Its art never changes; it moves like a character:
//   - it rises from behind the ledge with a springy overshoot,
//   - it breathes (a slow squash and stretch), blinks now and then, and
//     tilts its head toward the light,
//   - its slit pupils follow the flashlight's beam, opening wide in the dark
//     and narrowing to slits as the light comes near,
//   - it reacts with squash and stretch: a crouch, a happy pop and a burst of
//     sparkles when the player finds something; a flinch and a quick duck when
//     they get something wrong (`reaction` changes),
//   - it has moods, shown with floating marks like a mascot's: "?"s drift up
//     while the case is thinking (`mood`), and when the light hasn't moved for
//     a long while it dozes off on the ledge, eyes shut, "z"s rising, until the
//     light moves again (or it has something to show) and it pops back up,
//   - now and then it ducks behind the ledge and peeks back up,
//   - it keeps an eye on the game: it perks up when the light passes over
//     something worth a look and yawns at an empty drawer (`reaction`), glances
//     at what the player hasn't looked at yet when they're stuck (`lookAt`:
//     it leans that way, a "!" or "?" bobbing on that side, now and then a word),
//     sits with its lids half shut while a wrong answer's cooldown runs
//     (`waiting`), and has had enough after too much petting,
//   - and it says a short line now and then in a speech bubble (`say`).
// It all moves at 12 frames a second, like stop motion: the animations run
// smoothly underneath, and what's drawn is a snapshot of them every 1/12 s.
// The art's own pupils are painted out (assets/characters/cat_peek.png); the
// pupils and eyelids are drawn over the eyes. Under reduced motion it sits
// still apart from its eyes; its marks (a pet's heart, a glance's "!") show
// without moving.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SparkleIcon } from "phosphor-react-native";
import Animated, {
  Easing, useAnimatedReaction, useAnimatedStyle, useFrameCallback, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
  type SharedValue,
} from "react-native-reanimated";
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
/** Pupil width: a slit in the light, round in the dark (fractions of the art's width). */
const PUPIL = { slit: 0.026, wide: 0.085, h: 0.15 };
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
/** Petted more than this many times in PET_WINDOW ms, it's had enough for ENOUGH_MS. */
const PET_LIMIT = 4;
const PET_WINDOW = 3000;
const ENOUGH_MS = 3000;
/** Under reduced motion a pet's heart shows, still, this long (ms). */
const HEART_MS = 1200;
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
/** Somewhere to look instead of the light (window points), with a "!" toward it (`wonder`: a "?"), and maybe a word (`line`). */
export type CatLook = { x: number; y: number; wonder?: boolean; line?: string } | null;

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
  /** Where its eyes go while set, over the light. */
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
  // Dozing (0 awake, 1 asleep) and thinking (0..1: eyes up, head cocked, up a little higher).
  const doze = useSharedValue(0);
  const think = useSharedValue(0);
  // When the light last moved (ms), for dozing off.
  const lastMove = useSharedValue(0);
  const [asleep, setAsleep] = useState(false);
  const [petAt, setPetAt] = useState<number | null>(null);
  // Lids half shut (0..1): waiting out a cooldown, or had enough of petting.
  const droop = useSharedValue(0);
  // Looking somewhere other than the light (0..1), and where (window points).
  const gaze = useSharedValue(0);
  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  // Recent pets (ms), and whether it has had enough.
  const pets = useRef<number[]>([]);
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
  };
  // Petted: a happy pop and a heart; it wakes up. Too much of it and it's had enough: it flinches and won't be petted for a while.
  const pet = () => {
    if (annoyed) return;
    const now = Date.now();
    lastMove.set(now);
    pets.current = [...pets.current.filter((t) => now - t < PET_WINDOW), now];
    if (pets.current.length > PET_LIMIT) {
      pets.current = [];
      setAnnoyed(true);
      speak("Enough.", true);
      if (!reducedMotion) flinch(0.12);
      return;
    }
    setPetAt(now);
    if (!reducedMotion) pop(0.16);
  };
  // Under reduced motion the heart has no animation to end it: it's taken down.
  useEffect(() => {
    if (!reducedMotion || petAt === null) return;
    const timer = setTimeout(() => setPetAt(null), HEART_MS);
    return () => clearTimeout(timer);
  }, [reducedMotion, petAt]);

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
  const lookX = lookAt?.x, lookY = lookAt?.y, lookLine = lookAt?.line;
  useEffect(() => {
    if (lookX === undefined || lookY === undefined) {
      gaze.set(withTiming(0, { duration: 260 }));
      return;
    }
    gx.set(lookX);
    gy.set(lookY);
    gaze.set(withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }));
    lastMove.set(Date.now());
    if (lookLine) speak(lookLine, false);
  }, [lookX, lookY, lookLine, gaze, gx, gy, lastMove]);

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
      if (!reducedMotion && doze.get() < 0.5 && think.get() < 0.5) {
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
  }, [lid, idleTilt, reducedMotion, rise, sy, doze, think, height]);

  // Reactions.
  useEffect(() => {
    if (!reaction) return;
    // Whatever happened wakes it.
    lastMove.set(Date.now());
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
  }, [reaction, reducedMotion, hop, lid, height]);

  // Thinking: head cocked, eyes up, raised a little, "?"s rising.
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
  const ox = origin?.x ?? 0, oy = origin?.y ?? 0;
  const fx = frame?.x ?? 0, fy = frame?.y ?? 0, fw = frame?.width ?? 0, fh = frame?.height ?? 0;
  const known = !!origin && !!frame;
  const seated = !!origin;

  // Everything the cat's drawn from, at 12 frames a second (indices: see the reads below).
  const f = useStopMotion(
    [rise, hop, breath, idleTilt, lid, sx, sy, doze, think, beamX, beamY, droop, gaze, gx, gy],
    [reducedMotion ? 0 : height, 0, 0, 0, 0, 1, 1, 0, 0, 0.5, 0.5, 0, 0, 0, 0],
  );
  const body = useAnimatedStyle(() => {
    const [r, h, b, tilt, , squashX, squashY, z, t, bx, , , g, lx] = f.get();
    let lean = 0, shift = 0;
    if (seated && (known || g > 0)) {
      // Toward the light, or (further, so it reads) toward where it's glancing.
      const at = known ? fx + bx * fw : lx;
      const dx = at * (1 - g) + lx * g - (ox + width / 2);
      const most = 4 + (GLANCE_LEAN.deg - 4) * g;
      lean = Math.max(-most, Math.min(most, dx / (60 - 40 * g)));
      shift = Math.max(-1, Math.min(1, dx / 60)) * GLANCE_LEAN.shift * width * g;
    }
    // Asleep it slumps lower and breathes deeper; thinking it sits up with its head cocked.
    const deep = 1 + z * 1.6;
    return {
      transform: [
        // Its paws stay on the ledge (the art ends there): a pop is a stretch up, never a lift off.
        { translateY: Math.max(0, r + h + (1 - b) * 1.5 + z * height * 0.14) + height * SINK },
        { translateX: shift * (1 - z) },
        // Small turns only, so a tilt never lifts the art's cut-off bottom edge into view.
        { rotate: `${lean * (1 - z) + tilt + t * 4 - z * 3}deg` },
        // Breathing: a little taller as it breathes in, a touch narrower; with the squash and stretch on top.
        { scaleY: squashY * (1 + b * 0.025 * deep) * (1 + t * 0.05) },
        { scaleX: squashX * (1 - b * 0.012 * deep) },
      ],
    };
  });

  // A find's sparkles play once per find (they end invisible); a pet's heart likewise.
  const burst = reaction?.kind === "found" ? reaction.at : null;
  const shownBurst = petAt !== null && (burst === null || petAt > burst) ? { at: petAt, text: "♥" } : burst !== null ? { at: burst, text: "!" } : null;
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
      {shownBurst && !reducedMotion ? (
        <View style={{ transform: [{ translateX: -width * 0.35 }] }}>
          <Burst key={shownBurst.at} size={width} color={theme.ink} glyph={mark} text={shownBurst.text} />
        </View>
      ) : null}
      {petAt !== null && reducedMotion ? (
        <View style={[styles.mark, { transform: [{ translateX: -width * 0.35 }, { translateY: -width * 0.2 }] }]} testID="v2-cat-heart">
          <Text allowFontScaling={false} style={[styles.markText, mark, { fontSize: width * 0.6, lineHeight: width * 0.7 }]}>♥</Text>
        </View>
      ) : null}
      {perk !== null && !reducedMotion ? (
        <View style={{ transform: [{ translateX: -width * 0.3 }] }}>
          <Burst key={perk} size={width * 0.6} color={theme.ink} glyph={mark} text="!" sparkles={false} />
        </View>
      ) : null}
      {lookAt ? (
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
        {/* Tap it: a happy pop and a heart (and it wakes up). */}
        <Pressable onPress={pet} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Pet the cat" testID="v2-cat-pet" />
        {EYES.map((eye, i) => (
          <Eye key={i} eye={eye} width={width} height={height} known={known} seated={seated} at={{ ox, oy, fx, fy, fw, fh }} f={f} />
        ))}
      </Animated.View>
    </View>
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

function Eye({ eye, width, height, known, seated, at, f }: {
  /** `known`: where it sits and the photo's frame are both measured; `seated`: where it sits is. */
  eye: { x: number; y: number }; width: number; height: number; known: boolean; seated: boolean;
  at: { ox: number; oy: number; fx: number; fy: number; fw: number; fh: number };
  /** The cat's stop-motion frame (useStopMotion). */
  f: SharedValue<number[]>;
}) {
  const cx = eye.x * width;
  const cy = eye.y * height;
  const ew = EYE_R.x * width * 2.35;
  const eh = EYE_R.y * height * 2.45;
  const ph = height * PUPIL.h;
  const rangeX = width * EYE_R.x * 0.55;
  const rangeY = height * EYE_R.y * 0.35;
  const pupil = useAnimatedStyle(() => {
    const [, , , , , , , , t, beamX, beamY, , g, lx, ly] = f.get();
    let dx = 0, dy = 0, open = 1;
    if (seated && (known || g > 0)) {
      // The light, or where it's glancing instead.
      const px = known ? at.fx + beamX * at.fw : lx;
      const py = known ? at.fy + beamY * at.fh : ly;
      const bx = px * (1 - g) + lx * g - (at.ox + cx);
      const by = py * (1 - g) + ly * g - (at.oy + cy);
      const d = Math.hypot(bx, by) || 1;
      const pull = Math.min(1, d / 160);
      dx = (bx / d) * rangeX * pull;
      dy = (by / d) * rangeY * pull;
      // Near the light the pupil narrows to a slit; far off, in the dark, it opens wide.
      open = Math.max(0, Math.min(1, (d - 120) / 380));
    }
    // Thinking, it looks up and off to the side, wide-eyed.
    dx = dx * (1 - t) + rangeX * 0.7 * t;
    dy = dy * (1 - t) - rangeY * 1.1 * t;
    open = open * (1 - t) + 0.8 * t;
    const pw = width * (PUPIL.slit + (PUPIL.wide - PUPIL.slit) * open);
    return { width: pw, borderRadius: pw, left: cx - pw / 2, transform: [{ translateX: dx }, { translateY: dy }] };
  });
  // Dozing, the lids sit shut (a blink can't open them); sulking, half shut.
  const lidStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(f.get()[4], f.get()[7], f.get()[11] * 0.5) }] }));
  // Shut (asleep, or mid-blink), a curved lash line where the eye was.
  const lash = useAnimatedStyle(() => ({ opacity: Math.max(0, (Math.max(f.get()[4], f.get()[7]) - 0.7) / 0.3) }));
  return (
    <>
      <Animated.View style={[styles.pupil, { top: cy - ph / 2, height: ph }, pupil]} />
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
