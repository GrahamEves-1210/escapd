// Helpers for drawing ref.gradient tokens with react-native-svg.
import { Stop } from "react-native-svg";
import type { GradientStop } from "@/theme/tokens";

/**
 * The <Stop> elements for a gradient token, each with its colour and its own
 * stopOpacity (react-native-svg ignores an rgba() stop colour's alpha). Call
 * it inside the gradient: `<LinearGradient ...>{gradientStops(t.stops)}</LinearGradient>`.
 * It returns an array, not a component, because a gradient reads only its
 * direct <Stop> children.
 */
export function gradientStops(stops: readonly GradientStop[]) {
  return stops.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />);
}

const round = (n: number) => Math.round(n * 1e6) / 1e6 + 0;

/**
 * The CSS gradient line for a token's `angle` (0 = to top, 90 = to right, 180
 * = to bottom) in a width x height box: the start and end points in the box's
 * own coordinates, with the corners on offsets 0 and 1 as in CSS. Pass the
 * box's size and use gradientUnits="userSpaceOnUse" for an exact match. With
 * the default 1 x 1 the points are objectBoundingBox fractions: exact for 0,
 * 90, 180 and 270, a close match for diagonals on a near-square box.
 */
export function gradientLine(angle: number, width = 1, height = 1) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  return {
    x1: round(width / 2 - half * dx),
    y1: round(height / 2 - half * dy),
    x2: round(width / 2 + half * dx),
    y2: round(height / 2 + half * dy),
  };
}
