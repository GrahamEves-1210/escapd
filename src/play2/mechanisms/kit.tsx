// Shared parts for the mechanisms: the stage, buttons and lines, accessibility
// helpers, the rattle, and the pull-to-commit drag that drawers, cloths and
// frames share. Mode colours only (useModeTheme); sizes from `ref`.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from "react-native";
import { usePanGesture } from "react-native-gesture-handler";
import {
  Easing, ReduceMotion, cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSequence, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { RingPressable } from "@/render/parts";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import type { ControlDomain } from "@/engine/v2";
import type { MechanismTarget } from "./types";

/** The height a mechanism's drawing gets; its readout or button sits under it. */
export const STAGE = 200;
/** How far past its travel a pull must go to commit (0..1). */
export const COMMIT_AT = 0.6;

/** A settle: short ease-out, never skipped by the OS setting (callers pass 0 duration under reduced motion). */
export const settle = (reduced: boolean, duration = 220) =>
  ({ duration: reduced ? 0 : duration, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }) as const;

export const clamp = (v: number, lo: number, hi: number) => {
  "worklet";
  return Math.min(hi, Math.max(lo, v));
};

export const mod = (n: number, m: number) => {
  "worklet";
  return ((n % m) + m) % m;
};

/** One control's domain on the target, if it has it. */
export function domainOf(target: MechanismTarget, control: string): ControlDomain | undefined {
  return target.controls.find((c) => c.id === control)?.domain;
}

/** Props that make a View one adjustable control: increment and decrement step and commit. */
export function adjustable(label: string, valueText: string, step: (delta: 1 | -1) => void) {
  return {
    accessible: true,
    accessibilityRole: "adjustable" as const,
    accessibilityLabel: label,
    accessibilityValue: { text: valueText },
    accessibilityActions: [{ name: "increment" }, { name: "decrement" }],
    onAccessibilityAction: (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === "increment") step(1);
      if (e.nativeEvent.actionName === "decrement") step(-1);
    },
  };
}

/** Props that make a drawn thing one button for a screen reader: activate does the physical verb. */
export function activatable(label: string, hint: string, act: () => void, disabled = false) {
  return {
    accessible: true,
    accessibilityRole: "button" as const,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityState: { disabled },
    accessibilityActions: [{ name: "activate" }],
    onAccessibilityAction: (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === "activate" && !disabled) act();
    },
  };
}

/** The mechanism's frame: its width, centred, about 280 tall with its line or button. */
export function Stage({ width, children, style }: { width: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.stage, { width }, style]}>{children}</View>;
}

/** A quiet line under a mechanism (a hint, the state). `tone="stamp"` for Locked, Open and the cooldown. */
export function Line({ text, tone = "muted", testID }: { text: string; tone?: "muted" | "stamp"; testID?: string }) {
  const theme = useModeTheme();
  return (
    <Text
      style={[tone === "stamp" ? styles.stampLine : styles.line, { color: tone === "stamp" ? theme.stamp : theme.inkMuted }]}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {text}
    </Text>
  );
}

/** A readout in the counter face: a time, a frequency, a page. */
export function Readout({ children, testID }: { children: ReactNode; testID?: string }) {
  const theme = useModeTheme();
  return <View style={styles.readoutRow} testID={testID}>{typeof children === "string" ? <Text style={[styles.readout, { color: theme.ink }]}>{children}</Text> : children}</View>;
}

export function readoutText(ink: string) {
  return [styles.readout, { color: ink }];
}

/** A button: the mode's accent (primary) or a raised square (secondary, for steppers). */
export function MechButton({
  label, onPress, disabled = false, tone = "primary", accessibilityLabel, testID, compact = false,
}: {
  label: string; onPress: () => void; disabled?: boolean; tone?: "primary" | "secondary";
  accessibilityLabel?: string; testID?: string; compact?: boolean;
}) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  const primary = tone === "primary";
  return (
    <RingPressable
      ring={compact ? "control" : "pill"}
      radius={compact ? ref.radius.square : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        feedback.press();
        onPress();
      }}
      testID={testID}
      style={({ pressed }) => [
        compact ? styles.compact : styles.button,
        {
          backgroundColor: primary ? theme.accent : theme.raised,
          borderColor: theme.rim,
          opacity: disabled ? ref.button.disabledOpacity.pill : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonLabel, { color: primary ? theme.accentInk : theme.ink }]}>{label}</Text>
    </RingPressable>
  );
}

/** The submit line: the cooldown's seconds when one runs, else nothing. */
export function cooldownText(cooldown: number): string | null {
  return cooldown > 0 ? `Try again in ${Math.ceil(cooldown)}s` : null;
}

/** A small horizontal rattle: a locked thing tried. Nothing moves under reduced motion. */
export function useRattle() {
  const { reducedMotion } = useTheme();
  const x = useSharedValue(0);
  const rattle = useCallback(() => {
    if (reducedMotion) return;
    const d = motion.wrongShake.distance;
    const t = motion.wrongShake.duration / 5;
    x.set(withSequence(
      withTiming(-d, { duration: t }), withTiming(d, { duration: t }), withTiming(-d / 2, { duration: t }),
      withTiming(d / 2, { duration: t }), withTiming(0, { duration: t }),
    ));
  }, [reducedMotion, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return { rattle, style };
}

export type PullAxis = "down" | "up" | "x";

/**
 * The pull-to-commit drag: `progress` follows the finger from 0 to 1 along
 * `axis` over `range` pt (signed -1..1 for "x"). Released past COMMIT_AT it
 * runs home to the end and calls `onCommit`; short of it, it falls back.
 * Locked, it gives a few points and rattles (`onLocked`). A tick when the
 * pull crosses the catch. `done` holds it at the end; while `busy` it holds still.
 */
export function usePull({ axis, range, done, locked = false, busy, onCommit, onLocked, onUncommit }: {
  axis: PullAxis; range: number; done: boolean; locked?: boolean; busy: boolean;
  onCommit: () => void; onLocked?: () => void;
  /** Given: once done it can be pushed back (a drawer shut, a cushion put back), committing this on release. */
  onUncommit?: () => void;
}): { progress: SharedValue<number>; gesture: ReturnType<typeof usePanGesture>; commitNow: () => void } {
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const progress = useSharedValue(done ? 1 : 0);
  const start = useSharedValue(0);
  const live = useSharedValue(false);
  const lockedSV = useSharedValue(locked);
  const reversible = !!onUncommit;
  const enabled = useSharedValue(!busy && (!done || reversible));
  const doneSV = useSharedValue(done);
  const reduced = useSharedValue(reducedMotion);

  useEffect(() => {
    lockedSV.set(locked);
    enabled.set(!busy && (!done || reversible));
    doneSV.set(done);
    reduced.set(reducedMotion);
  }, [locked, done, busy, reducedMotion, lockedSV, enabled, reduced, reversible, doneSV]);

  // Settle to the state once nothing is in flight (a refused commit falls back).
  useEffect(() => {
    if (busy) return;
    const here = progress.get();
    const to = done ? (here < 0 ? -1 : 1) : 0;
    progress.set(withTiming(to, settle(reducedMotion)));
  }, [done, busy, reducedMotion, progress]);

  const tick = useCallback(() => feedback.tick(), [feedback]);
  useAnimatedReaction(
    () => Math.abs(progress.get()) >= COMMIT_AT,
    (now, before) => {
      if (before !== null && now !== before && live.get() && !lockedSV.get()) scheduleOnRN(tick);
    },
  );

  const commit = useCallback(() => onCommit(), [onCommit]);
  const refuse = useCallback(() => onLocked?.(), [onLocked]);
  const uncommit = useCallback(() => onUncommit?.(), [onUncommit]);

  const gesture = usePanGesture({
    enabled,
    maxPointers: 1,
    minDistance: 4,
    onActivate: () => {
      "worklet";
      cancelAnimation(progress);
      start.set(progress.get());
      live.set(true);
    },
    onUpdate: (e) => {
      "worklet";
      const d = axis === "x" ? e.translationX : axis === "down" ? e.translationY : -e.translationY;
      const lo = axis === "x" ? -1 : 0;
      let v = clamp(start.get() + d / range, lo, 1);
      // Locked: the front gives a few points and stops.
      if (lockedSV.get()) v = clamp(v, axis === "x" ? -0.05 : 0, 0.05);
      progress.set(v);
    },
    onDeactivate: () => {
      "worklet";
      live.set(false);
      const v = progress.get();
      const back = { duration: reduced.get() ? 0 : 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never };
      if (lockedSV.get()) {
        progress.set(withTiming(0, back));
        scheduleOnRN(refuse);
        return;
      }
      // Open already: pushed most of the way back closes it again; otherwise it springs back open.
      if (doneSV.get()) {
        if (Math.abs(v) <= 1 - COMMIT_AT) {
          progress.set(withTiming(0, back));
          scheduleOnRN(uncommit);
        } else {
          progress.set(withTiming(v < 0 ? -1 : 1, back));
        }
        return;
      }
      if (Math.abs(v) >= COMMIT_AT) {
        progress.set(withTiming(v < 0 ? -1 : 1, back));
        scheduleOnRN(commit);
      } else {
        progress.set(withTiming(0, back));
      }
    },
  });

  const commitNow = useCallback(() => {
    if (busy || done) return;
    if (locked) {
      onLocked?.();
      return;
    }
    progress.set(withTiming(1, settle(reducedMotion, 320)));
    onCommit();
  }, [busy, done, locked, onLocked, onCommit, progress, reducedMotion]);

  return { progress, gesture, commitNow };
}

/** "Locked" after a try on a locked thing; cleared when it unlocks. */
export function useLockedLine(locked: boolean) {
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!locked) setTried(false);
  }, [locked]);
  return { showLocked: tried && locked, markTried: () => setTried(true) };
}

const styles = StyleSheet.create({
  stage: { alignSelf: "center", alignItems: "center", gap: ref.space.sm, paddingVertical: ref.space.sm },
  line: { ...ref.type.meta, textAlign: "center", minHeight: ref.type.meta.lineHeight },
  stampLine: { ...ref.type.tag, textAlign: "center", minHeight: ref.type.tag.lineHeight },
  readoutRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: ref.space.xs },
  readout: { ...ref.type.counter, fontVariant: ["tabular-nums"], textAlign: "center" },
  button: {
    minHeight: ref.hit.min,
    minWidth: 160,
    paddingHorizontal: ref.space.xl,
    borderRadius: ref.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    ...ref.curve,
  },
  compact: {
    width: ref.hit.min,
    height: ref.hit.min,
    borderRadius: ref.radius.square,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    ...ref.curve,
  },
  buttonLabel: { ...ref.type.headline, textAlign: "center" },
});
