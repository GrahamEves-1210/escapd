// The cat, sitting (assets/characters/cat_sit.png): on home's window sill,
// for the way out and case closed. It moves as the peeking cat does, at 12
// frames a second: it pops up with a squash and stretch and a burst of
// sparkles in the mode's sweet colour (`cheer` changes for another),
// breathes, and now and then gives a little happy hop. It likes being
// stroked as the peeking cat does (usePetting): a hand on it and it shuts its
// eyes (lids drawn over the art's) with a small flinch; rubbed, it leans into
// the hand, sways and purrs (a fine shiver, a soft beat in the hand, "prr");
// let go, its eyes open slowly with a content blink. Rough, quick taps and it
// pulls away from the hand for a while. Its art never changes. Under reduced
// motion it simply sits (its eyes still shut for a hand, and the "prr" shows).
import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { Burst, PetLayer, Purr, pettingMotion, usePetting, useStopMotion } from "./PeekingCat";

const ART = require("../../assets/characters/cat_sit.png") as number;
const ASPECT = 640 / 444;
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
  burst: { position: "absolute", width: 0, height: 0, alignItems: "center" },
  // Scaled from its top edge, as a lid closes (over the eye's whole box, so it never needs the head's tilt).
  lid: { position: "absolute", backgroundColor: FUR, transformOrigin: "50% 0%" },
  lash: { position: "absolute", borderColor: "rgba(232, 170, 60, 0.8)" },
});
