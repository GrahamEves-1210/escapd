// The build wait's title, with the old status line's shimmer (the kit's
// ThinkingStates: a band of light sweeping the glyphs left to right) on the
// mode's display face, and turning over to the next short line every few
// seconds: the outgoing line rises and fades as the next rises in behind it,
// the old line's swap.
//
// The sweep is drawn without a mask (the display faces are custom fonts, which
// SVG text can't be trusted to find on a phone): the line in its base colour,
// and over it the same line in the highlight, seen only through a few nested
// windows riding across it, narrower ones brighter, so the band has soft
// edges. Transforms only, on the UI thread.
//
// Screen readers hear one stable title (`label`): the turning lines are hidden.
// Reduced motion: no sweep, no rise; the lines still turn, by a short fade.
import { useEffect, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type TextStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  Keyframe,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { motion, ref } from "@/theme/tokens";

const T = ref.motion.thinking;

/** The sweep and the turn (ms, points). */
export const SHIMMER_TITLE = {
  /** Each line holds this long before the next. */
  hold: 2600,
  /** The band crosses the line in `sweep`, then rests `rest` before the next pass. */
  sweep: 1700,
  rest: 700,
  /** The band's full width, and its windows: their share of it, each adding `alpha` of the highlight. */
  band: 120,
  windows: [1, 0.68, 0.4, 0.18] as readonly number[],
  alpha: 0.34,
} as const;

const ENTER = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: T.distance }] },
  to: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.inOut(Easing.ease) },
})
  .duration(T.swap)
  .delay(T.gap)
  .reduceMotion(ReduceMotion.Never);
const EXIT = new Keyframe({
  from: { opacity: 1, transform: [{ translateY: 0 }] },
  to: { opacity: 0, transform: [{ translateY: -T.distance }], easing: Easing.inOut(Easing.ease) },
})
  .duration(T.swap)
  .reduceMotion(ReduceMotion.Never);
const FADE_IN = FadeIn.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never);
const FADE_OUT = FadeOut.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never);

export function ShimmerTitle({ lines, label, type, base, highlight, still, reduced, testID }: {
  /** The lines it turns through; one line doesn't turn. */
  lines: readonly string[];
  /** What screen readers hear, whichever line shows. */
  label: string;
  /** The display face, its size and line height. */
  type: TextStyle;
  /** The line's colour under the sweep, the sweep's, and the line's own with reduced motion. */
  base: string;
  highlight: string;
  still: string;
  reduced: boolean;
  testID?: string;
}) {
  const [tick, setTick] = useState(0);
  const turning = lines.length > 1;
  useEffect(() => {
    if (!turning) return;
    const id = setInterval(() => setTick((t) => t + 1), SHIMMER_TITLE.hold);
    return () => clearInterval(id);
  }, [turning]);
  const index = turning ? tick % lines.length : 0;
  const text = lines[index] ?? "";

  // The band's centre, from off the left edge to off the right, then a rest.
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const c = useSharedValue(-SHIMMER_TITLE.band);
  useEffect(() => {
    if (reduced || width <= 0) {
      cancelAnimation(c);
      return;
    }
    const { band, sweep, rest } = SHIMMER_TITLE;
    c.set(-band);
    c.set(withRepeat(withSequence(withTiming(width + band, { duration: sweep, easing: Easing.inOut(Easing.quad) }), withDelay(rest, withTiming(-band, { duration: 0 }))), -1, false));
    return () => cancelAnimation(c);
  }, [reduced, width, c]);

  const lineHeight = (type.lineHeight as number | undefined) ?? Math.round(((type.fontSize as number | undefined) ?? 16) * 1.3);
  return (
    <View
      style={[styles.box, { height: lineHeight }]}
      onLayout={onLayout}
      accessible
      accessibilityRole="header"
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View key={`${index}:${text}`} entering={reduced ? FADE_IN : ENTER} exiting={reduced ? FADE_OUT : EXIT} style={StyleSheet.absoluteFill}>
          <Text1 text={text} type={type} color={reduced ? still : base} testID={testID ? `${testID}-line` : undefined} />
          {!reduced && width > 0
            ? SHIMMER_TITLE.windows.map((k) => <Window key={k} share={k} c={c} width={width} text={text} type={type} color={highlight} />)
            : null}
        </Animated.View>
      </View>
    </View>
  );
}

function Text1({ text, type, color, testID }: { text: string; type: TextStyle; color: string; testID?: string }) {
  return (
    <Animated.Text style={[type, styles.line, { color }]} numberOfLines={1} testID={testID}>
      {text}
    </Animated.Text>
  );
}

/** The highlight, seen through a window `share` of the band wide, centred on the band. */
function Window({ share, c, width, text, type, color }: { share: number; c: SharedValue<number>; width: number; text: string; type: TextStyle; color: string }) {
  const w = SHIMMER_TITLE.band * share;
  const frame = useAnimatedStyle(() => ({ transform: [{ translateX: c.get() - w / 2 }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ translateX: -(c.get() - w / 2) }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.window, { width: w, opacity: SHIMMER_TITLE.alpha }, frame]}>
      <Animated.View style={[styles.inner, { width }, inner]}>
        <Text1 text={text} type={type} color={color} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: "stretch" },
  line: { position: "absolute", left: 0, right: 0, top: 0, textAlign: "center" },
  window: { position: "absolute", left: 0, top: 0, bottom: 0, overflow: "hidden" },
  inner: { position: "absolute", left: 0, top: 0, bottom: 0 },
});
