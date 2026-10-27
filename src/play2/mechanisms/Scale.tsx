// A horizontal scale under a fixed needle: the radio's band and the book's
// pages. Drag it: it follows the finger, flings a little, and seats on the
// nearest step. A tick every `tickEvery` steps passed. Controlled: `value` is
// the step in view (the parent's, which `onLive` updates during a drag);
// `onCommit` runs on release and on each accessibility step.
import { memo, useCallback, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { adjustable, clamp, settle } from "./kit";

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
}

const HEIGHT = 76;
const FLING = 0.12;

export function Scale({
  count, value, spacing, majorEvery, labelEvery, label, tickEvery, width, onLive, onCommit, accessibilityLabel, valueText,
  disabled = false, testID,
}: ScaleProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const pos = useSharedValue(value);
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
        style={[styles.window, { width, backgroundColor: theme.surface, borderColor: theme.rim }]}
      >
        <Animated.View style={[styles.strip, { width: count * spacing }, stripStyle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Ticks count={count} spacing={spacing} majorEvery={majorEvery} labelEvery={labelEvery} label={label} ink={theme.ink} muted={theme.inkMuted} />
        </Animated.View>
        <View pointerEvents="none" style={[styles.needle, { left: width / 2 - 1, backgroundColor: theme.stamp }]} />
      </View>
    </GestureDetector>
  );
}

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
  window: {
    height: HEIGHT,
    borderRadius: ref.radius.tag,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    ...ref.curve,
  },
  strip: { position: "absolute", left: 0, top: 0, bottom: 0 },
  tick: { position: "absolute", top: ref.space.sm, width: 1 },
  label: { ...ref.type.meta, position: "absolute", top: 36, width: 48, textAlign: "center", fontVariant: ["tabular-nums"] },
  needle: { position: "absolute", top: 0, bottom: 0, width: 2 },
});
