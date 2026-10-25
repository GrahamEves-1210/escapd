// The step button (docs/DESIGN.md 04, Layout: Step button; States: Final
// step, Replay wait). x 20-373, y 766-814 on the base device: the live Button
// (src/components/Button.tsx, the play screen's 8 pt-rounded button), "Next"
// as the secondary (walnut, 1 pt brass hairline) on steps 1-3 and "Open the
// camera" as the brass primary on step 4. Replay's wait is its `loading`: the
// spinner takes the label's place. With larger text the button grows upward
// from 814. Its slot reserves the height of the longer label, so the label
// swap on step 4 never moves the text or the mount above it.
import { useState } from "react";
import { Text as RNText, StyleSheet, View } from "react-native";
import { Button } from "@/components/Button";
import { hit, ref, space, type } from "@/theme/tokens";
import { COPY } from "./copy";

// The live Button: a type.control (15/20) label padded space.md above and
// below and space.gutter at the sides, never under hit.min 48. The
// secondary's 1 pt edge lies inside that, so with the same label it is 2
// taller than the primary once the label outgrows the 48.
const LABEL = type.control;
const PAD_Y = space.md;
const PAD_X = space.gutter;
const EDGE = ref.layout.guide.hairline;

export function StepButton({ last, busy, onPress }: { last: boolean; busy: boolean; onPress: () => void }) {
  const [labelHeight, setLabelHeight] = useState(0);
  // "Open the camera" as the primary, and the tallest either variant can be with that label.
  const primary = Math.max(hit.min, labelHeight + PAD_Y * 2);
  const reserve = Math.max(primary, labelHeight + (PAD_Y + EDGE) * 2);
  return (
    <View style={[styles.slot, { minHeight: reserve }]}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.sizer}>
        <RNText style={[LABEL, styles.sizerLabel]} onLayout={(e) => setLabelHeight(e.nativeEvent.layout.height)}>
          {COPY.openCamera}
        </RNText>
      </View>
      <Button
        label={last ? COPY.openCamera : COPY.next}
        variant={last ? "primary" : "secondary"}
        loading={busy}
        onPress={onPress}
        testID="guide-step-button"
        // Loading swaps the label for the spinner; the button keeps the label's height.
        style={busy ? { minHeight: primary } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The light table's column: 353 wide on the base device. The button sits at the slot's bottom.
  slot: { marginHorizontal: space.gutter, justifyContent: "flex-end" },
  sizer: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0 },
  // The live Button's own side padding, so the copy wraps exactly as its label does.
  sizerLabel: { textAlign: "center", paddingHorizontal: PAD_X },
});
