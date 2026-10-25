// 03 · Camera permission: a quiet button, the live Button's "quiet" variant
// (transparent, label in `control` color.text, radius.control, at least
// hit.min tall, space.gutter each side of the label), centred under the
// primary button, with the screen's two waits (docs/DESIGN.md 03, States).
// Requesting: `disabled`, the live Button's dimmed, inert state. Library busy:
// the same dimmed, inert state with the label kept (no spinner: the thinking
// line above carries the progress) and accessibilityState { busy: true }; a
// disabled Pressable stays focusable, so the control keeps focus. The live
// Button draws its own brass focus ring.
import { StyleSheet } from "react-native";
import { Button } from "@/components/Button";

export interface QuietActionProps {
  label: string;
  onPress: () => void;
  /** Requesting: dimmed, no press response, `disabled` state. */
  disabled?: boolean;
  /** Library busy: dimmed, taps ignored, `{ disabled: true, busy: true }`, label and focus kept. */
  busy?: boolean;
  testID?: string;
}

export function QuietAction({ label, onPress, disabled = false, busy = false, testID }: QuietActionProps) {
  // Only while busy: an explicit accessibilityState replaces the Button's own.
  const held = busy ? { accessibilityState: { disabled: true, busy: true } } : null;
  return (
    <Button
      variant="quiet"
      label={label}
      onPress={onPress}
      disabled={disabled || busy}
      {...held}
      style={styles.slot}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  // Label width plus the Button's padding, centred in the column.
  slot: { alignSelf: "center" },
});
