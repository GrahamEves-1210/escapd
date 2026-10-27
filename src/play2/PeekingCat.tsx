// The cat: Escapd's black cat, peering over the bottom edge of the room with
// its paws on the ledge. Its art never changes; it moves like a character:
//   - it rises from behind the ledge with a springy overshoot,
//   - it breathes (a slow squash and stretch), blinks now and then, and
//     tilts its head toward the light,
//   - its slit pupils follow the flashlight's beam, opening wide in the dark
//     and narrowing to slits as the light comes near,
//   - it reacts: a happy hop when the player finds something, a flinch and a
//     quick duck when they get something wrong (`reaction` changes).
// The art's own pupils are painted out (assets/characters/cat_peek.png); the
// pupils and eyelids are drawn over the eyes. Under reduced motion it sits
// still apart from its eyes.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from "react-native-reanimated";
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

export type CatReaction = { kind: "found" | "wrong"; at: number } | null;

export function PeekingCat({ width, beamX, beamY, frame, reaction }: {
  /** On-screen width (points). */
  width: number;
  beamX: SharedValue<number>;
  beamY: SharedValue<number>;
  /** The room photo's frame in window points: where the beam's fractions land. */
  frame: { x: number; y: number; width: number; height: number } | null;
  /** The latest thing that happened, to react to (a new `at` each time). */
  reaction?: CatReaction;
}) {
  const { reducedMotion } = useTheme();
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

  useEffect(() => {
    if (reducedMotion) return;
    rise.set(withDelay(500, withSpring(0, { damping: 9, stiffness: 120, mass: 0.8 })));
    breath.set(withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reducedMotion, rise, breath]);

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
      if (!reducedMotion) {
        const to = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 5);
        idleTilt.set(withSequence(withSpring(to, { damping: 7, stiffness: 90 }), withDelay(900, withSpring(0, { damping: 10, stiffness: 80 }))));
      }
      tilt = setTimeout(doTilt, 6000 + Math.random() * 7000);
    };
    blink = setTimeout(doBlink, 1800);
    tilt = setTimeout(doTilt, 4500);
    return () => {
      clearTimeout(blink);
      clearTimeout(tilt);
    };
  }, [lid, idleTilt, reducedMotion]);

  // Reactions.
  useEffect(() => {
    if (!reaction || reducedMotion) return;
    if (reaction.kind === "found") {
      hop.set(withSequence(withTiming(-height * 0.16, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 6, stiffness: 160 })));
    } else {
      hop.set(withSequence(withTiming(height * 0.22, { duration: 90 }), withDelay(450, withSpring(0, { damping: 9, stiffness: 120 }))));
      lid.set(withSequence(withTiming(0.55, { duration: 80 }), withDelay(500, withTiming(0, { duration: 160 }))));
    }
  }, [reaction, reducedMotion, hop, lid, height]);

  // The light's position against the cat (window points), for the lean and the pupils.
  const ox = origin?.x ?? 0, oy = origin?.y ?? 0;
  const fx = frame?.x ?? 0, fy = frame?.y ?? 0, fw = frame?.width ?? 0, fh = frame?.height ?? 0;
  const known = !!origin && !!frame;

  const body = useAnimatedStyle(() => {
    const b = breath.get();
    let lean = 0;
    if (known) {
      const dx = fx + beamX.get() * fw - (ox + width / 2);
      lean = Math.max(-7, Math.min(7, dx / 40));
    }
    return {
      transform: [
        { translateY: rise.get() + hop.get() + (1 - b) * 1.5 },
        { rotate: `${lean + idleTilt.get()}deg` },
        // Breathing: a little taller as it breathes in, a touch narrower.
        { scaleY: 1 + b * 0.025 },
        { scaleX: 1 - b * 0.012 },
      ],
    };
  });

  return (
    // The ledge hides what's below it: the cat rises from behind it.
    <View style={[styles.clip, { width: width * 1.3, height: height * 1.25 }]} pointerEvents="none">
      <Animated.View
        ref={viewRef}
        onLayout={() => measureInWindow(viewRef.current).then((r) => r && setOrigin({ x: r.x, y: r.y }))}
        style={[styles.cat, { width, height, left: width * 0.15 }, body]}
        accessible
        accessibilityLabel="A black cat watches your light"
        testID="v2-cat"
      >
        <Image source={ART} style={StyleSheet.absoluteFill} resizeMode="contain" />
        {EYES.map((eye, i) => (
          <Eye key={i} eye={eye} width={width} height={height} known={known} at={{ ox, oy, fx, fy, fw, fh }} beamX={beamX} beamY={beamY} lid={lid} />
        ))}
      </Animated.View>
    </View>
  );
}

function Eye({ eye, width, height, known, at, beamX, beamY, lid }: {
  eye: { x: number; y: number }; width: number; height: number; known: boolean;
  at: { ox: number; oy: number; fx: number; fy: number; fw: number; fh: number };
  beamX: SharedValue<number>; beamY: SharedValue<number>; lid: SharedValue<number>;
}) {
  const cx = eye.x * width;
  const cy = eye.y * height;
  const ew = EYE_R.x * width * 2.1;
  const eh = EYE_R.y * height * 2.2;
  const ph = height * PUPIL.h;
  const rangeX = width * EYE_R.x * 0.55;
  const rangeY = height * EYE_R.y * 0.35;
  const pupil = useAnimatedStyle(() => {
    let dx = 0, dy = 0, open = 1;
    if (known) {
      const bx = at.fx + beamX.get() * at.fw - (at.ox + cx);
      const by = at.fy + beamY.get() * at.fh - (at.oy + cy);
      const d = Math.hypot(bx, by) || 1;
      const pull = Math.min(1, d / 160);
      dx = (bx / d) * rangeX * pull;
      dy = (by / d) * rangeY * pull;
      // Near the light the pupil narrows to a slit; far off, in the dark, it opens wide.
      open = Math.max(0, Math.min(1, (d - 120) / 380));
    }
    const pw = width * (PUPIL.slit + (PUPIL.wide - PUPIL.slit) * open);
    return { width: pw, borderRadius: pw, left: cx - pw / 2, transform: [{ translateX: dx }, { translateY: dy }] };
  });
  const lidStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: lid.get() }] }));
  return (
    <>
      <Animated.View style={[styles.pupil, { top: cy - ph / 2, height: ph }, pupil]} />
      {/* The eyelid closes from the top down over the eye. */}
      <Animated.View style={[styles.lid, { left: cx - ew / 2, top: cy - eh / 2, width: ew, height: eh, borderRadius: ew / 2 }, lidStyle]} />
    </>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden", justifyContent: "flex-end" },
  cat: { position: "absolute", bottom: 0 },
  pupil: { position: "absolute", backgroundColor: FUR },
  lid: { position: "absolute", backgroundColor: FUR, transformOrigin: "50% 0%" },
});
