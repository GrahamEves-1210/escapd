import type { Ref } from "react";
import {
  type HostInstance,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type Insets,
  type NativeSyntheticEvent,
  type StyleProp,
  type TargetedEvent,
  type ViewStyle,
} from "react-native";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { color, ref } from "@/theme/tokens";
import { FocusRing, useFocusRing } from "./focus";
import { paletteColor, usePaletteTransition, usePressProgress } from "./motion";

/** primary (white), secondary (graphite), signal (oxblood, at most one per screen), quiet (text only). */
export type PillVariant = "primary" | "secondary" | "signal" | "quiet";

/** "noir" (default) or "brass": the same pill in the play screen's colours and button type (ref.button.brass). */
export type PillScheme = "noir" | "brass";

const B = ref.button;
const BR = B.brass;

// Rest and pressed colours per variant (DESIGN.md, Buttons and controls).
const PALETTES = {
  noir: {
    primary: { fill: B.primary.fill, pressedFill: B.primary.pressedFill, label: B.primary.label, pressedLabel: B.primary.label },
    secondary: { fill: B.secondary.fill, pressedFill: B.secondary.pressedFill, label: B.secondary.label, pressedLabel: B.secondary.label },
    signal: { fill: B.signal.fill, pressedFill: B.signal.pressedFill, label: B.signal.label, pressedLabel: B.signal.label },
    // Quiet draws no fill. Its fill entries only matter if a quiet button turns into a filled one.
    quiet: { fill: ref.color.ground, pressedFill: ref.color.ground, label: B.quiet.label, pressedLabel: B.quiet.pressedLabel },
  },
  brass: {
    primary: { fill: BR.primary.fill, pressedFill: BR.primary.pressedFill, label: BR.primary.label, pressedLabel: BR.primary.label },
    secondary: { fill: BR.secondary.fill, pressedFill: BR.secondary.pressedFill, label: BR.secondary.label, pressedLabel: BR.secondary.label },
    // Brass has no separate signal colour: its "go" action is the brass primary.
    signal: { fill: BR.primary.fill, pressedFill: BR.primary.pressedFill, label: BR.primary.label, pressedLabel: BR.primary.label },
    quiet: { fill: color.canvas, pressedFill: color.canvas, label: BR.quiet.label, pressedLabel: BR.quiet.pressedLabel },
  },
} as const;

const LABEL_TYPE = { noir: ref.type.button, brass: BR.labelType } as const;
const EDGE = {
  noir: { borderWidth: B.secondary.borderWidth, borderColor: B.secondary.border },
  brass: { borderWidth: BR.secondary.borderWidth, borderColor: BR.secondary.border },
} as const;

const HEIGHT: Record<PillVariant, number> = {
  primary: B.primary.height,
  secondary: B.secondary.height,
  signal: B.signal.height,
  quiet: B.quiet.height,
};

// The small native ActivityIndicator is 20 x 20 on iOS, the same as ref.icon.header.
const SPINNER_SIZE = ref.icon.header;
// A button that can go busy reserves 16 + 20 + 8 = 44 on both sides, so the
// centred label never shifts or runs under the indicator (Loading indicators).
const SPINNER_PAD = ref.space.lg + SPINNER_SIZE + ref.space.sm;

type PressHandler = (e: GestureResponderEvent) => void;
type FocusHandler = (e: NativeSyntheticEvent<TargetedEvent>) => void;

export interface PillButtonProps {
  /** One line, sentence case, verb first (DESIGN.md). Also the accessibility label unless one is given. */
  label: string;
  onPress?: PressHandler;
  /** Default "primary". Changing it cross-fades fill and label colour over ref.motion.control. */
  variant?: PillVariant;
  /** Default "noir". "brass" for the screens that follow the play screen's look (hub, guide, Pro). */
  scheme?: PillScheme;
  /** Whole control at ref.button.disabledOpacity, no press response, `disabled` state. */
  disabled?: boolean;
  /**
   * The button's own action is running: taps are ignored, the fill stays at full
   * opacity (busy never looks disabled), focus stays, and the state is
   * `{ busy: true, disabled: true }`. Shows the indicator only with `spinner`.
   */
  busy?: boolean;
  /**
   * This button shows the native ActivityIndicator (small, label colour, right
   * edge 16 in) while `busy`. It always reserves 44 label padding on both sides.
   */
  spinner?: boolean;
  /** Default true for primary / secondary / signal (full content width), false for quiet (label + 16 each side, centred). */
  fullWidth?: boolean;
  /** Label side padding. Defaults: ref.space.xl for filled pills, ref.button.quiet.padX for quiet. `spinner` raises it to 44. */
  padX?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Only where a screen's spec caps text growth. */
  maxFontSizeMultiplier?: number;
  hitSlop?: number | Insets;
  /** On the Pressable. The busy indicator gets `${testID}-spinner`. */
  testID?: string;
  /** Outer layout only (margins, alignSelf). Colours and sizes come from the variant. */
  style?: StyleProp<ViewStyle>;
  ref?: Ref<HostInstance>;
  onPressIn?: PressHandler;
  onPressOut?: PressHandler;
  onLongPress?: PressHandler;
  onFocus?: FocusHandler;
  onBlur?: FocusHandler;
}

/**
 * Noir pill button (ref.button.primary / secondary / signal / quiet). Pressed
 * is a colour change over ref.motion.control; there is no opacity or scale on
 * press. The label grows with the system text size and may wrap; the pill
 * grows with it (52 and 44 are minimums).
 */
export function PillButton({
  label,
  onPress,
  variant = "primary",
  scheme = "noir",
  disabled = false,
  busy = false,
  spinner = false,
  fullWidth,
  padX,
  accessibilityLabel,
  accessibilityHint,
  maxFontSizeMultiplier,
  hitSlop,
  testID,
  style,
  ref: pressableRef,
  onPressIn,
  onPressOut,
  onLongPress,
  onFocus,
  onBlur,
}: PillButtonProps) {
  const filled = variant !== "quiet";
  const palette = PALETTES[scheme][variant];
  const labelType = LABEL_TYPE[scheme];
  const colors = usePaletteTransition(palette);
  const press = usePressProgress();
  const focus = useFocusRing({ onFocus, onBlur });

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(press.progress.get(), [0, 1], [paletteColor(colors, "fill"), paletteColor(colors, "pressedFill")]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(press.progress.get(), [0, 1], [paletteColor(colors, "label"), paletteColor(colors, "pressedLabel")]),
  }));

  const height = HEIGHT[variant];
  const basePad = padX ?? (filled ? ref.space.xl : B.quiet.padX);
  const sidePad = spinner ? Math.max(basePad, SPINNER_PAD) : basePad;
  const stretch = fullWidth ?? filled;

  return (
    <Pressable
      ref={pressableRef}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || busy, busy }}
      // Pressable copies its own `disabled` over accessibilityState.disabled,
      // so it's only passed when true: busy stays focusable but reads as disabled.
      disabled={disabled || undefined}
      hitSlop={hitSlop}
      testID={testID}
      onPress={busy ? undefined : onPress}
      onLongPress={busy ? undefined : onLongPress}
      onPressIn={(e) => {
        if (busy) return;
        press.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        press.onPressOut();
        onPressOut?.(e);
      }}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={[
        styles.base,
        // Filled pills pad the label to their height and grow with it. A quiet
        // button is "44 tall, label + 16 each side": no vertical padding, so it
        // stays 44 (label centred by styles.base) until its label outgrows it.
        { minHeight: height, paddingHorizontal: sidePad, paddingVertical: filled ? (height - (labelType.lineHeight ?? 0)) / 2 : 0 },
        stretch ? styles.stretch : styles.hug,
        disabled && styles.disabled,
        style,
      ]}
    >
      {filled ? (
        <Animated.View pointerEvents="none" style={[styles.surface, variant === "secondary" && EDGE[scheme], surfaceStyle]} />
      ) : null}
      <Animated.Text style={[labelType, styles.label, labelStyle]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
        {label}
      </Animated.Text>
      {busy && spinner ? (
        <View pointerEvents="none" style={styles.spinnerSlot}>
          <ActivityIndicator size="small" color={palette.label} testID={testID ? `${testID}-spinner` : undefined} />
        </View>
      ) : null}
      <FocusRing visible={focus.focused} shape="pill" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  stretch: { alignSelf: "stretch" },
  hug: { alignSelf: "center" },
  surface: { ...StyleSheet.absoluteFill, borderRadius: ref.radius.pill, ...ref.curve },
  label: { textAlign: "center" },
  spinnerSlot: { position: "absolute", top: 0, bottom: 0, right: ref.space.lg, justifyContent: "center" },
  disabled: { opacity: B.disabledOpacity },
});
