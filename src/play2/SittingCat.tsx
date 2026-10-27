// The cat, sitting (assets/characters/cat_sit.png): for the way out and case
// closed. It moves as the peeking cat does, at 12 frames a second: it pops up
// with a squash and stretch and a burst of sparkles (`cheer` changes for
// another), breathes, and now and then gives a little happy hop. Its art never
// changes. Under reduced motion it simply sits.
import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { Burst, useStopMotion } from "./PeekingCat";

const ART = require("../../assets/characters/cat_sit.png") as number;
const ASPECT = 640 / 444;

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
  const [burst, setBurst] = useState<number | null>(null);

  // A pop: crouch, stretch up, land squashed, settle.
  const bounce = (wait: number) => {
    sy.set(withDelay(wait, withSequence(withTiming(0.86, { duration: 90 }), withTiming(1.16, { duration: 150 }), withTiming(0.92, { duration: 110 }), withSpring(1, { damping: 6, stiffness: 180 }))));
    sx.set(withDelay(wait, withSequence(withTiming(1.1, { duration: 90 }), withTiming(0.9, { duration: 150 }), withTiming(1.06, { duration: 110 }), withSpring(1, { damping: 6, stiffness: 180 }))));
  };

  useEffect(() => {
    if (reducedMotion) return;
    pop.set(withDelay(delay, withSpring(1, { damping: 9, stiffness: 140 })));
    bounce(delay);
    breath.set(withDelay(delay, withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }), -1, true)));
    const t = setTimeout(() => setBurst(Date.now()), delay + 150);
    // A happy hop now and then.
    let hop: ReturnType<typeof setTimeout>;
    const again = () => {
      bounce(0);
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
    const t = setTimeout(() => setBurst(Date.now()), 150);
    return () => clearTimeout(t);
    // bounce reads shared values only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheer, reducedMotion]);

  const f = useStopMotion([pop, sx, sy, breath], [reducedMotion ? 1 : 0, 1, 1, 0]);
  const style = useAnimatedStyle(() => {
    const [p, x, y, b] = f.get();
    return {
      opacity: Math.min(1, p * 3),
      transform: [
        { translateY: (1 - p) * height * 0.25 },
        { scaleX: x * p * (1 - b * 0.012) },
        { scaleY: y * p * (1 + b * 0.02) },
      ],
    };
  });

  return (
    <View style={{ width, height }} pointerEvents="none">
      <Animated.View style={[styles.cat, { width, height }, style]} accessible accessibilityLabel={label} testID="sitting-cat">
        <Image source={ART} style={{ width, height }} resizeMode="contain" />
      </Animated.View>
      {burst !== null && !reducedMotion ? (
        <View style={[styles.burst, { left: width * 0.5, top: height * 0.12 }]}>
          <Burst key={burst} size={width * 0.7} color={theme.accent} glyph={{ color: theme.accent, fontFamily: theme.display.fontFamily }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cat: { transformOrigin: "50% 100%" },
  burst: { position: "absolute", width: 0, height: 0, alignItems: "center" },
});
