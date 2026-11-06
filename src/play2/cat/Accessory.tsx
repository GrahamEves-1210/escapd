// The cat's outfit (catAccessory.ts): a leather collar with a brass bell, a
// cable-knit scarf, round brass spectacles or a tweed deerstalker, drawn in
// the cat's inky hand over its art: a detective's cat, not a doll. It's drawn
// inside the cat's body, so it follows its head as it turns, bobs and
// squashes. Each cat says where on its art each one sits (art px: its middle,
// width, turn).
import { memo } from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import type { CatAccessory } from "../catAccessory";

/** Where an accessory sits on a cat's art: its middle (art px), its width (art px) and its turn (degrees). */
export type Placement = { x: number; y: number; w: number; rotate: number };
export type Placements = Record<Exclude<CatAccessory, "none">, Placement>;

const INK = "#1A0F16";
/** The outfits' own colours: worn leather and its stitching, oatmeal wool, tweed. */
export const OUTFIT_INK = {
  leather: "#6E3B24",
  leatherDark: "#4A2615",
  stitch: "#D9B98A",
  wool: "#E8DCC3",
  woolShade: "#BFA983",
  woolStripe: "#5A2E4A",
  tweed: "#9C7A52",
  tweedDark: "#6A4E31",
  tweedCheck: "#B4553F",
  glint: "#FFF4E2",
} as const;
const O = OUTFIT_INK;
/** Each drawing's box (its viewBox), so its height follows from its width. */
const BOX: Record<Exclude<CatAccessory, "none">, [number, number]> = {
  collar: [120, 80], scarf: [140, 100], specs: [164, 68], deerstalker: [130, 78],
};

function Drawing({ kind, foil }: { kind: Exclude<CatAccessory, "none">; foil: string }) {
  switch (kind) {
    case "collar":
      return (
        <G>
          {/* A worn leather band, stitched along its edge, a brass buckle at one side and a brass bell from its ring. */}
          <Path d="M4 8 C36 28 84 28 116 8 L114 24 C84 44 36 44 6 24 Z" fill={O.leather} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
          <Path d="M10 21 C40 39 80 39 110 21" stroke={O.leatherDark} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M12 15 C40 31 80 31 108 15" stroke={O.stitch} strokeWidth={1.8} strokeDasharray="4 5" strokeLinecap="round" fill="none" opacity={0.9} />
          <Path d="M21 13 L35 19 L32 35 L18 29 Z" fill="none" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <Path d="M21 13 L35 19 L32 35 L18 29 Z" fill="none" stroke={foil} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M27 16 L25 32" stroke={foil} strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx={60} cy={37} r={4.5} fill="none" stroke={INK} strokeWidth={3} />
          <Circle cx={60} cy={57} r={17} fill={foil} stroke={INK} strokeWidth={3.5} />
          <Path d="M44 55 C53 59 67 59 76 55" stroke={INK} strokeWidth={2.8} strokeLinecap="round" fill="none" />
          {/* Its slit, and the clapper. */}
          <Path d="M60 61 L60 71" stroke={INK} strokeWidth={3.6} strokeLinecap="round" />
          <Circle cx={60} cy={64} r={3.4} fill={INK} />
          <Path d="M50 48 C52.5 44 56 42 60 42" stroke={O.glint} strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.85} />
        </G>
      );
    case "scarf":
      return (
        <G strokeLinejoin="round">
          {/* Its two ends hanging from the knot, striped in plum, fringed. */}
          <Path d="M40 44 L28 88 L48 92 L56 46 Z" fill={O.wool} stroke={INK} strokeWidth={3} />
          <Path d="M31.5 75 L50.5 78.5 M30 81 L49.5 84.5" stroke={O.woolStripe} strokeWidth={3.4} strokeLinecap="round" />
          <Path d="M30 89 L28.5 97 M36 90.5 L35 98 M42 91.5 L41.5 98.5 M47.5 92.5 L47.5 98.5" stroke={INK} strokeWidth={2} strokeLinecap="round" />
          <Path d="M54 44 L62 86 L80 81 L66 42 Z" fill={O.wool} stroke={INK} strokeWidth={3} />
          <Path d="M60 72 L76 67.5 M61.5 78 L77.5 73.5" stroke={O.woolStripe} strokeWidth={3.4} strokeLinecap="round" />
          <Path d="M64 86 L65 93 M70 84.5 L71.5 91.5 M76 83 L78 89.5" stroke={INK} strokeWidth={2} strokeLinecap="round" />
          {/* The band round its neck, chunky, a row of knit stitches along it. */}
          <Path d="M4 12 C40 36 100 36 136 12 L134 32 C100 58 40 58 6 32 Z" fill={O.wool} stroke={INK} strokeWidth={3.5} />
          <Path d="M9 28 C40 50 100 50 131 28" stroke={O.woolShade} strokeWidth={4} strokeLinecap="round" fill="none" />
          {Array.from({ length: 11 }, (_, i) => {
            // Little Vs along the band's middle, like knit.
            const u = (i + 0.5) / 11;
            const x = 8 + u * 124;
            const y = 22 + Math.sin(u * Math.PI) * 18;
            return <Path key={i} d={`M${x - 3.2} ${y - 3} L${x} ${y + 1.6} L${x + 3.2} ${y - 3}`} stroke={O.woolShade} strokeWidth={1.8} strokeLinecap="round" fill="none" />;
          })}
          {/* The knot. */}
          <Ellipse cx={50} cy={44} rx={12} ry={10} fill={O.wool} stroke={INK} strokeWidth={3} />
          <Path d="M44 41 C47 46 53 47 56 43" stroke={O.woolShade} strokeWidth={2} strokeLinecap="round" fill="none" />
        </G>
      );
    case "specs":
      return (
        <G>
          {/* Round brass spectacles: two thin rims (the eyes show through), a bridge, a glint on each lens. */}
          {[32, 132].map((cx) => (
            <G key={cx}>
              <Circle cx={cx} cy={36} r={28} fill="rgba(255, 244, 226, 0.08)" stroke={INK} strokeWidth={7} />
              <Circle cx={cx} cy={36} r={28} fill="none" stroke={foil} strokeWidth={3.4} />
              <Path d={`M${cx - 17} ${30} C${cx - 15} ${22} ${cx - 9} ${17} ${cx - 2} ${16}`} stroke={O.glint} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.7} />
            </G>
          ))}
          <Path d="M59 31 C70 22 94 22 105 31" stroke={INK} strokeWidth={6.5} strokeLinecap="round" fill="none" />
          <Path d="M59 31 C70 22 94 22 105 31" stroke={foil} strokeWidth={3} strokeLinecap="round" fill="none" />
          {/* The arms, just begun, going back past its eyes. */}
          <Path d="M4 30 L1 24 M160 30 L163 24" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </G>
      );
    case "deerstalker":
      return (
        <G strokeLinejoin="round">
          {/* A tweed deerstalker, a peak front and back, its ear flaps tied up over the crown. */}
          <Path d="M32 52 C20 51 8 56 3 64 C15 67 30 63 39 57 Z" fill={O.tweedDark} stroke={INK} strokeWidth={3} />
          <Path d="M98 52 C110 51 122 56 127 64 C115 67 100 63 91 57 Z" fill={O.tweedDark} stroke={INK} strokeWidth={3} />
          <Path d="M24 56 C21 26 42 9 65 9 C88 9 109 26 106 56 C90 62 40 62 24 56 Z" fill={O.tweed} stroke={INK} strokeWidth={3.2} />
          {/* The check: a few lines across and down the crown. */}
          <Path d="M27 44 C50 39 80 39 103 44 M33 29 C52 23 78 23 97 29" stroke={O.tweedDark} strokeWidth={2} strokeLinecap="round" fill="none" />
          <Path d="M47 57 C44 38 52 20 62 11 M83 57 C86 38 78 20 68 11" stroke={O.tweedDark} strokeWidth={2} strokeLinecap="round" fill="none" />
          <Path d="M28 36 C50 31 80 31 102 36" stroke={O.tweedCheck} strokeWidth={1.3} strokeLinecap="round" fill="none" opacity={0.85} />
          <Path d="M65 58 C64 40 65 24 65 10" stroke={O.tweedCheck} strokeWidth={1.3} strokeLinecap="round" fill="none" opacity={0.85} />
          {/* The flaps, tied up, their strings meeting at the button on top. */}
          <Path d="M30 50 C27 38 33 30 41 31 C44 39 42 47 36 52 Z" fill={O.tweedDark} stroke={INK} strokeWidth={2.4} />
          <Path d="M100 50 C103 38 97 30 89 31 C86 39 88 47 94 52 Z" fill={O.tweedDark} stroke={INK} strokeWidth={2.4} />
          <Path d="M40 32 C48 20 58 13 65 11 C72 13 82 20 90 32" stroke={INK} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <Circle cx={65} cy={10} r={4} fill={O.tweedDark} stroke={INK} strokeWidth={2.4} />
          <Path d="M33 40 C34 30 42 22 52 18" stroke={O.glint} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.4} />
          {/* The band where it meets the head. */}
          <Path d="M25 55 C40 61 90 61 105 55" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
        </G>
      );
  }
}

/** The accessory on a cat drawn `width` points wide from art `artWidth` px wide (nothing for "none"); `foil` is its brass. */
export const CatOutfit = memo(function CatOutfit({ kind, width, artWidth, at, foil }: {
  kind: CatAccessory; width: number; artWidth: number; at: Placements; foil: string;
  /** No longer used (the outfits keep their own colours); kept so a caller passing it still reads. */
  sweet?: string;
}) {
  if (kind === "none") return null;
  const p = at[kind];
  const k = width / artWidth;
  const [bw, bh] = BOX[kind];
  const w = p.w * k, h = (p.w * bh * k) / bw;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", left: p.x * k - w / 2, top: p.y * k - h / 2, width: w, height: h, transform: [{ rotate: `${p.rotate}deg` }] }}
      testID={`cat-outfit-${kind}`}
    >
      <Svg width={w} height={h} viewBox={`0 0 ${bw} ${bh}`}>
        <Drawing kind={kind} foil={foil} />
      </Svg>
    </View>
  );
});
