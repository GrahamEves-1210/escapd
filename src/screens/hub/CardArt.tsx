// Game-card line art (docs/DESIGN.md, Images and 01 Layout: Line art). A
// 48 x 48 react-native-svg drawing in ref.illustration: stroke 1.6, round caps
// and joins, no fill, no gradient, no halo. Primary lines in the hero tone,
// secondary lines in the mid tone. Static; it rotates with its card.
import Svg, { G, Path } from "react-native-svg";
import { ref } from "@/theme/tokens";
import type { CardId } from "./caseStatus";

const SIZE = ref.layout.hub.card.art;
const I = ref.illustration;

// Path data in the art box's own 48-unit space (artwork, not layout).
const ART: Record<CardId, { primary: string; secondary: string }> = {
  // An arched door on its threshold, with a keyhole.
  study: {
    primary: "M15 41V19a9 9 0 0 1 18 0v22M11 41h26",
    secondary: "M21.5 26a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M23 28.4l-1 4.6h4l-1-4.6",
  },
  // Four viewfinder corner brackets around a room corner: one vertical edge
  // and two floor lines diverging from its foot.
  room: {
    primary: "M9 17V9h8M31 9h8v8M39 31v8h-8M17 39H9v-8",
    secondary: "M24 14v13M24 27l-10 6M24 27l10 6",
  },
  // A case folder with a tab, sealed with a circle.
  case: {
    primary: "M9 37V12h10l3 4h17v21z",
    secondary: "M19 27a5 5 0 1 0 10 0a5 5 0 1 0-10 0",
  },
};

/** The card's drawing. Decorative: the card is one accessibility element with its own label. */
export function CardArt({ id }: { id: CardId }) {
  const art = ART[id];
  return (
    <Svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <G fill="none" strokeWidth={I.stroke} strokeLinecap="round" strokeLinejoin="round">
        <Path d={art.secondary} stroke={I.mid} />
        <Path d={art.primary} stroke={I.hero} />
      </G>
    </Svg>
  );
}
