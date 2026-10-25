// The step button (docs/DESIGN.md 04, Layout: Step button; States: Final
// step, Replay wait). x 20-373, y 762-814 on the base device: the kit pill in
// the brass scheme, "Next" as the walnut secondary (brass hairline) on steps
// 1-3 and "Open the camera" as the brass primary on step 4 (the kit
// cross-fades fill and label colour over ref.motion.control). With larger
// text the pill grows upward from 814. Its slot reserves the height of the
// longer label, so the label swap on step 4 never moves the text or the
// mount above it.
import { useState } from "react";
import { Text as RNText, StyleSheet, View } from "react-native";
import { PillButton } from "@/components/noir";
import { ref, space } from "@/theme/tokens";
import { COPY } from "./copy";

// The kit pill's minimum height (52 for both variants) and its brass label type (type.control 15/20).
const PILL_HEIGHT = Math.max(ref.button.primary.height, ref.button.secondary.height);
const LABEL = ref.button.brass.labelType;

export function StepButton({ last, busy, onPress }: { last: boolean; busy: boolean; onPress: () => void }) {
  const [labelHeight, setLabelHeight] = useState(0);
  // A pill is its label's lines plus (52 - 20) of padding, and never under 52.
  const reserve = Math.max(PILL_HEIGHT, PILL_HEIGHT - LABEL.lineHeight + labelHeight);
  return (
    <View style={[styles.slot, { minHeight: reserve }]}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.sizer}>
        <RNText style={[LABEL, styles.sizerLabel]} onLayout={(e) => setLabelHeight(e.nativeEvent.layout.height)}>
          {COPY.openCamera}
        </RNText>
      </View>
      <PillButton
        label={last ? COPY.openCamera : COPY.next}
        scheme="brass"
        variant={last ? "primary" : "secondary"}
        busy={busy}
        onPress={onPress}
        testID="guide-step-button"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The light table's column: 353 wide on the base device. The pill sits at the slot's bottom.
  slot: { marginHorizontal: space.gutter, justifyContent: "flex-end" },
  sizer: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0 },
  // The pill's own label padding (space.xl, the kit's default for filled pills), so the copy wraps exactly as the label does.
  sizerLabel: { textAlign: "center", paddingHorizontal: space.xl },
});
