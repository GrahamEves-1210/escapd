// The hub's geometry rules (docs/DESIGN.md, 01 · Game mode: Layout totals;
// States: Large text / narrow screens, Short screens). Everything comes from
// tokens: the live scale for the look, ref.layout.hub for the hub's own.
import { hit, ref, space, type } from "@/theme/tokens";

const H = ref.layout.hub;
const W = H.weights;

/** Safe top to the column: xs, the 48 header row, xs and the 1 pt brass rule (59 + 57 = 116 on 852). */
export const HEADER_HEIGHT = space.xs + hit.min + space.xs + H.hairline;

/** Title (Playfair 24/30), xs, subtitle (caption 13/18), xl and the fan container: 302 at the default text size. */
export function heroBlock(fontScale: number): number {
  return (type.narrativeTitle.lineHeight + type.caption.lineHeight) * fontScale + space.xs + space.xl + H.fan.height;
}

/**
 * The fan needs the default text size or smaller (its side cards' labels are
 * centred on the 90 the centre card leaves exposed) and a screen at least 375
 * wide; otherwise the cards stack.
 */
export function fanFits(width: number, fontScale: number): boolean {
  return fontScale <= H.fan.maxFontScale && width >= H.fan.minWidth;
}

/** The column from the rule to the safe bottom (702 on 852), from the window and safe areas. */
export function columnHeight(windowHeight: number, insets: { top: number; bottom: number }): number {
  return windowHeight - insets.top - insets.bottom - HEADER_HEIGHT;
}

/**
 * The glass is dropped before anything else changes: it stays only while the
 * 7 : 7 : 50 spacers keep at least space.xl above and below it (a column of
 * 649.4 at the default text size).
 */
export function glassFits(column: number, fontScale: number): boolean {
  const free = column - H.glass - heroBlock(fontScale);
  return (free * W.aboveGlass) / (W.aboveGlass + W.belowGlass + W.belowFan) >= space.xl;
}

/** Layout marks, each in its column's own coordinates. */
export interface Marks {
  /** The fanned column's measured height (rule bottom to safe bottom). */
  column?: number;
  /** The stacked column's top spacer, frozen while the notice shows so nothing above it moves. */
  topSpacer?: number;
}
