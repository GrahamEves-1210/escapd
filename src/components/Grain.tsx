import { Image, StyleSheet } from "react-native";

const GRAIN = require("../../assets/grain.png");

const styles = StyleSheet.create({
  // The tile is full-contrast noise. Four percent lets the soot canvas through.
  grain: { opacity: 0.04 },
});

/** Subtle matte grain for app chrome and sheets. Never draw it over a room photo. */
export function Grain() {
  return (
    <Image
      source={GRAIN}
      resizeMode="repeat"
      style={[StyleSheet.absoluteFill, styles.grain]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
