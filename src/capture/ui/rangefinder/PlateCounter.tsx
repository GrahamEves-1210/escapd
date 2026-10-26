// The plate counter, Once's shot counter: a void pill (73 x 52.5,
// ref.radius.nested 20) that clips a strip of numerals in Crimson Text Italic
// (ref.type.counter 29/34, +1.75). ESCAPD's plate numerals, I to VI, sit
// `gap` apart; the strip is placed so the current numeral (the plate about to
// be taken) is centred, nudged by dx / dy for the italic's slant and the caps'
// centre. The current numeral is textPrimary; its neighbours are textDim,
// evenly, with no fade, cut by the pill's edges. Plate I has no left
// neighbour, VI none on the right; in retake mode the plate being retaken
// shows alone.
// - A new plate rolls the strip one numeral left over motion.counterRoll
//   while the old numeral dims and the new one brightens. Reduced motion: no
//   travel, the strip jumps and the two colours cross-fade over
//   motion.reducedFade.
// - The strip is placed from its numerals' measured boxes, so it stays
//   centred at every text size; until they are measured it is not drawn.
// - Display only, so it is no keyboard stop: on Android `accessible` would
//   make it keyboard-focusable, so there it is screenReaderFocusable instead,
//   and its texts stay out of Android's accessibility tree.
import { useEffect, useState } from "react";
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
import { PLATE_PROMPTS } from "@/capture/slots";
import { useTheme } from "@/theme/ThemeProvider";
import { curve, motion, ref } from "@/theme/tokens";

const C = ref.layout.camera.counter;
const NUMERALS = PLATE_PROMPTS.map((prompt) => prompt.numeral);
const INDICES = NUMERALS.map((_, i) => i);
const ROLL = timingFor(ref.motion.counterRoll);
const REDUCED = { duration: motion.reducedFade, reduceMotion: ReduceMotion.Never };
// Wide enough for every numeral side by side, so none is ever squeezed or wrapped.
const STRIP = C.width * NUMERALS.length;
// The pill's centre line, where the current numeral's box is centred.
const CENTRE = C.width / 2 + C.dx;
// iOS and the web add the tracking after the last glyph too; a leading pad of
// one step centres the glyphs in their box. Android splits it around each glyph.
const TRACKING_PAD = Platform.OS === "android" ? null : { paddingLeft: ref.type.counter.letterSpacing };

export interface PlateCounterProps {
  /** Index of the current numeral in PLATE_PROMPTS. */
  current: number;
  /** Retake mode: the current numeral alone. */
  solo: boolean;
  accessibilityLabel: string;
}

export function PlateCounter({ current, solo, accessibilityLabel }: PlateCounterProps) {
  const { reducedMotion } = useTheme();
  const [centres, setCentres] = useState<readonly (number | null)[]>(() => NUMERALS.map(() => null));
  const placed = centres.every((c) => c !== null);
  const centreLine = useSharedValue<number[]>(INDICES.map(() => 0));
  const pos = useSharedValue(current);

  useEffect(() => {
    if (placed) centreLine.set(centres as number[]);
  }, [centres, placed, centreLine]);

  useEffect(() => {
    pos.set(withTiming(current, reducedMotion ? REDUCED : ROLL));
  }, [current, reducedMotion, pos]);

  const onNumeral = (i: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    const centre = x + width / 2;
    setCentres((prev) => (prev[i] === centre ? prev : prev.map((c, j) => (j === i ? centre : c))));
  };

  const stripStyle = useAnimatedStyle(() => {
    const p = reducedMotion ? Math.round(pos.get()) : pos.get();
    return { transform: [{ translateX: CENTRE - interpolate(p, INDICES, centreLine.get()) }, { translateY: C.dy }] };
  });

  return (
    <View
      style={styles.pill}
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
        style={[styles.strip, placed ? null : styles.unplaced, stripStyle]}
        testID="plate-counter-strip"
      >
        {NUMERALS.map((numeral, i) => (
          <Numeral key={numeral} numeral={numeral} index={i} pos={pos} hidden={solo && i !== current} onLayout={onNumeral(i)} />
        ))}
      </Animated.View>
    </View>
  );
}

function Numeral({ numeral, index, pos, hidden, onLayout }: {
  numeral: string;
  index: number;
  pos: SharedValue<number>;
  hidden: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const style = useAnimatedStyle(() => {
    // 1 on the current numeral, falling to 0 one place away: the roll's colour.
    const lit = Math.max(0, 1 - Math.abs(pos.get() - index));
    return { color: interpolateColor(lit, [0, 1], [ref.color.textDim, ref.color.textPrimary]) };
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
    backgroundColor: ref.color.void,
    borderRadius: ref.radius.nested,
    ...curve,
  },
  strip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: STRIP,
    flexDirection: "row",
    alignItems: "center",
    gap: C.gap,
  },
  unplaced: { opacity: 0 },
  numeral: { ...ref.type.counter },
  hidden: { opacity: 0 },
});
