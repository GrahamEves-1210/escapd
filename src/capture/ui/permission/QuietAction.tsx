// 03 · Camera permission: a quiet button (ref.button.quiet: label + 16 each
// side, 44 tall, centred) with the screen's two waits (docs/DESIGN.md 03,
// States). Requesting: disabled, the whole control at
// ref.button.disabledOpacity. Library busy: the label stays at that opacity,
// taps are ignored and accessibilityState.busy is set, with no spinner, and the
// control keeps focus. The kit's busy pill keeps full opacity, so it is dimmed
// here, and its focus outline is redrawn above the dimmed layer so focus stays
// a full 2 pt ref.color.bright outline.
import { StyleSheet, View } from "react-native";
import { FocusRing, PillButton, useFocusRing } from "@/components/noir";
import { ref } from "@/theme/tokens";

export interface QuietActionProps {
  label: string;
  onPress: () => void;
  /** Requesting: ref.button.disabledOpacity, no press response, `disabled` state. */
  disabled?: boolean;
  /** Library busy: ref.button.disabledOpacity, taps ignored, `{ busy: true }`, focus kept. */
  busy?: boolean;
  testID?: string;
}

export function QuietAction({ label, onPress, disabled = false, busy = false, testID }: QuietActionProps) {
  const focus = useFocusRing();
  return (
    <View style={styles.slot}>
      <View style={busy ? styles.dimmed : undefined}>
        <PillButton
          variant="quiet"
          label={label}
          onPress={onPress}
          disabled={disabled}
          busy={busy}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
          testID={testID}
        />
      </View>
      {busy ? <FocusRing visible={focus.focused} shape="pill" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignSelf: "center" },
  dimmed: { opacity: ref.button.disabledOpacity },
});
