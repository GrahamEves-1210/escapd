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
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";
import { FocusRing, useFocusRing } from "./focus";
import { paletteColor, usePaletteTransition, usePressProgress } from "./motion";

/**
 * primary: pushr's black pill on paper (64 tall, ctaLabel). ghost: Apple
 * Health's dark pill with a hairline, on black (52 tall, headline). quiet:
 * text only (48 tall, headline), on paper or on dark.
 */
export type PillVariant = "primary" | "ghost" | "quiet";

/** The ground under a quiet button. Primary always sits on paper and ghost on dark, as in the references. */
export type PillGround = "paper" | "dark";

const B = ref.button;

// Rest and pressed colours. Quiet draws no fill: its fill entries only matter
// while a quiet button cross-fades into a filled one.
const PALETTES = {
  primary: { fill: B.primary.fill, pressedFill: B.primary.pressedFill, label: B.primary.label, pressedLabel: B.primary.label },
  ghost: { fill: B.ghost.fill, pressedFill: B.ghost.pressedFill, label: B.ghost.label, pressedLabel: B.ghost.label },
  quietPaper: { fill: ref.color.paper, pressedFill: ref.color.paper, label: B.quiet.paper.label, pressedLabel: B.quiet.paper.pressedLabel },
  quietDark: { fill: ref.color.void, pressedFill: ref.color.void, label: B.quiet.dark.label, pressedLabel: B.quiet.dark.pressedLabel },
} as const;

const LABEL_TYPE = { primary: ref.type.ctaLabel, ghost: ref.type.headline, quiet: ref.type.headline } as const;
const HEIGHT: Record<PillVariant, number> = { primary: B.primary.height, ghost: B.ghost.height, quiet: B.quiet.height };

// The small native ActivityIndicator is 20 x 20 on iOS, the same as ref.icon.header.
const SPINNER_SIZE = ref.icon.header;
// A button that can go busy reserves 16 + 20 + 8 = 44 on both sides, so the
// centred label never shifts or runs under the indicator.
const SPINNER_PAD = ref.space.lg + SPINNER_SIZE + ref.space.sm;

type PressHandler = (e: GestureResponderEvent) => void;
type FocusHandler = (e: NativeSyntheticEvent<TargetedEvent>) => void;

export interface PillButtonProps {
  /** One line, ESCAPD's copy. Also the accessibility label unless one is given. */
  label: string;
  onPress?: PressHandler;
  /** Default "primary". Changing it cross-fades fill and label colour over ref.motion.control. */
  variant?: PillVariant;
  /** Quiet only: default "paper" (raised label, as 03's secondary action); "dark" for a white label on a dark screen. */
  ground?: PillGround;
  /** Whole control at ref.button.disabledOpacity.pill, no press response, `disabled` state. */
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
  /** Default true for primary and ghost (full content width), false for quiet (label + 16 each side, centred). */
  fullWidth?: boolean;
  /** Label side padding. Defaults: ref.space.xl for filled pills, ref.button.quiet.padX for quiet. `spinner` raises it to 44. */
  padX?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Only where a screen's spec caps text growth. */
  maxFontSizeMultiplier?: number;
  /**
   * The haptic as the pill is pressed in (see src/game/feedback.ts). Default "press" (a light impact);
   * "thud" for a weighty commit such as building a case; false where the action gives its own outcome haptic at once.
   */
  haptic?: "press" | "thud" | false;
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
 * The reference look's pill button (ref.button.primary / ghost / quiet).
 * Pressed is a colour change over ref.motion.control; there is no opacity or
 * scale on press. No shadow. The label grows with the system text size and
 * may wrap; the pill grows with it (64, 52 and 48 are minimums). Shows the
 * brass focus ring (ref.focus) around the capsule.
 */
export function PillButton({
  label,
  onPress,
  variant = "primary",
  ground = "paper",
  disabled = false,
  busy = false,
  spinner = false,
  fullWidth,
  padX,
  accessibilityLabel,
  accessibilityHint,
  maxFontSizeMultiplier,
  haptic = "press",
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
  const palette = PALETTES[variant === "quiet" ? (ground === "dark" ? "quietDark" : "quietPaper") : variant];
  const labelType = LABEL_TYPE[variant];
  const colors = usePaletteTransition(palette);
  const press = usePressProgress();
  const focus = useFocusRing({ onFocus, onBlur });
  const feedback = useFeedback();

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
        if (haptic) feedback[haptic]();
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
        // button has no vertical padding, so it stays 48 (label centred by
        // styles.base) until its label outgrows it.
        { minHeight: height, paddingHorizontal: sidePad, paddingVertical: filled ? (height - labelType.lineHeight) / 2 : 0 },
        stretch ? styles.stretch : styles.hug,
        disabled && styles.disabled,
        style,
      ]}
    >
      {filled ? (
        <Animated.View pointerEvents="none" style={[styles.surface, variant === "ghost" && styles.hairline, surfaceStyle]} />
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
  surface: { ...StyleSheet.absoluteFill, borderRadius: ref.radius.round, ...ref.curve },
  // A solid edge: a translucent border would mix with the pill's own fill.
  hairline: { borderWidth: B.ghost.borderWidth, borderColor: B.ghost.border },
  label: { textAlign: "center" },
  spinnerSlot: { position: "absolute", top: 0, bottom: 0, right: ref.space.lg, justifyContent: "center" },
  disabled: { opacity: B.disabledOpacity.pill },
});
