// The cat's outfit (catAccessory.ts): a tiny bow, a bell collar, a beret or a
// flower crown, drawn in the cat's inky hand over its art. It's drawn inside
// the cat's body, so it follows its head as it turns, bobs and squashes. Each
// cat says where on its art each one sits (art px: its middle, width, turn).
import { memo } from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import type { CatAccessory } from "../catAccessory";

/** Where an accessory sits on a cat's art: its middle (art px), its width (art px) and its turn (degrees). */
export type Placement = { x: number; y: number; w: number; rotate: number };
export type Placements = Record<Exclude<CatAccessory, "none">, Placement>;

const INK = "#1A0F16";
/** The collar's band: a deep cherry, bright on black fur. */
const COLLAR = "#D2445A";
/** Each drawing's box (its viewBox), so its height follows from its width. */
const BOX: Record<Exclude<CatAccessory, "none">, [number, number]> = {
  bow: [60, 40], bell: [120, 80], beret: [100, 56], flowers: [140, 50],
};

function Drawing({ kind, sweet, foil }: { kind: Exclude<CatAccessory, "none">; sweet: string; foil: string }) {
  switch (kind) {
    case "bow":
      return (
        <G>
          {/* Two loops and their tails, a knot in the middle. */}
          <Path d="M28 20 C18 4 4 4 4 18 C4 32 18 34 28 22 Z" fill={sweet} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M32 20 C42 4 56 4 56 18 C56 32 42 34 32 22 Z" fill={sweet} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M26 24 L18 38 M34 24 L42 38" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
          <Path d="M27 24 L20 37 M33 24 L40 37" stroke={sweet} strokeWidth={1.8} strokeLinecap="round" />
          <Ellipse cx={30} cy={21} rx={6.5} ry={7.5} fill={sweet} stroke={INK} strokeWidth={3} />
          <Path d="M12 13 C14 10 18 10 20 12" stroke="#FFF4EE" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
        </G>
      );
    case "bell":
      return (
        <G>
          {/* A wide red band round its neck, stitched, with a big gold bell hanging from its ring. */}
          <Path d="M4 8 C36 28 84 28 116 8 L114 24 C84 44 36 44 6 24 Z" fill={COLLAR} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
          <Path d="M12 17 C40 33 80 33 108 17" stroke="#FFD9DF" strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" fill="none" opacity={0.85} />
          <Circle cx={60} cy={36} r={5} fill="none" stroke={INK} strokeWidth={3} />
          <Circle cx={60} cy={58} r={20} fill={foil} stroke={INK} strokeWidth={3.5} />
          <Path d="M41 56 C52 60 68 60 79 56" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
          {/* Its slit, and the clapper. */}
          <Path d="M60 62 L60 74" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <Circle cx={60} cy={66} r={4} fill={INK} />
          <Path d="M48 48 C51 43 55 41 60 41" stroke="#FFF4EE" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.85} />
        </G>
      );
    case "beret":
      return (
        <G>
          {/* A slouchy beret, tipped to one side, its little stalk on top. */}
          <Path d="M8 40 C4 18 34 6 62 8 C90 10 100 26 92 38 C80 50 26 52 8 40 Z" fill="#7A2A44" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M14 42 C36 52 74 50 90 40" stroke="#4E1A2C" strokeWidth={5} strokeLinecap="round" fill="none" />
          <Path d="M58 8 L60 1" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <Path d="M28 20 C38 14 52 12 62 14" stroke="#B8586F" strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.8} />
        </G>
      );
    case "flowers": {
      // Five little flowers along a sprig of leaves, across its brow.
      const flowers: [number, number, string][] = [[14, 36, sweet], [42, 22, "#FFF1D6"], [70, 16, sweet], [98, 22, "#C9B6F5"], [126, 36, "#FFF1D6"]];
      return (
        <G>
          <Path d="M4 42 C40 14 100 14 136 42" stroke="#5E8A5A" strokeWidth={4} strokeLinecap="round" fill="none" />
          {[[28, 26, -30], [56, 16, -10], [84, 16, 10], [112, 26, 30]].map(([x, y, r], i) => (
            <Ellipse key={i} cx={x} cy={y} rx={7} ry={3.5} fill="#7FAF76" stroke={INK} strokeWidth={1.5} transform={`rotate(${r} ${x} ${y})`} />
          ))}
          {flowers.map(([x, y, c], i) => (
            <G key={i}>
              {[0, 72, 144, 216, 288].map((a) => (
                <Circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * 5.5} cy={y + Math.sin((a * Math.PI) / 180) * 5.5} r={4.6} fill={c} stroke={INK} strokeWidth={1.6} />
              ))}
              <Circle cx={x} cy={y} r={3} fill={foil} stroke={INK} strokeWidth={1.2} />
            </G>
          ))}
        </G>
      );
    }
  }
}

/** The accessory on a cat drawn `width` points wide from art `artWidth` px wide (nothing for "none"). */
export const CatOutfit = memo(function CatOutfit({ kind, width, artWidth, at, sweet, foil }: {
  kind: CatAccessory; width: number; artWidth: number; at: Placements; sweet: string; foil: string;
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
        <Drawing kind={kind} sweet={sweet} foil={foil} />
      </Svg>
    </View>
  );
});
