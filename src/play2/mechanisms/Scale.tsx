// A horizontal scale under a fixed needle: the radio's band, drawn as the
// dial it is: a strip of printed card lit amber from behind, dark at its ends
// where the glass curves away, in a window (the cabinet's brass rim goes round it), the needle a red
// hairline with its shadow on the card. Drag it: it follows the finger, flings a little, and seats on the
// nearest step. A tick every `tickEvery` steps passed. Controlled: `value` is
// the step in view (the parent's, which `onLive` updates during a drag);
// `onCommit` runs on release and on each accessibility step.
import { memo, useCallback, useEffect } from "react";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { adjustable, clamp, settle } from "./kit";
import { ENAMEL, INK, useGradId } from "./materials";

export interface ScaleProps {
  count: number;
  value: number;
  /** Points between steps. */
  spacing: number;
  /** A tall tick every this many steps. */
  majorEvery: number;
  /** A label under every this many steps. */
  labelEvery: number;
  label: (step: number) => string;
  tickEvery: number;
  width: number;
  onLive: (step: number) => void;
  onCommit: (step: number) => void;
  accessibilityLabel: string;
  valueText: (step: number) => string;
  disabled?: boolean;
  testID?: string;
  /** Where the scale stands, shared (a knob that turns with it): the caller's, else the scale's own. */
  position?: SharedValue<number>;
}

const HEIGHT = 76;
const FLING = 0.12;

export function Scale({
  count, value, spacing, majorEvery, labelEvery, label, tickEvery, width, onLive, onCommit, accessibilityLabel, valueText,
  disabled = false, testID, position,
}: ScaleProps) {
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const own = useSharedValue(value);
  const pos = position ?? own;
  const start = useSharedValue(0);
  const live = useSharedValue(false);
  const reduced = useSharedValue(reducedMotion);
  const enabled = useSharedValue(!disabled);
  useEffect(() => {
    reduced.set(reducedMotion);
    enabled.set(!disabled);
  }, [reducedMotion, disabled, reduced, enabled]);

  // A value from outside (a stepper, the state): seat there unless a finger has it.
  useEffect(() => {
    if (live.get() || Math.round(pos.get()) === value) return;
    pos.set(withTiming(value, settle(reducedMotion)));
  }, [value, reducedMotion, pos, live]);

  const passed = useCallback((step: number) => {
    if (step % tickEvery === 0) feedback.tick();
    onLive(step);
  }, [feedback, onLive, tickEvery]);
  const commit = useCallback((step: number) => onCommit(step), [onCommit]);

  useAnimatedReaction(
    () => Math.round(pos.get()),
    (now, before) => {
      if (before !== null && now !== before && live.get()) scheduleOnRN(passed, now);
    },
  );

  const pan = usePanGesture({
    enabled,
    maxPointers: 1,
    activeOffsetX: [-6, 6],
    onActivate: () => {
      "worklet";
      cancelAnimation(pos);
      start.set(pos.get());
      live.set(true);
    },
    onUpdate: (e) => {
      "worklet";
      pos.set(clamp(start.get() - e.translationX / spacing, 0, count - 1));
    },
    onDeactivate: (e) => {
      "worklet";
      const fling = reduced.get() ? 0 : (e.velocityX / spacing) * FLING;
      const dest = Math.round(clamp(pos.get() - fling, 0, count - 1));
      scheduleOnRN(commit, dest);
      pos.set(withTiming(dest, { duration: reduced.get() ? 0 : 260 }, (finished) => {
        if (finished) live.set(false);
      }));
    },
  });

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: width / 2 - pos.get() * spacing }] }));

  const step = (delta: 1 | -1) => {
    if (disabled) return;
    const next = clamp(value + delta, 0, count - 1);
    if (next === value) return;
    feedback.tick();
    onLive(next);
    onCommit(next);
  };

  return (
    <GestureDetector gesture={pan}>
      <View
        {...adjustable(accessibilityLabel, valueText(value), step)}
        testID={testID}
        style={[styles.window, { width }]}
      >
        <Backlight w={width} />
        <Animated.View style={[styles.strip, { width: count * spacing }, stripStyle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Ticks count={count} spacing={spacing} majorEvery={majorEvery} labelEvery={labelEvery} label={label} ink={ENAMEL.ink} muted="#5A4326" />
        </Animated.View>
        {/* The needle and its shadow on the card, then the glass over it all. */}
        <View pointerEvents="none" style={[styles.needleShadow, { left: width / 2 + 2 }]} />
        <View pointerEvents="none" style={[styles.needle, { left: width / 2 - 1 }]} />
        <DialGlass w={width} />
      </View>
    </GestureDetector>
  );
}

/** The card behind the scale, lit from behind: brightest in the middle. */
const Backlight = memo(function Backlight({ w }: { w: number }) {
  const g = useGradId()("bl");
  return (
    <Svg width={w} height={HEIGHT} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={g.id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#B9812F" />
          <Stop offset="0.3" stopColor="#EBC272" />
          <Stop offset="0.5" stopColor="#FBE3A4" />
          <Stop offset="0.7" stopColor="#EBC272" />
          <Stop offset="1" stopColor="#B9812F" />
        </LinearGradient>
      </Defs>
      <Rect width={w} height={HEIGHT} fill={g.url} />
    </Svg>
  );
});

/** The window's glass: dark where it curves away at the ends, a streak of light along its top. */
const DialGlass = memo(function DialGlass({ w }: { w: number }) {
  const g = useGradId();
  const [ends, top] = [g("ge"), g("gt")];
  return (
    <Svg width={w} height={HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={ends.id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#1A0E04" stopOpacity={0.75} />
          <Stop offset="0.14" stopColor="#1A0E04" stopOpacity={0} />
          <Stop offset="0.86" stopColor="#1A0E04" stopOpacity={0} />
          <Stop offset="1" stopColor="#1A0E04" stopOpacity={0.75} />
        </LinearGradient>
        <LinearGradient id={top.id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1A0E04" stopOpacity={0.5} />
          <Stop offset="0.16" stopColor="#FFFFFF" stopOpacity={0.22} />
          <Stop offset="0.34" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.85" stopColor="#1A0E04" stopOpacity={0} />
          <Stop offset="1" stopColor="#1A0E04" stopOpacity={0.45} />
        </LinearGradient>
      </Defs>
      <Rect width={w} height={HEIGHT} fill={ends.url} />
      <Rect width={w} height={HEIGHT} fill={top.url} />
      {/* The window's edge under the cabinet's brass rim (rendered, round it). */}
      <Rect x={0.6} y={0.6} width={w - 1.2} height={HEIGHT - 1.2} rx={9.6} fill="none" stroke={INK} strokeWidth={1.4} />
    </Svg>
  );
});

const Ticks = memo(function Ticks({ count, spacing, majorEvery, labelEvery, label, ink, muted }: {
  count: number; spacing: number; majorEvery: number; labelEvery: number; label: (step: number) => string; ink: string; muted: string;
}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const major = i % majorEvery === 0;
    out.push(<View key={i} style={[styles.tick, { left: i * spacing, height: major ? 22 : 10, backgroundColor: major ? ink : muted }]} />);
    if (i % labelEvery === 0) {
      out.push(<Text key={`l${i}`} style={[styles.label, { left: i * spacing - 24, color: muted }]}>{label(i)}</Text>);
    }
  }
  return <>{out}</>;
});

const styles = StyleSheet.create({
  window: { height: HEIGHT, borderRadius: 10, overflow: "hidden", backgroundColor: "#EBC272" },
  strip: { position: "absolute", left: 0, top: 0, bottom: 0 },
  tick: { position: "absolute", top: ref.space.sm + 2, width: 1.2 },
  label: { ...ref.type.meta, position: "absolute", top: 38, width: 48, textAlign: "center", fontVariant: ["tabular-nums"], fontWeight: "600" },
  needle: { position: "absolute", top: 3, bottom: 3, width: 2, backgroundColor: "#B5261E" },
  needleShadow: { position: "absolute", top: 5, bottom: 3, width: 2, backgroundColor: "rgba(60, 30, 0, 0.28)" },
});
