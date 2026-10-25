// The dither loader (DESIGN.md, Loading indicators): a 4 x 4 Bayer dissolve,
// like a halftone developing. For a short screen-level wait with no status
// line (05 Loading). Never shares a wait with another indicator.
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { timingFor } from "./motion";

const D = ref.motion.dither;
const CELL = (D.size - (D.grid - 1) * D.gap) / D.grid;
const CELLS = D.grid * D.grid;
// Each cell runs min to max and back over one cycle: half up, half down.
const HALF_CYCLE = timingFor({ duration: D.duration / 2, easing: D.easing });
// Order k starts k / 16 of a cycle late (62.5 ms per step).
const STEP = D.duration / CELLS;

/**
 * Bayer order for an n x n grid (n a power of two), built by doubling the
 * 2 x 2 seed. For n = 4 this is DESIGN.md's row-major
 * [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].
 */
function bayerOrder(n: number): number[] {
  const seed = [
    [0, 2],
    [3, 1],
  ];
  let m = [[0]];
  while (m.length < n) {
    const size = m.length;
    const prev = m;
    m = Array.from({ length: size * 2 }, (_, y) =>
      Array.from({ length: size * 2 }, (_, x) => prev[y % size][x % size] * seed.length * seed.length + seed[Math.floor(y / size)][Math.floor(x / size)]),
    );
  }
  return m.flat();
}

const ORDER = bayerOrder(D.grid);

export interface DitherProps {
  /**
   * Wait this long (ms) before showing anything, so a faster wait shows
   * nothing. DESIGN.md asks for 300 ms; no shared token holds it, so pass it
   * from your screen's ref.layout block. Default 0.
   */
  showDelay?: number;
  /** Default "Loading". The wait is indeterminate, so there is no value. */
  accessibilityLabel?: string;
  testID?: string;
  /** Position only (centre it in the area that is loading, on flat ground). */
  style?: StyleProp<ViewStyle>;
}

/**
 * Mount it when the wait starts and unmount it the moment the wait ends; there
 * is no exit animation. Reduced motion: a static checkerboard.
 */
export function Dither({ showDelay = 0, accessibilityLabel = "Loading", testID, style }: DitherProps) {
  const { reducedMotion } = useTheme();
  const [shown, setShown] = useState(showDelay <= 0);
  useEffect(() => {
    if (showDelay <= 0) return;
    const id = setTimeout(() => setShown(true), showDelay);
    return () => clearTimeout(id);
  }, [showDelay]);

  if (!shown) return <View testID={testID} pointerEvents="none" style={[styles.box, style]} />;

  return (
    <View
      testID={testID}
      // One element on iOS. On Android `accessible` would also make it a
      // keyboard and D-pad focus stop (ReactViewManager.setAccessible sets
      // isFocusable; focusable={false} below can't undo it), and the dither
      // never takes focus, so TalkBack reads it through screenReaderFocusable.
      accessible={Platform.OS === "ios"}
      screenReaderFocusable
      importantForAccessibility="yes"
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      focusable={false}
      pointerEvents="none"
      style={[styles.box, style]}
    >
      {ORDER.map((order, i) => (
        <DitherCell key={i} index={i} order={order} still={reducedMotion} />
      ))}
    </View>
  );
}

function DitherCell({ index, order, still }: { index: number; order: number; still: boolean }) {
  const opacity = useSharedValue<number>(D.min);
  useEffect(() => {
    if (still) {
      // Lit where row + column is even: orders below half the grid.
      opacity.set(order < CELLS / 2 ? D.max : D.min);
      return;
    }
    opacity.set(D.min);
    opacity.set(withDelay(order * STEP, withRepeat(withTiming(D.max, HALF_CYCLE), -1, true)));
    return () => cancelAnimation(opacity);
  }, [opacity, order, still]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const row = Math.floor(index / D.grid);
  const col = index % D.grid;
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.cell, { top: row * (CELL + D.gap), left: col * (CELL + D.gap) }, style]}
    />
  );
}

const styles = StyleSheet.create({
  box: { width: D.size, height: D.size },
  cell: { position: "absolute", width: CELL, height: CELL, backgroundColor: D.color },
});
