import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, View, type AccessibilityActionEvent } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing, ReduceMotion, cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { timingFor } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { RingPressable } from "./parts";

const P = ref.layout.play;
const W = P.code.wheel;
const ROW = W.row;
const [E1, E2, E3, E4] = P.pager.easing;
const SETTLE_EASING = Easing.bezier(E1, E2, E3, E4);
const D = ref.motion.juice.detent;
const SEAT = { duration: D.back, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never } as const;

/**
 * Worklet: roll to `dest` over `duration`, running `D.overshoot` of a row past
 * it and seating back: the detent, so each stop reads as a mechanical click.
 * The overshoot never reaches the next digit's middle, so it never ticks.
 */
function detentTo(from: number, dest: number, duration: number, done?: (finished?: boolean) => void) {
  "worklet";
  const dir = Math.sign(dest - from);
  if (dir === 0) return withTiming(dest, { duration: D.back, easing: SETTLE_EASING }, done);
  return withSequence(
    withTiming(dest + dir * D.overshoot, { duration, easing: SETTLE_EASING }),
    withTiming(dest, SEAT, done),
  );
}
// Two turns of digits: the one in view sits on index LEAD + digit, so two
// neighbours either side always exist.
const LEAD = 5;
const COLUMN = Array.from({ length: 20 }, (_, k) => (k - LEAD + 10) % 10);

// The wheel clips its children, so a neighbour's focus ring is drawn just inside it.
const NEIGHBOUR_RING = -(ref.focus.width + ref.focus.offset);

const mod10 = (n: number) => {
  "worklet";
  return ((n % 10) + 10) % 10;
};

export interface CodeWheelProps {
  /** Zero-based wheel number. */
  index: number;
  value: number;
  onChange: (digit: number) => void;
  /** A finger is on the wheel (the sheet stops scrolling meanwhile). */
  onDragChange?: (dragging: boolean) => void;
}

/**
 * One tumbler wheel: a vertical picker in a void well (02's counter pill
 * corners). The digit in view is white in 02's italic; its neighbours above
 * (one less) and below (one more) are textDim, as the counter's. Drag it to
 * roll the digits: it follows the finger, then snaps to the nearest digit on
 * a no-overshoot ease-out matched to the release speed, wrapping 9 to 0.
 * Tapping a neighbour steps to it. Every stop seats with a small detent
 * (ref.motion.juice.detent), a mechanical click. Each digit passed gives a light tick.
 * Screen readers get one adjustable element ("Digit 1", value "4"). Reduced
 * motion: the drag steps a digit at a time, with no momentum.
 */
export function CodeWheel({ index, value, onChange, onDragChange }: CodeWheelProps) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const feedback = useFeedback();
  const pos = useSharedValue(value);
  const start = useSharedValue(0);
  // True while the finger, or the momentum after it, drives the wheel.
  const live = useSharedValue(false);
  const reduced = useSharedValue(reducedMotion);
  const emitted = useRef(value);
  // The whole-number position the wheel is at or rolling to (JS's copy, so
  // quick taps never read a position mid-roll).
  const aim = useRef(value);

  useEffect(() => {
    reduced.set(reducedMotion);
  }, [reducedMotion, reduced]);

  // A value from outside (the reset after a wrong code): roll there quietly, the short way.
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    const here = aim.current;
    let delta = mod10(value - here);
    if (delta > 5) delta -= 10;
    aim.current = here + delta;
    live.set(false);
    pos.set(reducedMotion ? here + delta : withTiming(here + delta, timingFor(ref.motion.counterRoll)));
  }, [value, reducedMotion, pos, live]);

  const roll = useCallback((rounded: number) => {
    aim.current = rounded;
    const digit = mod10(rounded);
    if (digit === emitted.current) return;
    emitted.current = digit;
    feedback.tick();
    onChange(digit);
  }, [feedback, onChange]);

  // One tick per digit that passes the middle while the finger drives it.
  useAnimatedReaction(
    () => Math.round(pos.get()),
    (now, before) => {
      if (before === null || now === before || !live.get()) return;
      scheduleOnRN(roll, now);
    },
  );

  // A tap on a neighbour or an accessibility action: one digit, then roll there.
  const step = useCallback((delta: number) => {
    const dest = aim.current + delta;
    aim.current = dest;
    const digit = mod10(dest);
    emitted.current = digit;
    feedback.tick();
    onChange(digit);
    live.set(false);
    pos.set(reducedMotion ? dest : detentTo(pos.get(), dest, W.minDuration));
  }, [feedback, onChange, reducedMotion, pos, live]);

  const dragging = (on: boolean) => onDragChange?.(on);

  const pan = usePanGesture({
    activeOffsetY: [-W.activeOffset, W.activeOffset],
    maxPointers: 1,
    onBegin: () => {
      "worklet";
      scheduleOnRN(dragging, true);
    },
    onActivate: () => {
      "worklet";
      cancelAnimation(pos);
      start.set(pos.get());
      live.set(true);
    },
    onUpdate: (e) => {
      "worklet";
      const raw = start.get() - e.translationY / ROW;
      pos.set(reduced.get() ? Math.round(raw) : raw);
    },
    onDeactivate: (e) => {
      "worklet";
      if (reduced.get()) {
        pos.set(Math.round(pos.get()));
        live.set(false);
        return;
      }
      const dest = Math.round(pos.get() - (e.velocityY / ROW) * W.projection);
      const distance = Math.abs(dest - pos.get()) * ROW;
      const speed = Math.abs(e.velocityY);
      const matched = speed > 1 ? (P.pager.slope * distance / speed) * 1000 : W.maxDuration;
      const duration = Math.min(W.maxDuration, Math.max(W.minDuration, matched));
      pos.set(detentTo(pos.get(), dest, duration, (finished) => {
        if (finished) live.set(false);
      }));
    },
    onFinalize: () => {
      "worklet";
      scheduleOnRN(dragging, false);
    },
  });

  // The column under the middle row: index LEAD + the digit in view sits there.
  const columnStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ROW - (LEAD + mod10(pos.get())) * ROW }] }));
  const brightStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -(LEAD + mod10(pos.get())) * ROW }] }));

  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === "increment") step(1);
    if (e.nativeEvent.actionName === "decrement") step(-1);
  };

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Digit ${index + 1}`}
        accessibilityValue={{ text: String(value) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={onAction}
        style={styles.wheel}
        testID={`tumbler-${index}`}
      >
        {/* The neighbours, dim; the middle row is drawn again in white over them. */}
        <Animated.View style={[styles.column, columnStyle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {COLUMN.map((digit, k) => (
            <View key={k} style={styles.cell}>
              <Text style={[styles.digit, styles.dim]}>{digit}</Text>
            </View>
          ))}
        </Animated.View>
        <View style={styles.middle} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Animated.View style={[styles.column, brightStyle]}>
            {COLUMN.map((digit, k) => (
              <View key={k} style={styles.cell}>
                <Text style={[styles.digit, { color: theme.ink }]}>{digit}</Text>
              </View>
            ))}
          </Animated.View>
        </View>
        <RingPressable
          ring="panel"
          radius={ref.radius.nested}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          edge={NEIGHBOUR_RING}
          onPress={() => step(-1)}
          testID={`tumbler-${index}-prev`}
          style={[styles.neighbour, styles.above]}
        >
          {null}
        </RingPressable>
        <RingPressable
          ring="panel"
          radius={ref.radius.nested}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          edge={NEIGHBOUR_RING}
          onPress={() => step(1)}
          testID={`tumbler-${index}-next`}
          style={[styles.neighbour, styles.below]}
        >
          {null}
        </RingPressable>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // 02's void counter pill, three rows tall.
  wheel: {
    width: W.width,
    height: ROW * W.rows,
    borderRadius: ref.radius.nested,
    ...ref.curve,
    backgroundColor: ref.color.void,
    overflow: "hidden",
  },
  column: { position: "absolute", left: 0, right: 0, top: 0 },
  cell: { height: ROW, alignItems: "center", justifyContent: "center" },
  digit: { ...P.type.digit, color: ref.color.textPrimary, textAlign: "center" },
  dim: { color: ref.color.textDim },
  middle: { position: "absolute", left: 0, right: 0, top: ROW, height: ROW, overflow: "hidden" },
  neighbour: { position: "absolute", left: 0, right: 0, height: ROW },
  above: { top: 0 },
  below: { bottom: 0 },
});
