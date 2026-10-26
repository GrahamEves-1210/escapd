// The capture flow's pills in the active mode: 03's pill and quiet buttons,
// 04's step button, and (round 6) every primary and quiet action that wears
// the step button's look: the review's "Build the case", the build wait and
// state screens, the player's sheets and case closed. In the shell it is the
// kit's PillButton, unchanged. Inside a mode it takes the mode's colours
// (src/capture/ui/palette.ts) at the kit's sizes and type:
// - primary (64, ctaLabel) and ghost (52, headline) are the mode's primary
//   button: an `accent` capsule with an `accentInk` label;
// - quiet (48, headline) is text only: the mode's ink on a dark ground
//   ("dark"), or its muted ink on 03's sheet ("paper", the sheet's quieter
//   way out, as the shell's grey on paper).
// Pressed: the whole pill at ref.button.square.pressedOpacity (the live 0.75
// press; the kit's colour step has no mode tokens). Disabled, busy, the
// spinner, the haptic and the brass focus ring behave as the kit's.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { FocusRing, PillButton, useFocusRing, type PillButtonProps } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";
import { useCapturePalette, type CapturePalette } from "./palette";

const B = ref.button;
const HEIGHT = { primary: B.primary.height, ghost: B.ghost.height, quiet: B.quiet.height } as const;
const LABEL = { primary: ref.type.ctaLabel, ghost: ref.type.headline, quiet: ref.type.headline } as const;
// As the kit: a pill that can go busy reserves 16 + 20 + 8 = 44 each side for the indicator.
const SPINNER_PAD = ref.space.lg + ref.icon.header + ref.space.sm;

export function ModePill(props: PillButtonProps) {
  const palette = useCapturePalette();
  if (palette.genre === null) return <PillButton {...props} />;
  return <ThemedPill {...props} palette={palette} />;
}

function ThemedPill({
  palette,
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
}: PillButtonProps & { palette: CapturePalette }) {
  const focus = useFocusRing({ onFocus, onBlur });
  const feedback = useFeedback();
  const filled = variant !== "quiet";
  const labelColor = filled ? palette.onPrimary : ground === "dark" ? palette.ink : palette.inkMuted;
  const height = HEIGHT[variant];
  const type = LABEL[variant];
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
      // As the kit: `disabled` only when true, so a busy pill stays focusable but reads as disabled.
      disabled={disabled || undefined}
      hitSlop={hitSlop}
      testID={testID}
      onPress={busy ? undefined : onPress}
      onLongPress={busy ? undefined : onLongPress}
      onPressIn={(e) => {
        if (busy) return;
        if (haptic) feedback[haptic]();
        onPressIn?.(e);
      }}
      onPressOut={onPressOut}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={({ pressed }) => [
        styles.base,
        { minHeight: height, paddingHorizontal: sidePad, paddingVertical: filled ? (height - type.lineHeight) / 2 : 0 },
        filled ? { backgroundColor: palette.primary } : null,
        stretch ? styles.stretch : styles.hug,
        disabled ? styles.disabled : pressed && !busy ? styles.pressed : null,
        style,
      ]}
    >
      <Text style={[type, styles.label, { color: labelColor }]} maxFontSizeMultiplier={maxFontSizeMultiplier}>
        {label}
      </Text>
      {busy && spinner ? (
        <View pointerEvents="none" style={styles.spinnerSlot}>
          <ActivityIndicator size="small" color={labelColor} testID={testID ? `${testID}-spinner` : undefined} />
        </View>
      ) : null}
      <FocusRing visible={focus.focused} shape="pill" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", borderRadius: ref.radius.round, ...ref.curve },
  stretch: { alignSelf: "stretch" },
  hug: { alignSelf: "center" },
  label: { textAlign: "center" },
  spinnerSlot: { position: "absolute", top: 0, bottom: 0, right: ref.space.lg, justifyContent: "center" },
  pressed: { opacity: B.square.pressedOpacity },
  disabled: { opacity: B.disabledOpacity.pill },
});
