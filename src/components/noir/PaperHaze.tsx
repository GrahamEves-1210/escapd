// pushr's grey haze over paper (ref.gradient.haze), shared by 03 and 05: a
// radial glow with its focal point up and right of its centre, and paper
// fading in over its foot so the page is white by fade.to. Static, no touches,
// hidden from accessibility. It draws only the haze; the screen paints the
// paper ground under it.
import { useId } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { ref } from "@/theme/tokens";
import { gradientStops } from "./gradient";

const H = ref.gradient.haze;

export function PaperHaze({ testID }: { testID?: string }) {
  const id = `haze${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const { width } = useWindowDimensions();
  const cx = width / 2 + H.centre.dx;
  const fx = width / 2 + H.focus.dx;
  // The haze's whole extent, down to where the paper has covered it.
  const bottom = H.centre.y + H.r;
  // The accessibility props sit on a View: on the web, Svg hands them to the DOM, which rejects them.
  return (
    <View
      style={styles.haze}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Svg width={width} height={bottom}>
        <Defs>
          <RadialGradient id={`${id}pool`} gradientUnits="userSpaceOnUse" cx={cx} cy={H.centre.y} fx={fx} fy={H.focus.y} r={H.r}>
            {gradientStops(H.stops)}
          </RadialGradient>
          {/* Paper fading in over the haze's foot (stopOpacity carries the fade). */}
          <LinearGradient id={`${id}fade`} gradientUnits="userSpaceOnUse" x1={0} y1={H.fade.from} x2={0} y2={H.fade.to}>
            <Stop offset={0} stopColor={ref.color.paper} stopOpacity={0} />
            <Stop offset={1} stopColor={ref.color.paper} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={bottom} fill={`url(#${id}pool)`} />
        <Rect x={0} y={H.fade.from} width={width} height={bottom - H.fade.from} fill={`url(#${id}fade)`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  haze: { position: "absolute", top: 0, left: 0 },
});
