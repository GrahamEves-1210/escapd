// A card's hero line icon (docs/DESIGN.md, 01 · Layout: Hero line icon), in
// Opal's icon style: ESCAPD's own line art, drawn in a 48-unit box
// (ref.icon.heroMin) that it nearly fills, shown at 68 on a fan card (ink
// about 62, as Opal's 62-68) or 48 on a stacked one; stroke 7.2 % of the size
// (4.9 at 68, Opal's; 3.5 at 48), round caps and joins, no fill, and one
// ref.gradient.line across the whole icon box (135°, lineStart lime to
// lineEnd aqua). Secondary strokes at ref.effect.secondaryLineOpacity
// (0.6). No halo: it reads as glowing because it is the brightest colour on
// the near-black glass. Static; it rotates with its card.
import { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, G, LinearGradient, Path } from "react-native-svg";
import { gradientLine, gradientStops } from "@/components/noir";
import { ref } from "@/theme/tokens";
import type { CardId } from "./caseStatus";

// The art's own unit box; the drawing scales to the size it is shown at.
const BOX = ref.icon.heroMin;
const STROKE = BOX * ref.icon.heroStrokeRatio;
const LINE = ref.gradient.line;

// Path data in the icon's own 48-unit box (artwork, not layout).
const ART: Record<CardId, { hero: string; secondary: string }> = {
  // An arched door on its threshold, with a keyhole.
  study: {
    hero: "M11 44V17a13 13 0 0 1 26 0v27M5 44h38",
    secondary: "M27.6 24a3.6 3.6 0 1 1-7.2 0a3.6 3.6 0 1 1 7.2 0M24 27.6v6",
  },
  // Four viewfinder corner brackets around a room corner: one vertical edge
  // and two floor lines diverging from its foot.
  room: {
    hero: "M4 15V4h11M33 4h11v11M44 33v11H33M15 44H4V33",
    secondary: "M24 13v14M24 27l-10 6M24 27l10 6",
  },
  // A dossier folder with its tab, sealed with a wax-seal circle.
  case: {
    hero: "M4 39V11a3 3 0 0 1 3-3h11l5 5h18a3 3 0 0 1 3 3v23a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z",
    secondary: "M30.5 27.5a6.5 6.5 0 1 1-13 0a6.5 6.5 0 1 1 13 0",
  },
};

/** The card's icon. Decorative: the card is one accessibility element with its own label. */
export function CardArt({ id, size }: { id: CardId; size: number }) {
  const art = ART[id];
  const gradient = `line${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    // The accessibility props sit on a View: on the web, Svg hands them to the DOM, which rejects them.
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
        <Defs>
          {/* One gradient across the icon box, so each stroke takes the colour of where it sits. */}
          <LinearGradient id={gradient} gradientUnits="userSpaceOnUse" {...gradientLine(LINE.angle, BOX, BOX)}>
            {gradientStops(LINE.stops)}
          </LinearGradient>
        </Defs>
        <G fill="none" stroke={`url(#${gradient})`} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
          <Path d={art.secondary} strokeOpacity={ref.effect.secondaryLineOpacity} />
          <Path d={art.hero} />
        </G>
      </Svg>
    </View>
  );
}
