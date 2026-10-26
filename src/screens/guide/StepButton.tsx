// The step button (docs/DESIGN.md 04, Layout: Step button; States: Final
// step, Replay wait): Apple Health's dark pill, the kit's PillButton "ghost"
// (ref.button.ghost: 52 tall, a full capsule of shade #0A0A0A with a 1 pt
// hairline #1A1A1A, the white ref.type.headline label), x 38-355, y 762-814 on
// the base device. "Next" on steps 1-3 and "Open the camera" on step 4, the
// same pill throughout. Its accessibility hint says which step this is (the
// reference shows no step count). Replay's wait is its `busy` with the small
// spinner; the label stays. With larger text it grows upward from 814, and
// its slot reserves the longer label's height, so the label swap on step 4
// never moves the text or the drawing above it. Inside a mode it is the
// mode's primary button (ModePill: the mode's accent capsule at the same
// 52, src/capture/ui/palette.ts).
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ModePill } from "@/capture/ui/ModePill";
import { ref } from "@/theme/tokens";
import { COPY, stepAnnouncement } from "./copy";

const GHOST = ref.button.ghost;
const LABEL = ref.type.headline;
// PillButton pads a filled pill's label to its height (52 - 22 = 15 above and
// below), and a button that can show the spinner by 16 + 20 + 8 = 44 each side.
const PAD_Y = GHOST.height - LABEL.lineHeight;
const PAD_X = ref.space.lg + ref.icon.header + ref.space.sm;

export function StepButton({ step, last, busy, onPress }: { step: number; last: boolean; busy: boolean; onPress: () => void }) {
  const [labelHeight, setLabelHeight] = useState(0);
  const reserve = Math.max(GHOST.height, labelHeight + PAD_Y);
  return (
    <View style={[styles.slot, { minHeight: reserve }]}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.sizer}>
        <Text style={[LABEL, styles.sizerLabel]} onLayout={(e) => setLabelHeight(e.nativeEvent.layout.height)}>
          {COPY.openCamera}
        </Text>
      </View>
      <ModePill
        label={last ? COPY.openCamera : COPY.next}
        variant="ghost"
        busy={busy}
        spinner
        accessibilityHint={stepAnnouncement(step)}
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
  // PillButton's own side padding, so the copy wraps exactly as its label does.
  sizerLabel: { textAlign: "center", paddingHorizontal: PAD_X },
});
