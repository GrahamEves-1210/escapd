import { StyleSheet } from "react-native";
import { Image, type ImageProps } from "expo-image";
import { ref } from "@/theme/tokens";

// The still at ref.background.asset ("assets/backgrounds/noir-warp-silk.webp"),
// shipped lossless. Metro needs a static require, so the path is repeated
// here; __tests__/kit-test.tsx checks it still matches the token.
const STILL = require("../../../assets/backgrounds/noir-warp-silk.webp");

/**
 * The black silk background still (01, 04 and 05 only; 02 and 03 stay flat
 * ground). One expo-image Image that fills its parent under all content:
 * contentFit cover, no touches, hidden from accessibility, never animated,
 * never over a photo. Render it first inside the screen's root view.
 */
export function BackgroundStill({ style }: { style?: ImageProps["style"] }) {
  return (
    <Image
      source={STILL}
      contentFit="cover"
      transition={0}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.still, style]}
    />
  );
}

const styles = StyleSheet.create({
  // Ground shows until the image decodes.
  still: { ...StyleSheet.absoluteFill, backgroundColor: ref.color.ground },
});
