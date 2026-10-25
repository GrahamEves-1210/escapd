// The step button (docs/DESIGN.md 04, Layout: Step button; States: Final
// step, Replay wait). x 38-355, y 762-814 on the base device: "Next" in
// ref.button.primary on steps 1-3, "Open the camera" in ref.button.signal on
// step 4 (the kit cross-fades fill and label colour over ref.motion.control).
// With larger text the capsule grows upward from 814. Its slot reserves the
// height of the longer label, so the label swap on step 4 never moves the
// text, the art or the pool above it.
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { NoirText, PillButton } from "@/components/noir";
import { ref } from "@/theme/tokens";
import { COPY } from "./copy";

const PILL = ref.button.primary;

export function StepButton({ last, busy, onPress }: { last: boolean; busy: boolean; onPress: () => void }) {
  const [labelHeight, setLabelHeight] = useState(0);
  // A pill is its label's lines plus (52 - 22) of padding, and never under 52.
  const reserve = Math.max(PILL.height, PILL.height - ref.type.button.lineHeight + labelHeight);
  return (
    <View style={[styles.slot, { minHeight: reserve }]}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.sizer}>
        <NoirText variant="button" align="center" style={styles.sizerLabel} onLayout={(e) => setLabelHeight(e.nativeEvent.layout.height)}>
          {COPY.openCamera}
        </NoirText>
      </View>
      <PillButton
        label={last ? COPY.openCamera : COPY.next}
        variant={last ? "signal" : "primary"}
        busy={busy}
        onPress={onPress}
        testID="guide-step-button"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The reading column: 317 wide on the base device. The pill sits at the slot's bottom.
  slot: { marginHorizontal: ref.space.reading, justifyContent: "flex-end" },
  sizer: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0 },
  // The pill's own label padding (ref.space.xl), so the copy wraps exactly as the label does.
  sizerLabel: { paddingHorizontal: ref.space.xl },
});
