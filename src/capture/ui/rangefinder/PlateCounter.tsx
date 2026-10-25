// The plate counter: a 72 x 72 panel window, like a film camera's exposure
// counter. A mono label ("PLATE", "FULL" or "RETAKE") over the Roman numeral
// of the plate about to be taken. It has no neighbouring numerals and never
// rolls: a new numeral swaps in place with a ref.motion.control opacity
// change. Display only. The window is fixed at every text size, so the label
// and numeral cap at counterMaxFontScale; the accessibility label carries the
// full sentence.
//
// Display only, so it is no keyboard stop: on Android `accessible` would make
// it keyboard-focusable, so there it is screenReaderFocusable instead, and its
// texts stay out of Android's accessibility tree (Android 7-8.1 ignore
// screenReaderFocusable and still read it once, by its label).
import { Platform, StyleSheet } from "react-native";
import Animated, { FadeIn, LayoutAnimationConfig, ReduceMotion } from "react-native-reanimated";
import { NoirText, Panel, toEasing } from "@/components/noir";
import { ref } from "@/theme/tokens";

const L = ref.layout.camera;

const SWAP_IN = FadeIn.duration(ref.motion.control.duration)
  .easing(toEasing(ref.motion.control.easing))
  .reduceMotion(ReduceMotion.Never);

export interface PlateCounterProps {
  label: string;
  numeral: string;
  accessibilityLabel: string;
}

export function PlateCounter({ label, numeral, accessibilityLabel }: PlateCounterProps) {
  return (
    <Panel
      style={styles.window}
      accessible={Platform.OS === "ios"}
      screenReaderFocusable
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      testID="plate-counter"
    >
      {/* The first label and numeral appear with the screen; later ones fade in. */}
      <LayoutAnimationConfig skipEntering>
        <Animated.View key={`label-${label}`} entering={SWAP_IN}>
          <NoirText
            variant="label"
            align="center"
            centerTracking
            maxFontSizeMultiplier={L.counterMaxFontScale}
            importantForAccessibility="no"
            style={styles.unclamped}
          >
            {label}
          </NoirText>
        </Animated.View>
        <Animated.View key={`numeral-${numeral}`} entering={SWAP_IN}>
          <NoirText
            variant="code"
            align="center"
            centerTracking
            maxFontSizeMultiplier={L.counterMaxFontScale}
            importantForAccessibility="no"
            style={styles.unclamped}
          >
            {numeral}
          </NoirText>
        </Animated.View>
      </LayoutAnimationConfig>
    </Panel>
  );
}

const styles = StyleSheet.create({
  // 16 label line + 4 + 34 numeral line = 54, centred: 9 clear above and below.
  window: {
    width: L.plateBox,
    height: L.plateBox,
    alignItems: "center",
    justifyContent: "center",
    gap: ref.space.xs,
  },
  // At the 1.25 cap "III" needs a little more than the 70 inner width: iOS
  // tracks after the last glyph (plus the centring pad), and Android scales
  // tracking by the uncapped text size. Measured against the 70 box it would
  // break onto two lines and overflow the window, so each line measures
  // against 70 + 2 x ref.space.sm and stays centred. Only the trailing
  // tracking crosses the inner edge; the glyphs stay inside the window.
  unclamped: { marginHorizontal: -ref.space.sm },
});
