// The hub's geometry rules (docs/DESIGN.md, 01 · Game mode: Layout totals;
// States: Large text / narrow screens, Short screens). Everything comes from
// tokens: ref for the reference look, ref.layout.hub for the hub's own.
import type { FloorGlowToken } from "@/components/noir";
import { ref } from "@/theme/tokens";

const H = ref.layout.hub;
const W = H.weights;
const F = H.fan;
const B = ref.button;
const T = ref.type;

/** The chip's 36 disc sits in a 48 hit box: 6 of padding on every side. */
export const CHIP_PAD = (B.chip.hit - B.chip.size) / 2;

/** Safe top to the column: the chip row (top 12, the 36 disc), lg 16 and the 1 pt divider: 65 (y 59-124 on 852). */
export const HEADER_HEIGHT = H.header.top + B.chip.size + ref.space.lg + H.hairline;

/** A card's corner: Opal's 16.9 % of the card's width (23.7 on the 140 card; 31.5 on Opal's 187). */
export const CARD_RADIUS = H.card.width * B.gameCard.radiusRatio;

/** The tag pill's top in a fan card: Opal's 24. */
export const TAG_TOP = H.card.tagTop;

/**
 * How much of a side card's inner edge the centre card covers at card-local
 * height `v`: 29.9 at the top, 63.5 at the foot. A side card centres each of
 * its elements on the face left exposed at that element's middle.
 */
export function coveredWidth(v: number): number {
  const { top, foot } = F.cover;
  return top + ((foot - top) * v) / H.card.height;
}

/** Title (22/28), xs, subtitle (17/22): 54 at the default text size. */
export function headingHeight(fontScale: number): number {
  return (T.title.lineHeight + T.subtitle.lineHeight) * fontScale + ref.space.xs;
}

/** The heading, band 28 and the fan container at `scale`: 417 at the default size. */
export function heroBlock(fontScale: number, scale = 1): number {
  return headingHeight(fontScale) + ref.space.band + F.height * scale;
}

/** The column between the divider and the safe bottom (694 on 852 with safe areas 59 / 34). */
export function columnHeight(windowHeight: number, insets: { top: number; bottom: number }): number {
  return windowHeight - insets.top - insets.bottom - HEADER_HEIGHT;
}

/**
 * The fan's scale: whole on its 393 design width with room for the hero
 * block; narrower or shorter screens scale the whole fan down (cards, pills
 * and icons together) so it never clips.
 */
export function fanScale(width: number, column: number, fontScale: number): number {
  const byWidth = width / F.designWidth;
  const byHeight = (column - headingHeight(fontScale) - ref.space.band) / F.height;
  return Math.min(1, byWidth, byHeight);
}

/**
 * The fan needs the default text size or smaller (a side card's tag pill
 * only just fits its exposed face) and a scale of at least 0.75; otherwise
 * the cards stack.
 */
export function fanFits(fontScale: number, scale: number): boolean {
  return fontScale <= F.maxFontScale && scale >= F.minScale;
}

/**
 * The spacer above the title: the column's free space at 131 : 96, but never
 * more than Opal's 124 band; the rest goes below the cards (124 on 852).
 */
export function topSpacer(column: number, fontScale: number, scale = 1): number {
  const free = Math.max(0, column - heroBlock(fontScale, scale));
  return Math.min(H.band, (free * W.above) / (W.above + W.below));
}

/** The fan container's top on screen (330 on 852). */
export function fanTop(windowHeight: number, insets: { top: number; bottom: number }, fontScale: number, scale = 1): number {
  const column = columnHeight(windowHeight, insets);
  return insets.top + HEADER_HEIGHT + topSpacer(column, fontScale, scale) + headingHeight(fontScale) + ref.space.band;
}

/**
 * The floor glow fitted to the fan, as Opal's is: it starts at the cards'
 * centre and is full by the fan's foot (0.575 / 0.78 of the height on 852,
 * the token's own 0.58 / 0.79), so the cards' olive feet sit on lit floor.
 */
export function fanGlow(windowHeight: number, top: number, scale = 1): FloorGlowToken {
  return {
    ...ref.gradient.bottomGlow,
    fadeStart: (top + (H.card.height / 2) * scale) / windowHeight,
    fadeEnd: (top + F.height * scale) / windowHeight,
  };
}

/** Layout marks, each in its column's own coordinates. */
export interface Marks {
  /** The stacked column's top spacer, frozen while the notice shows so nothing above it moves. */
  topSpacer?: number;
}
