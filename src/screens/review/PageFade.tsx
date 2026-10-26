// A soft edge where the scrolling column meets something pinned: the page
// colour from clear to solid over `height`, so the photos slip under the
// foot (and out under the header) instead of being cut off. Decorative and
// untouchable; a plain hex colour with its stopOpacity, as every gradient.
import { useId } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

export function PageFade({ color, height, solidAt, style }: {
  /** The page colour (a plain hex). */
  color: string;
  height: number;
  /** Which edge is solid: "bottom" over a pinned foot, "top" under a pinned header. */
  solidAt: "top" | "bottom";
  style?: StyleProp<ViewStyle>;
}) {
  const id = `pageFade${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const clear = solidAt === "bottom" ? 0 : 1;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.fade, { height }, style]}
    >
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={color} stopOpacity={clear} />
            <Stop offset={1} stopColor={color} stopOpacity={1 - clear} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: "absolute", left: 0, right: 0 },
});
