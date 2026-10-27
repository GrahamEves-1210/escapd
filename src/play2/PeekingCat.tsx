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
//     a while it dozes off on the ledge, eyes shut, "z"s rising, until the
//     light moves again and it pops back up,
//   - now and then it ducks behind the ledge and peeks back up.
// It all moves at 12 frames a second, like stop motion: the animations run
// smoothly underneath, and what's drawn is a snapshot of them every 1/12 s.
// The art's own pupils are painted out (assets/characters/cat_peek.png); the
// pupils and eyelids are drawn over the eyes. Under reduced motion it sits
// still apart from its eyes.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { SparkleIcon } from "phosphor-react-native";
import Animated, {
  Easing, useAnimatedReaction, useAnimatedStyle, useFrameCallback, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useModeTheme } from "@/game/mode";
import { measureInWindow } from "@/render/PickupFlight";
import { useTheme } from "@/theme/ThemeProvider";

const ART = require("../../assets/characters/cat_peek.png") as number;
/** The art's size (px) and its eyes, as fractions of it. */
const ART_W = 560;
const ART_H = 585;
const EYES = [{ x: 0.3329, y: 0.5336 }, { x: 0.7061, y: 0.5336 }] as const;
const EYE_R = { x: 0.0949, y: 0.0833 };
/** Pupil width: a slit in the light, round in the dark (fractions of the art's width). */
const PUPIL = { slit: 0.026, wide: 0.085, h: 0.15 };
const FUR = "#0B0806";
/** Drawn at this many frames a second: stop motion. */
const FPS = 12;
/** It dozes off when the light has been still this long (ms). */
const DOZE_AFTER = 22000;

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

export type CatReaction = { kind: "found" | "wrong"; at: number } | null;
/** What the cat is doing between reactions: watching, or thinking along with the case. */
export type CatMood = "idle" | "thinking";

export function PeekingCat({ width, beamX, beamY, frame, reaction, mood = "idle" }: {
  /** On-screen width (points). */
  width: number;
  beamX: SharedValue<number>;
  beamY: SharedValue<number>;
  /** The room photo's frame in window points: where the beam's fractions land. */
  frame: { x: number; y: number; width: number; height: number } | null;
  /** The latest thing that happened, to react to (a new `at` each time). */
  reaction?: CatReaction;
  mood?: CatMood;
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

  /** A pop: crouch, stretch up, land with a squash, settle. */
  const pop = (up: number) => {
    "worklet";
    hop.set(withSequence(
      withTiming(height * 0.05, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 12, stiffness: 200 }),
    ));
    sy.set(withSequence(withTiming(0.84, { duration: 90 }), withTiming(1 + up, { duration: 150, easing: Easing.out(Easing.quad) }), withTiming(0.9, { duration: 110 }), withSpring(1, { damping: 6, stiffness: 180 })));
    sx.set(withSequence(withTiming(1.12, { duration: 90 }), withTiming(0.9, { duration: 150 }), withTiming(1.08, { duration: 110 }), withSpring(1, { damping: 6, stiffness: 180 })));
  };

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
          const to = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 5);
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
    } else {
      // Flinch: squashed down behind the ledge, a shiver, then back up.
      hop.set(withSequence(withTiming(height * 0.22, { duration: 90 }), withDelay(450, withSpring(0, { damping: 9, stiffness: 120 }))));
      sy.set(withSequence(withTiming(0.88, { duration: 90 }), withDelay(450, withSpring(1, { damping: 7, stiffness: 150 }))));
      sx.set(withSequence(withTiming(1.08, { duration: 90 }), withDelay(450, withSpring(1, { damping: 7, stiffness: 150 }))));
      idleTilt.set(withSequence(
        withTiming(-4, { duration: 50 }), withTiming(4, { duration: 50 }), withTiming(-3, { duration: 50 }), withTiming(3, { duration: 50 }),
        withSpring(0, { damping: 10, stiffness: 120 }),
      ));
      lid.set(withSequence(withTiming(0.55, { duration: 80 }), withDelay(500, withTiming(0, { duration: 160 }))));
    }
    // pop reads shared values only.
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

  // Everything the cat's drawn from, at 12 frames a second (indices: see the reads below).
  const f = useStopMotion(
    [rise, hop, breath, idleTilt, lid, sx, sy, doze, think, beamX, beamY],
    [reducedMotion ? 0 : height, 0, 0, 0, 0, 1, 1, 0, 0, 0.5, 0.5],
  );
  const body = useAnimatedStyle(() => {
    const [r, h, b, tilt, , squashX, squashY, z, t, bx] = f.get();
    let lean = 0;
    if (known) {
      const dx = fx + bx * fw - (ox + width / 2);
      lean = Math.max(-7, Math.min(7, dx / 40));
    }
    // Asleep it slumps lower and breathes deeper; thinking it sits up with its head cocked.
    const deep = 1 + z * 1.6;
    return {
      transform: [
        // Its paws stay on the ledge (the art ends there): a pop is a stretch up, never a lift off.
        { translateY: Math.max(0, r + h + (1 - b) * 1.5 + z * height * 0.14) },
        { rotate: `${lean * (1 - z) + tilt + t * 8 - z * 5}deg` },
        // Breathing: a little taller as it breathes in, a touch narrower; with the squash and stretch on top.
        { scaleY: squashY * (1 + b * 0.025 * deep) * (1 + t * 0.05) },
        { scaleX: squashX * (1 - b * 0.012 * deep) },
      ],
    };
  });

  // A find's sparkles play once per find (they end invisible).
  const burst = reaction?.kind === "found" ? reaction.at : null;
  const mark = { color: theme.ink, fontFamily: theme.display.fontFamily };
  return (
    <View pointerEvents="none" style={{ width: width * 1.3, height: height * 1.25 }}>
    {/* Its marks float above its head, outside the ledge's clip. */}
    <View style={[styles.marks, { left: width * 0.55, bottom: height * 0.8, width: width, height: height }]}>
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
      {burst !== null && !reducedMotion ? <View style={{ transform: [{ translateX: -width * 0.35 }] }}><Burst key={burst} size={width} color={theme.ink} glyph={mark} /></View> : null}
    </View>
    {/* The ledge hides what's below it: the cat rises from behind it. */}
    <View style={[styles.clip, StyleSheet.absoluteFill]}>
      <Animated.View
        ref={viewRef}
        onLayout={() => measureInWindow(viewRef.current).then((r) => r && setOrigin({ x: r.x, y: r.y }))}
        style={[styles.cat, { width, height, left: width * 0.15 }, body]}
        accessible
        accessibilityLabel="A black cat watches your light"
        testID="v2-cat"
      >
        <Image source={ART} style={{ position: "absolute", left: 0, top: 0, width, height }} resizeMode="contain" />
        {EYES.map((eye, i) => (
          <Eye key={i} eye={eye} width={width} height={height} known={known} at={{ ox, oy, fx, fy, fw, fh }} f={f} />
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

/** A find: sparkles burst out around its head and an "!" pops up, once. */
export function Burst({ size, color, glyph }: { size: number; color: string; glyph: { color: string; fontFamily?: string } }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [t]);
  const shown = useStopMotion([t], [0]);
  const bang = useAnimatedStyle(() => {
    const p = shown.get()[0];
    return {
      opacity: p > 0.75 ? (1 - p) / 0.25 : 1,
      transform: [{ translateY: -p * size * 0.5 }, { scale: p < 0.2 ? (p / 0.2) * 1.3 : 1.3 - Math.min(1, (p - 0.2) / 0.2) * 0.3 }],
    };
  });
  return (
    <>
      {[-0.9, -0.35, 0.35, 0.9].map((a, i) => (
        <Spark key={i} t={shown} angle={a - Math.PI / 2} reach={size * (0.55 + (i % 2) * 0.2)} size={size * (i % 2 ? 0.24 : 0.32)} color={color} />
      ))}
      <Animated.View style={[styles.mark, bang]}>
        <Text allowFontScaling={false} style={[styles.markText, glyph, { fontSize: size * 0.6, lineHeight: size * 0.7 }]}>!</Text>
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

function Eye({ eye, width, height, known, at, f }: {
  eye: { x: number; y: number }; width: number; height: number; known: boolean;
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
    const [, , , , , , , , t, beamX, beamY] = f.get();
    let dx = 0, dy = 0, open = 1;
    if (known) {
      const bx = at.fx + beamX * at.fw - (at.ox + cx);
      const by = at.fy + beamY * at.fh - (at.oy + cy);
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
  // Dozing, the lids sit shut (a blink can't open them).
  const lidStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(f.get()[4], f.get()[7]) }] }));
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
});
