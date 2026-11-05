// The cat on the letters (src/play2/letters): the sitting cat (SittingCat),
// set down on the desk or on the paper itself, with the soft contact shadow
// of something really sitting there, so it is part of the scene and not a
// sticker laid over it.
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { SittingCat } from "../SittingCat";

/** The cat's art: its height for a width (SittingCat's aspect). */
export const CAT_ASPECT = 640 / 444;

export function LetterCat({ width, delay, label, shade = "#000000", style }: { width: number; delay: number; label: string; shade?: string; style?: StyleProp<ViewStyle> }) {
  const h = width * CAT_ASPECT;
  return (
    <View style={[{ width, height: h }, style]} pointerEvents="box-none">
      <View style={[styles.shadow, { width: width * 0.9, height: width * 0.22, left: width * 0.06, top: h - width * 0.15 }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height="100%" viewBox="0 0 100 24">
          <Defs>
            <RadialGradient id="catShade" cx="45%" cy="50%" rx="50%" ry="50%">
              <Stop offset={0} stopColor={shade} stopOpacity={0.5} />
              <Stop offset={0.6} stopColor={shade} stopOpacity={0.22} />
              <Stop offset={1} stopColor={shade} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={50} cy={12} rx={50} ry={12} fill="url(#catShade)" />
        </Svg>
      </View>
      <SittingCat width={width} delay={delay} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: "absolute" },
});
