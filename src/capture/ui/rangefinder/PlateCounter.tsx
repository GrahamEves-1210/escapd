// The plate counter, like a film camera's exposure counter: the last-plate
// thumbnail's twin, a 72 x 72 walnut mount (color.surface, 1 pt
// color.hairline, radius.thumbRing) around a 64 x 64 canvas plate 4 in
// (radius.thumb, 1 pt color.rim). On it, in brass: a mono stamp ("PLATE",
// "FULL" or "RETAKE") over the Roman numeral of the plate about to be taken
// in the live code mono (JetBrains Mono SemiBold 28/34, tabular). It has no
// neighbouring numerals and never rolls: a new numeral swaps in place with a
// ref.motion.control opacity change. Display only. The window is fixed at
// every text size, so the label and numeral cap at counterMaxFontScale; the
// accessibility label carries the full sentence. The lines measure against
// the whole 72 window, not the plate, so "III" never breaks at the cap.
//
// Display only, so it is no keyboard stop: on Android `accessible` would make
// it keyboard-focusable, so there it is screenReaderFocusable instead, and its
// texts stay out of Android's accessibility tree (Android 7-8.1 ignore
// screenReaderFocusable and still read it once, by its label).
import { Platform, StyleSheet, View } from "react-native";
import Animated, { FadeIn, LayoutAnimationConfig, ReduceMotion } from "react-native-reanimated";
import { toEasing, trackingPad } from "@/components/noir";
import { Text } from "@/components/Text";
import { color, curve, radius, ref, space, type as typeScale } from "@/theme/tokens";
import { MOUNT_PAD } from "./LastPlate";

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
    <View
      style={styles.window}
      accessible={Platform.OS === "ios"}
      screenReaderFocusable
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      testID="plate-counter"
    >
      <View pointerEvents="none" style={styles.mount} />
      <View pointerEvents="none" style={styles.plate} />
      {/* The first label and numeral appear with the screen; later ones fade in. */}
      <LayoutAnimationConfig skipEntering>
        <Animated.View key={`label-${label}`} entering={SWAP_IN}>
          <Text
            variant="stamp"
            tone="accent"
            align="center"
            maxFontSizeMultiplier={L.counterMaxFontScale}
            importantForAccessibility="no"
            style={trackingPad(typeScale.stamp)}
          >
            {label}
          </Text>
        </Animated.View>
        <Animated.View key={`numeral-${numeral}`} entering={SWAP_IN}>
          <Text variant="code" tone="accent" align="center" maxFontSizeMultiplier={L.counterMaxFontScale} importantForAccessibility="no">
            {numeral}
          </Text>
        </Animated.View>
      </LayoutAnimationConfig>
    </View>
  );
}

const styles = StyleSheet.create({
  // 14 label line + 2 + 34 numeral line = 50, centred: 11 clear above and
  // below in the 72 window, 7 inside the plate. At the 1.25 cap, 17.5 + 2 +
  // 42.5 = 62 still sits inside the 64 plate.
  window: {
    width: L.plateBox,
    height: L.plateBox,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xxs,
  },
  mount: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.surface,
    borderWidth: L.hairline,
    borderColor: color.hairline,
    borderRadius: radius.thumbRing,
    ...curve,
  },
  plate: {
    position: "absolute",
    top: MOUNT_PAD,
    left: MOUNT_PAD,
    right: MOUNT_PAD,
    bottom: MOUNT_PAD,
    backgroundColor: color.canvas,
    borderWidth: L.hairline,
    borderColor: color.rim,
    borderRadius: radius.thumb,
    ...curve,
  },
});
