// 06 · The painted glass over the darkroom's plates: the wait's
// indicator. While it is mounted it drifts in a slow figure-eight on the UI
// thread, leaning a little toward each side, as if examining the plates.
// Mount it only while a real wait runs: unmounting cancels the drift, with no
// final pass. Reduced motion: it holds still and level at the path's centre.
// Decorative: hidden from screen readers; the thinking line carries the status.
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { timingFor } from "@/components/noir";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";

const L = ref.layout.develop;
const { size, lensX, lensY } = L.glass;
const DRIFT = L.drift;
// The 96 pt set: the platform picks @2x or @3x.
const GLASS = require("../../../assets/brand/magnifier.png");
// One loop of the phase, 0 to 1; withRepeat restarts it from 0, where the path closes.
const LOOP = timingFor(DRIFT);
const TURN = 2 * Math.PI;

/** The lens centre's rest point: the middle of the tiles, below the strip's top (stage.stripTop) and the numerals over them. */
export const GLASS_CENTRE_Y = L.stage.stripTop + L.plate.label.lineHeight + L.plate.labelGap + L.plate.size / 2;

export function DarkroomGlass({ testID = "darkroom-glass" }: { testID?: string }) {
  const { reducedMotion } = useTheme();
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.set(0);
    if (reducedMotion) return;
    phase.set(withRepeat(withTiming(1, LOOP), -1, false));
    return () => cancelAnimation(phase);
  }, [phase, reducedMotion]);

  // Phase 0 is the still pose (no offset, no lean), so the drift starts from rest.
  const drift = useAnimatedStyle(() => {
    const t = phase.get() * TURN;
    return {
      transform: [
        { translateX: DRIFT.x * Math.sin(t) },
        { translateY: DRIFT.y * Math.sin(2 * t) },
        { rotate: `${DRIFT.tilt * Math.sin(t)}deg` },
      ],
    };
  });

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.glass, drift]}
    >
      <Image source={GLASS} contentFit="contain" style={styles.image} accessible={false} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Placed so the lens centre sits on the stage's centre line at GLASS_CENTRE_Y; it leans about the lens centre.
  glass: {
    position: "absolute",
    left: "50%",
    marginLeft: -size * lensX,
    top: GLASS_CENTRE_Y - size * lensY,
    width: size,
    height: size,
    transformOrigin: [size * lensX, size * lensY, 0],
  },
  image: { width: size, height: size },
});
