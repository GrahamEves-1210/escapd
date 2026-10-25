// Card line art (docs/DESIGN.md, 01 · Layout: Line art). A 48 x 48
// react-native-svg drawing on the card's plate, in the play screen's warm
// palette: hero lines color.text, secondary lines color.textSecondary and the
// brass details in color.accent (the keyhole, the viewfinder brackets, the
// seal), like the brass registration marks on /play's plate. Stroke 1.6, round
// caps and joins, no fill, no gradient, no halo. Static; it rotates with its card.
import Svg, { G, Path } from "react-native-svg";
import { color, ref } from "@/theme/tokens";
import type { CardId } from "./caseStatus";

const C = ref.layout.hub.card;

// Path data in the art box's own 48-unit space (artwork, not layout).
const ART: Record<CardId, { hero: string; secondary: string; detail: string }> = {
  // An arched door on its threshold, with a brass keyhole.
  study: {
    hero: "M15 41V19a9 9 0 0 1 18 0v22",
    secondary: "M11 41h26",
    detail: "M21.5 26a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M23 28.4l-1 4.6h4l-1-4.6",
  },
  // A room corner (one vertical edge, two floor lines diverging from its
  // foot) inside four brass viewfinder brackets.
  room: {
    hero: "M24 14v13",
    secondary: "M24 27l-10 6M24 27l10 6",
    detail: "M9 17V9h8M31 9h8v8M39 31v8h-8M17 39H9v-8",
  },
  // A case folder with its tab ruled off, sealed with a brass circle.
  case: {
    hero: "M9 37V12h10l3 4h17v21z",
    secondary: "M9 16h13",
    detail: "M19 27a5 5 0 1 0 10 0a5 5 0 1 0-10 0",
  },
};

/** The card's drawing. Decorative: the card is one accessibility element with its own label. */
export function CardArt({ id }: { id: CardId }) {
  const art = ART[id];
  return (
    <Svg
      width={C.art}
      height={C.art}
      viewBox={`0 0 ${C.art} ${C.art}`}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <G fill="none" strokeWidth={C.artStroke} strokeLinecap="round" strokeLinejoin="round">
        <Path d={art.secondary} stroke={color.textSecondary} />
        <Path d={art.hero} stroke={color.text} />
        <Path d={art.detail} stroke={color.accent} />
      </G>
    </Svg>
  );
}
