// The guide's ghost pill as a secondary action beside the mode's primary one
// (home's continue prompt: "Start a new case" under "Continue"), the same
// pill as the review's "Add a photo" without its glyph: ref.button.ghost's
// 52 tall full capsule with a 1 pt hairline and the headline label. In the
// shell it is the guide's own dark pill (shade, hairline, white label); inside
// a mode (the store's or a ModeScope's) the mode's near-black ground as the
// fill, its rim as the hairline and its ink for the label
// (src/capture/ui/palette.ts), so the accent stays on the one strong action.
// Pressed: the fill steps up to the raised fill (the kit's ghost press) and
// the kit's press-in squash. The `press` haptic on press-in; the brass focus
// ring round it. Busy keeps it at full strength, ignores taps and shows the
// small spinner at its right (the label stays on the axis).
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { FocusRing, SquashPressable, useFocusRing } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";
import { useCapturePalette } from "./palette";

const GHOST = ref.button.ghost;
const LABEL = ref.type.headline;
// As the kit: 16 + 20 + 8 = 44 each side, room for the spinner.
const SIDE = ref.space.lg + ref.icon.header + ref.space.sm;

export interface OutlinePillProps {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

export function OutlinePill({ label, onPress, busy = false, disabled = false, accessibilityHint, testID }: OutlinePillProps) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const palette = useCapturePalette();
  const shell = palette.genre === null;
  const fill = shell ? GHOST.fill : palette.well;
  const pressedFill = shell ? GHOST.pressedFill : palette.raised;
  const edge = shell ? GHOST.border : palette.rim;
  const ink = shell ? GHOST.label : palette.ink;
  return (
    <SquashPressable
      squash={busy ? false : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || undefined}
      onPressIn={busy ? undefined : feedback.press}
      onPress={busy ? undefined : onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: pressed && !busy ? pressedFill : fill, borderColor: edge },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[LABEL, styles.label, { color: ink }]}>{label}</Text>
      {busy ? (
        <View pointerEvents="none" style={styles.spinner}>
          <ActivityIndicator size="small" color={ink} testID={testID ? `${testID}-spinner` : undefined} />
        </View>
      ) : null}
      <FocusRing visible={focus.focused} shape="pill" edge={GHOST.borderWidth} />
    </SquashPressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "stretch",
    minHeight: GHOST.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SIDE,
    paddingVertical: (GHOST.height - LABEL.lineHeight) / 2 - GHOST.borderWidth,
    borderWidth: GHOST.borderWidth,
    borderRadius: ref.radius.round,
    ...ref.curve,
  },
  label: { textAlign: "center" },
  spinner: { position: "absolute", top: 0, bottom: 0, right: ref.space.lg, justifyContent: "center" },
  disabled: { opacity: ref.button.disabledOpacity.pill },
});
