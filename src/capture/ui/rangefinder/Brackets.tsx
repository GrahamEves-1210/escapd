// The viewfinder's four corner brackets: ESCAPD's bracket language, the same as
// hotspots in play. Bright, 22 arms, 1.5 stroke, butt ends and a mitred corner,
// inset ref.space.lg from each frame edge. Hidden until the camera is ready,
// then they settle together: each starts bracketTravel further out along its
// diagonal and moves in over motion.bracketSettle, fading in over bracketFade.
// No hold or dim afterwards. Reduced motion: a motion.reducedFade fade, no travel.
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { timingFor } from "@/components/noir";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";

const L = ref.layout.camera;
const SETTLE = timingFor({ duration: motion.bracketSettle, easing: L.bracketEasing });
const FADE = timingFor({ duration: L.bracketFade, easing: L.bracketEasing });
const REDUCED_FADE = { duration: motion.reducedFade, reduceMotion: ReduceMotion.Never };

/** Each corner moves out along its own diagonal: -1 toward the left or top edge, 1 toward the right or bottom. */
const CORNERS = [
  { key: "tl", dx: -1, dy: -1 },
  { key: "tr", dx: 1, dy: -1 },
  { key: "bl", dx: -1, dy: 1 },
  { key: "br", dx: 1, dy: 1 },
] as const;

type CornerKey = (typeof CORNERS)[number]["key"];

export function Brackets({ settled }: { settled: boolean }) {
  const { reducedMotion } = useTheme();
  const opacity = useSharedValue(0);
  const travel = useSharedValue<number>(L.bracketTravel);

  useEffect(() => {
    if (!settled) return;
    if (reducedMotion) {
      travel.set(0);
      opacity.set(withTiming(1, REDUCED_FADE));
      return;
    }
    travel.set(withTiming(0, SETTLE));
    opacity.set(withTiming(1, FADE));
  }, [settled, reducedMotion, opacity, travel]);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {CORNERS.map((corner) => (
        <Corner key={corner.key} corner={corner.key} dx={corner.dx} dy={corner.dy} opacity={opacity} travel={travel} />
      ))}
    </View>
  );
}

function Corner({ corner, dx, dy, opacity, travel }: {
  corner: CornerKey;
  dx: number;
  dy: number;
  opacity: SharedValue<number>;
  travel: SharedValue<number>;
}) {
  const animated = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: dx * travel.get() }, { translateY: dy * travel.get() }],
  }));
  return <Animated.View testID={`bracket-${corner}`} style={[styles.corner, styles[corner], animated]} />;
}

const INSET = ref.space.lg;
const STROKE = L.bracketStroke;

const styles = StyleSheet.create({
  // Two borders of one box meet in a square (mitred) corner; their ends are butt.
  corner: { position: "absolute", width: L.bracketArm, height: L.bracketArm, borderColor: ref.color.bright },
  tl: { top: INSET, left: INSET, borderTopWidth: STROKE, borderLeftWidth: STROKE },
  tr: { top: INSET, right: INSET, borderTopWidth: STROKE, borderRightWidth: STROKE },
  bl: { bottom: INSET, left: INSET, borderBottomWidth: STROKE, borderLeftWidth: STROKE },
  br: { bottom: INSET, right: INSET, borderBottomWidth: STROKE, borderRightWidth: STROKE },
});
