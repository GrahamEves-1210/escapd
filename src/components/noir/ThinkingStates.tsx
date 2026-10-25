// Thinking states (DESIGN.md, Global tokens): the status line for a real wait,
// with the user's shimmer as its glyph layer. Lines hold, then the outgoing
// line rises 8 and fades as the next rises in from 8 below, 50 ms behind it.
// A highlight band 0.8 x the line's width sweeps the glyphs left to right.
// No blur (Noir has none). Reduced motion, or a line that wraps at the
// player's text size: plain Text in read, swapped with a 140 ms cross-fade.
import { useEffect, useId, useRef, useState, type Ref } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type HostInstance,
  type TextLayoutEvent,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  Keyframe,
  LayoutAnimationConfig,
  ReduceMotion,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref, type as liveType } from "@/theme/tokens";
import { timingFor, toEasing } from "./motion";

const T = ref.motion.thinking;
const SHIMMER = T.shimmer;

// "noir" (Geist, meta to bright) or "warm": the play screen's own type and warm
// text colours, for the screens that follow its look (hub, guide, Pro).
export type ThinkingTone = "noir" | "warm";
const TONES = {
  noir: { base: SHIMMER.base, highlight: SHIMMER.highlight, still: ref.color.read },
  warm: { base: T.shimmerWarm.base, highlight: T.shimmerWarm.highlight, still: T.shimmerWarm.still },
} as const;
type ToneColors = (typeof TONES)[ThinkingTone];
const WARM_TYPE = { meta: liveType.caption, body: liveType.body, note: liveType.stamp } as const;
// Swap to swap: the incoming line starts 50 ms in, settles at 200, holds 2000.
const PERIOD = T.gap + T.swap + T.hold;
const SWEEP = timingFor({ duration: SHIMMER.duration, easing: SHIMMER.easing });
// The band is SHIMMER.band x the line's width, peaking in its middle.
const HALF_BAND = SHIMMER.band / 2;
const PEAK = 1 / 2;

const ENTER = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: T.distance }] },
  to: { opacity: 1, transform: [{ translateY: 0 }], easing: toEasing(T.easing) },
})
  .duration(T.swap)
  .delay(T.gap)
  .reduceMotion(ReduceMotion.Never);
const EXIT = new Keyframe({
  from: { opacity: 1, transform: [{ translateY: 0 }] },
  to: { opacity: 0, transform: [{ translateY: -T.distance }], easing: toEasing(T.easing) },
})
  .duration(T.swap)
  .reduceMotion(ReduceMotion.Never);
const FADE_IN = FadeIn.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never);
const FADE_OUT = FadeOut.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never);

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export type ThinkingVariant = "meta" | "body" | "note";

interface Measure {
  width: number;
  baseline: number;
  wrapped: boolean;
}

interface BaseProps {
  /**
   * Truthful lines, sentence case, at most 28 characters. Two or more rotate
   * (one every 2200 ms). One line doesn't rotate (its shimmer repeats); when it
   * changes (a new count), it swaps with the same transition.
   */
  lines: readonly string[];
  /** "meta" (default, Geist 13/18), "body" (Geist 17/24) or "note" (Geist Mono 13/18, uppercase: 01's DEVELOPING). */
  variant?: ThinkingVariant;
  /** Default "noir". "warm" sets meta / body / note in the live caption / body / stamp styles and warm text colours. */
  tone?: ThinkingTone;
  /**
   * Extra strings measured for the box width, e.g. the longest count line
   * "Preparing photo 4 of 4", so the box never resizes when the count changes.
   */
  sizeTo?: readonly string[];
  /** Also announce the label when the line first appears. Default false: only label changes are announced. */
  announceOnMount?: boolean;
  /**
   * Render nothing until this many ms after mounting, so a wait that ends
   * sooner shows nothing (03 and 04 show the line only past ~1 s). No shared
   * token holds the delay: pass it from your screen's ref.layout block.
   * Default 0. To swap another element out at the same moment, use useShowAfter.
   */
  showDelay?: number;
  testID?: string;
  /**
   * Layout only. The line fills its parent's width and centres itself; in a row, give it flex: 1. Keep 8 pt clear above and below.
   * It needs a definite width before it measures: its hidden sizers span the outer box, so under a parent that sizes to its
   * content (alignSelf "flex-start", or a row without flex: 1) they measure at width 0, every line counts as wrapped, and it
   * stays in the static fallback. To start-align it, give it flex: 1 plus { alignItems: "flex-start" } here.
   */
  style?: StyleProp<ViewStyle>;
}

export type ThinkingStatesProps = BaseProps &
  (
    | {
        /** The fixed real status, e.g. "Developing your case". Never the rotating copy. Announced when it changes. */
        accessibilityLabel: string;
        decorative?: false;
      }
    | {
        /** Inside a control that is one accessibility element (01's card): the whole line is hidden; the control's label carries the status. */
        decorative: true;
        accessibilityLabel?: undefined;
      }
  );

/**
 * Run it only while a real wait runs, and unmount it the moment the wait ends:
 * the sweep and timers stop with it, with no final sweep or exit.
 */
export function ThinkingStates(props: ThinkingStatesProps) {
  const showDelay = props.showDelay ?? 0;
  const [shown, setShown] = useState(showDelay <= 0);
  useEffect(() => {
    if (showDelay <= 0) return;
    const id = setTimeout(() => setShown(true), showDelay);
    return () => clearTimeout(id);
  }, [showDelay]);
  return shown ? <ThinkingLine {...props} /> : null;
}

function ThinkingLine(props: ThinkingStatesProps) {
  const { lines, variant = "meta", tone = "noir", sizeTo, announceOnMount = false, testID, style } = props;
  const decorative = props.decorative === true;
  const label = props.accessibilityLabel;
  const { reducedMotion } = useTheme();
  const { fontScale } = useWindowDimensions();
  const typeStyle: TextStyle = tone === "warm" ? WARM_TYPE[variant] : ref.type[variant];
  const colors = TONES[tone];
  const [measures, setMeasures] = useState<Record<string, Measure>>({});
  const [tick, setTick] = useState(0);

  const count = lines.length;
  const rotating = count > 1;
  useEffect(() => {
    if (!rotating) return;
    const id = setInterval(() => setTick((t) => t + 1), PERIOD);
    return () => clearInterval(id);
  }, [rotating]);

  // Screen readers hear the fixed label: on iOS through an announcement, on
  // Android through the polite live region. Rotations are never announced.
  const announced = useRef(label);
  useEffect(() => {
    if (decorative || label === undefined || announced.current === label) return;
    announced.current = label;
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(label);
  }, [decorative, label]);
  const mountAnnouncement = useRef(announceOnMount && !decorative ? label : undefined);
  useEffect(() => {
    if (mountAnnouncement.current) AccessibilityInfo.announceForAccessibility(mountAnnouncement.current);
  }, []);

  const strings = Array.from(new Set([...lines, ...(sizeTo ?? [])]));
  const measureFor = (s: string) => (e: TextLayoutEvent) => {
    const ls = e.nativeEvent.lines;
    if (ls.length === 0) return;
    const first = ls[0];
    const next: Measure = {
      width: ls.reduce((w, l) => Math.max(w, l.width), 0),
      // TextLayoutLine has no baseline field: top of the line plus its ascender.
      baseline: first.y + first.ascender,
      wrapped: ls.length > 1,
    };
    setMeasures((prev) => {
      const old = prev[s];
      if (old && old.width === next.width && old.baseline === next.baseline && old.wrapped === next.wrapped) return prev;
      return { ...prev, [s]: next };
    });
  };

  if (count === 0) return null;

  const index = rotating ? tick % count : 0;
  const text = lines[index];
  const copyKey = rotating ? `r${tick}` : `s${text}`;
  const known = strings.map((s) => measures[s]).filter((m): m is Measure => m !== undefined);
  const boxWidth = known.reduce((w, m) => Math.max(w, m.width), 0);
  const wrapped = known.some((m) => m.wrapped);
  const current = measures[text];
  // SVG text doesn't follow the system text size by itself, so the box and
  // the glyphs are scaled by fontScale to match the hidden sizer.
  const lineBox = (typeStyle.lineHeight ?? 0) * fontScale;
  const mode = reducedMotion || wrapped ? "static" : current ? "shimmer" : "pending";

  // The status is one element on iOS. On Android `accessible` would also make
  // it a keyboard, D-pad and switch focus stop (ReactViewManager.setAccessible
  // sets isFocusable; focusable={false} can't undo it), so TalkBack reads it
  // through screenReaderFocusable there instead.
  const a11y = decorative
    ? ({ accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const)
    : ({
        accessible: Platform.OS === "ios",
        screenReaderFocusable: true,
        importantForAccessibility: "yes",
        accessibilityLabel: label,
        accessibilityLiveRegion: "polite",
      } as const);

  return (
    <View testID={testID} {...a11y} style={[styles.outer, style]}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.sizers}>
        {strings.map((s) => (
          <Text key={s} style={typeStyle} onTextLayout={measureFor(s)}>
            {s}
          </Text>
        ))}
      </View>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={mode === "static" ? { minWidth: boxWidth, minHeight: lineBox } : { width: boxWidth, height: lineBox }}
      >
        {/* Keyed by mode: switching presentation (or unmounting) is instant, with no entering or exiting animation. */}
        <LayoutAnimationConfig key={mode} skipEntering skipExiting>
          {mode === "shimmer" && current ? (
            <ShimmerCopy
              key={copyKey}
              text={text}
              typeStyle={typeStyle}
              colors={colors}
              fontScale={fontScale}
              lineWidth={current.width}
              boxWidth={boxWidth}
              boxHeight={lineBox}
              baseline={current.baseline}
            />
          ) : mode === "static" ? (
            <StaticCopy key={copyKey} text={text} typeStyle={typeStyle} color={colors.still} />
          ) : null}
        </LayoutAnimationConfig>
      </View>
    </View>
  );
}

function ShimmerCopy({
  ref: viewRef,
  text,
  typeStyle,
  colors,
  fontScale,
  lineWidth,
  boxWidth,
  boxHeight,
  baseline,
}: {
  ref?: Ref<HostInstance>;
  text: string;
  typeStyle: TextStyle;
  colors: ToneColors;
  fontScale: number;
  lineWidth: number;
  boxWidth: number;
  boxHeight: number;
  baseline: number;
}) {
  const id = `shimmer${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  // The band centre c runs from -W to 2W (W = the line's width) every pass, so
  // it is on the glyphs for the middle 1200 ms of each 2000 ms pass.
  const c = useSharedValue(-lineWidth);
  useEffect(() => {
    c.set(-lineWidth);
    // Restarts from the left as this copy starts rising in.
    c.set(withDelay(T.gap, withRepeat(withTiming(lineWidth * 2, SWEEP), -1, false)));
    return () => cancelAnimation(c);
  }, [c, lineWidth]);

  // The line is centred in the box; gradient x is in the SVG's own space.
  const left = (boxWidth - lineWidth) / 2;
  const half = HALF_BAND * lineWidth;
  const gradientProps = useAnimatedProps(() => ({ x1: left + c.get() - half, x2: left + c.get() + half }));
  // SVG ignores textTransform. iOS applies letterSpacing unscaled; Android scales it with the text size.
  const display = typeStyle.textTransform === "uppercase" ? text.toUpperCase() : text;
  const tracking = (typeStyle.letterSpacing ?? 0) * (Platform.OS === "android" ? fontScale : 1);

  return (
    <Animated.View ref={viewRef} entering={ENTER} exiting={EXIT} style={styles.copy}>
      <Svg width={boxWidth} height={boxHeight}>
        <Defs>
          <AnimatedLinearGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            x1={left - lineWidth - half}
            x2={left - lineWidth + half}
            y1={0}
            y2={0}
            animatedProps={gradientProps}
          >
            <Stop offset={0} stopColor={colors.base} />
            <Stop offset={PEAK} stopColor={colors.highlight} />
            <Stop offset={1} stopColor={colors.base} />
          </AnimatedLinearGradient>
        </Defs>
        <SvgText
          x={boxWidth / 2}
          y={baseline}
          textAnchor="middle"
          fontFamily={typeStyle.fontFamily}
          fontSize={(typeStyle.fontSize ?? 0) * fontScale}
          letterSpacing={tracking}
          fill={`url(#${id})`}
        >
          {display}
        </SvgText>
      </Svg>
    </Animated.View>
  );
}

function StaticCopy({ ref: textRef, text, typeStyle, color }: { ref?: Ref<HostInstance>; text: string; typeStyle: TextStyle; color: string }) {
  return (
    <Animated.Text ref={textRef} entering={FADE_IN} exiting={FADE_OUT} style={[typeStyle, styles.staticLine, { color }]}>
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  outer: { alignSelf: "stretch", alignItems: "center" },
  sizers: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0 },
  copy: { position: "absolute", top: 0, left: 0 },
  staticLine: { textAlign: "center" },
});
