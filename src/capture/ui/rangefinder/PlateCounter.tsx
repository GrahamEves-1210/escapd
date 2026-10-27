// The plate counter, Once's shot counter: a void pill (73 x 52.5,
// ref.radius.nested 20) that clips a strip of numerals in Crimson Text Italic
// (ref.type.counter 29/34, +1.75). ESCAPD's photo numerals, 1 to the roll
// plan's count (5 on 0.5x, 6 on 1x), sit `gap` apart; the strip is placed so the current numeral (the plate about to
// be taken) is centred, nudged by dx / dy for the italic's slant and the caps'
// centre. The current numeral is textPrimary; its neighbours are textDim,
// evenly, with no fade, cut by the pill's edges. Photo 1 has no left
// neighbour, the last none on the right; in retake mode the photo being
// retaken shows alone.
// - A new plate rolls the strip one numeral left over motion.counterRoll
//   while the old numeral dims and the new one brightens. Reduced motion: no
//   travel, the strip jumps and the two colours cross-fade over
//   motion.reducedFade.
// - The strip is placed from its numerals' measured boxes, so it stays
//   centred at every text size; until they are measured it is not drawn.
// - Display only, so it is no keyboard stop: on Android `accessible` would
//   make it keyboard-focusable, so there it is screenReaderFocusable instead,
//   and its texts stay out of Android's accessibility tree.
// - In a mode: the pill in the mode's well and the current numeral in the
//   mode's stamp colour, the camera's one touch of it (src/capture/ui/palette.ts).
import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  ReduceMotion,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { timingFor } from "@/components/noir";
import { useTheme } from "@/theme/ThemeProvider";
import { curve, motion, ref } from "@/theme/tokens";
import { useCapturePalette } from "../palette";

const C = ref.layout.camera.counter;
const ROLL = timingFor(ref.motion.counterRoll);
const REDUCED = { duration: motion.reducedFade, reduceMotion: ReduceMotion.Never };
// The pill's centre line, where the current numeral's box is centred.
const CENTRE = C.width / 2 + C.dx;
// iOS and the web add the tracking after the last glyph too; a leading pad of
// one step centres the glyphs in their box. Android splits it around each glyph.
const TRACKING_PAD = Platform.OS === "android" ? null : { paddingLeft: ref.type.counter.letterSpacing };

export interface PlateCounterProps {
  /** Index of the current numeral (the photo's slot). */
  current: number;
  /** Photos in the roll's plan: numerals 1 to this. */
  count: number;
  /** Retake mode: the current numeral alone. */
  solo: boolean;
  accessibilityLabel: string;
}

export function PlateCounter({ current, count, solo, accessibilityLabel }: PlateCounterProps) {
  const { reducedMotion } = useTheme();
  const palette = useCapturePalette();
  const numerals = useMemo(() => Array.from({ length: count }, (_, i) => String(i + 1)), [count]);
  // Measured centres by index; a numeral the plan drops keeps its old entry, unused.
  const [centres, setCentres] = useState<readonly (number | null)[]>(() => numerals.map(() => null));
  const shown = useMemo(() => numerals.map((_, i) => centres[i] ?? null), [numerals, centres]);
  const placed = shown.every((c) => c !== null);
  // Each numeral's index and its measured centre, set together so the two always match in length.
  const centreLine = useSharedValue<{ at: number[]; centre: number[] }>({ at: numerals.map((_, i) => i), centre: numerals.map(() => 0) });
  const pos = useSharedValue(current);

  useEffect(() => {
    if (placed) centreLine.set({ at: shown.map((_, i) => i), centre: shown as number[] });
  }, [shown, placed, centreLine]);

  useEffect(() => {
    pos.set(withTiming(current, reducedMotion ? REDUCED : ROLL));
  }, [current, reducedMotion, pos]);

  const onNumeral = (i: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    const centre = x + width / 2;
    setCentres((prev) => {
      if (prev[i] === centre) return prev;
      const next = [...prev];
      next[i] = centre;
      return next;
    });
  };

  const stripStyle = useAnimatedStyle(() => {
    const p = reducedMotion ? Math.round(pos.get()) : pos.get();
    const line = centreLine.get();
    return { transform: [{ translateX: CENTRE - interpolate(p, line.at, line.centre) }, { translateY: C.dy }] };
  });

  return (
    <View
      style={[styles.pill, { backgroundColor: palette.well }]}
      accessible={Platform.OS === "ios"}
      screenReaderFocusable
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      testID="plate-counter"
    >
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        // Wide enough for every numeral side by side, so none is ever squeezed or wrapped.
        style={[styles.strip, { width: C.width * count }, placed ? null : styles.unplaced, stripStyle]}
        testID="plate-counter-strip"
      >
        {numerals.map((numeral, i) => (
          <Numeral key={numeral} numeral={numeral} index={i} pos={pos} lit={palette.lit} hidden={solo && i !== current} onLayout={onNumeral(i)} />
        ))}
      </Animated.View>
    </View>
  );
}

function Numeral({ numeral, index, pos, lit: litColor, hidden, onLayout }: {
  numeral: string;
  index: number;
  pos: SharedValue<number>;
  /** The current numeral's colour. */
  lit: string;
  hidden: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const style = useAnimatedStyle(() => {
    // 1 on the current numeral, falling to 0 one place away: the roll's colour.
    const lit = Math.max(0, 1 - Math.abs(pos.get() - index));
    return { color: interpolateColor(lit, [0, 1], [ref.color.textDim, litColor]) };
  });
  return (
    <Animated.Text
      onLayout={onLayout}
      style={[styles.numeral, TRACKING_PAD, style, hidden ? styles.hidden : null]}
      maxFontSizeMultiplier={C.maxFontScale}
      importantForAccessibility="no"
    >
      {numeral}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: C.width,
    height: C.height,
    overflow: "hidden",
    borderRadius: ref.radius.nested,
    ...curve,
  },
  strip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: C.gap,
  },
  unplaced: { opacity: 0 },
  numeral: { ...ref.type.counter },
  hidden: { opacity: 0 },
});
