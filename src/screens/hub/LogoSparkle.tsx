// A small delight on home's ESCAPD logo (docs/ART_DIRECTION.md, spooky-cute):
// now and then a four-point glint blooms on one of its letters, in the shell's
// glow, turns a little and fades (SPARKLE in art/nook.ts). Decorative and
// never in the way: no touches, hidden from screen readers, and none at all
// under reduced motion.
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, withDelay } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import { SPARK_PATH, SPARKLE } from "./art/nook";

const QUARTER_TURN = SPARKLE.turn;
const PERCENT = SPARKLE.percent;

export function LogoSparkle({ color }: { color: string }) {
  const { reducedMotion } = useTheme();
  const [spot, setSpot] = useState(0);
  const bloom = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    let timer: ReturnType<typeof setTimeout>;
    const glint = (first: boolean) => {
      if (!first) setSpot((s) => (s + 1 + Math.floor(Math.random() * (SPARKLE.spots.length - 1))) % SPARKLE.spots.length);
      bloom.set(0);
      bloom.set(
        withSequence(
          withTiming(1, { duration: SPARKLE.rise, easing: Easing.out(Easing.quad) }),
          withDelay(SPARKLE.hold, withTiming(0, { duration: SPARKLE.fade, easing: Easing.in(Easing.quad) })),
        ),
      );
      timer = setTimeout(() => glint(false), SPARKLE.every + Math.random() * SPARKLE.spread);
    };
    timer = setTimeout(() => glint(true), SPARKLE.first);
    return () => clearTimeout(timer);
  }, [reducedMotion, bloom]);
  const style = useAnimatedStyle(() => ({
    opacity: bloom.get(),
    transform: [{ scale: bloom.get() }, { rotate: `${bloom.get() * QUARTER_TURN}deg` }],
  }));
  if (reducedMotion) return null;
  const at = SPARKLE.spots[spot];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="hub-logo-sparkle">
      <Animated.View
        style={[
          styles.spark,
          { left: `${at.x * PERCENT}%`, top: `${at.y * PERCENT}%`, marginLeft: -SPARKLE.size / 2, marginTop: -SPARKLE.size / 2 },
          style,
        ]}
      >
        <Svg width={SPARKLE.size} height={SPARKLE.size} viewBox="-1 -1 2 2">
          <Path d={SPARK_PATH} fill={color} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  spark: { position: "absolute" },
});
