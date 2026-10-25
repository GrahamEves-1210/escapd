import Svg, { G, Path } from "react-native-svg";
import { color } from "@/theme/tokens";

// Geometric ESCAPD wordmark. The stem of the final D is cut by a keyhole
// notch, lit by one brass edge.
const STROKE = 8;
const LETTERS: { width: number; d: string }[] = [
  { width: 36, d: "M34 4H4V56H34M4 30H28" },
  { width: 38, d: "M34 12C31 7 26 4 19.5 4C11 4 5 8.5 5 15.5C5 23 11 26 19.5 28.5C28.5 31 34 34 34 42.5C34 50.5 27.5 56 19 56C11.5 56 6 52.5 3.5 47" },
  { width: 40, d: "M37 13.5C33.5 7.5 27.5 4 20.5 4C10.5 4 4 15.5 4 30C4 44.5 10.5 56 20.5 56C27.5 56 33.5 52.5 37 46.5" },
  { width: 44, d: "M3 56L22 4L41 56M10 39H34" },
  { width: 36, d: "M4 56V4H20C29 4 34 9.5 34 17.5C34 25.5 29 31 20 31H4" },
  { width: 40, d: "M4 30V4M4 4H18C30 4 37 15 37 30C37 45 30 56 18 56H8" },
];
const GAP = 10;
const VIEW_WIDTH = LETTERS.reduce((w, l) => w + l.width, 0) + GAP * (LETTERS.length - 1);
const VIEW_HEIGHT = 60;
// Left edge of each letter in the viewBox.
const OFFSETS = LETTERS.map((_, i) => LETTERS.slice(0, i).reduce((x, l) => x + l.width + GAP, 0));
const D_X = OFFSETS[OFFSETS.length - 1];

export function Wordmark({
  height = 28,
  tint = color.text,
  edgeColor = color.accent,
}: {
  height?: number;
  tint?: string;
  /** The D's lit doorway edge. Defaults to the live brass; Noir screens pass ref.color.bright. */
  edgeColor?: string;
}) {
  return (
    <Svg
      width={(height * VIEW_WIDTH) / VIEW_HEIGHT}
      height={height}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      accessibilityRole="image"
      accessibilityLabel="ESCAPD"
    >
      <G fill="none" stroke={tint} strokeWidth={STROKE} strokeLinejoin="miter">
        {LETTERS.map((l, i) => (
          <Path key={i} d={l.d} transform={`translate(${OFFSETS[i]} 0)`} />
        ))}
      </G>
      {/* The doorway: the lower stem of the D is open, with a lit edge. */}
      <Path d={`M${D_X + 1} 36V60`} stroke={edgeColor} strokeWidth={2} />
    </Svg>
  );
}
