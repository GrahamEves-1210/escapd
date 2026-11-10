// The frame's marks, drawn with the house pen (docs/ART_DIRECTION.md, "made
// by hand"): one line weight, round ends, gone over twice like the cat's and
// the item icons' (icons/art.ts), never a corporate icon set's. On brass
// they're engraved (a dark cut with a light lip under it); on the room
// they're cream ink over a soft dark copy, so they read on any photo.
import { memo } from "react";
import { View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { BRASS, hidden, INK } from "./materials";

export type InkName = "back" | "cross" | "left" | "right" | "down" | "up";

/** Each mark on a 24-unit grid, a touch off true like a pen's. */
const MARKS: Record<InkName, string> = {
  back: "M19.2 12.2 C14.6 11.7 9.8 12.3 5.4 12 M10.6 6.4 C8.8 8.4 7 10.2 4.9 12 C7 13.9 8.9 15.8 10.8 17.8",
  cross: "M6.4 6.2 C10 9.9 13.9 13.8 17.8 17.6 M17.6 6.4 C13.8 10.1 10 14 6.2 17.8",
  left: "M15.2 4.6 C12.4 7.2 9.8 9.6 7 12.1 C9.9 14.6 12.5 17 15.4 19.6",
  right: "M8.8 4.6 C11.6 7.2 14.2 9.6 17 12.1 C14.1 14.6 11.5 17 8.6 19.6",
  down: "M5.6 9 C7.8 11 9.8 13 12 15.2 C14.2 13 16.2 11 18.4 8.8",
  up: "M5.6 15 C7.8 13 9.8 11 12 8.8 C14.2 11 16.2 13 18.4 15.2",
};

/**
 * A mark at a size. `tone`: "engraved" (cut into brass), "ink" (a colour, gone
 * over twice), "chalk" (light over a soft dark copy, for marks on the photo).
 */
export const InkMark = memo(function InkMark({ name, size = 24, tone = "ink", color = INK, weight = 2.2 }: {
  name: InkName; size?: number; tone?: "engraved" | "ink" | "chalk"; color?: string; weight?: number;
}) {
  const d = MARKS[name];
  const line = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <View style={{ width: size, height: size }} {...hidden}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {tone === "engraved" ? (
          <G>
            <Path d={d} {...line} stroke={BRASS.sheen} strokeWidth={weight} opacity={0.8} transform="translate(0.5 0.9)" />
            <Path d={d} {...line} stroke={BRASS.deep} strokeWidth={weight} />
            <Path d={d} {...line} stroke={INK} strokeWidth={weight * 0.45} opacity={0.7} transform="translate(-0.2 -0.3)" />
          </G>
        ) : tone === "chalk" ? (
          <G>
            <Path d={d} {...line} stroke="rgba(0,0,0,0.6)" strokeWidth={weight + 2.4} transform="translate(0.4 1)" />
            <Path d={d} {...line} stroke={color} strokeWidth={weight} />
            <Path d={d} {...line} stroke={color} strokeWidth={weight * 0.45} opacity={0.55} transform="translate(0.5 -0.4)" />
          </G>
        ) : (
          <G>
            <Path d={d} {...line} stroke={color} strokeWidth={weight} />
            <Path d={d} {...line} stroke={color} strokeWidth={weight * 0.45} opacity={0.55} transform="translate(0.5 -0.4)" />
          </G>
        )}
      </Svg>
    </View>
  );
});
