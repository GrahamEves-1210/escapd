// The hub's geometry rules (docs/DESIGN.md, 01 Layout totals; States: Large
// text / narrow screens, Short screens). Everything comes from ref tokens.
import type { LightPoolSpec } from "@/components/noir";
import { ref } from "@/theme/tokens";

const H = ref.layout.hub;
const W = H.weights;

/** Safe top to the column: sm, the 44 header row, md and the 1 pt divider (59 + 65 = 124 on 852). */
export const HEADER_HEIGHT = ref.space.sm + ref.button.icon.size + ref.space.md + ref.border.hairline;

/** Title, xs, subtitle, band and the fan container: 310 at the default text size. */
export function heroBlock(fontScale: number): number {
  return (ref.type.title.lineHeight + ref.type.body.lineHeight) * fontScale + ref.space.xs + ref.space.band + H.fan.height;
}

/**
 * The fan needs the default text size or smaller (the 84-wide notes pass the
 * 90 max width at 1.07) and a screen at least 375 wide; otherwise the cards stack.
 */
export function fanFits(width: number, fontScale: number): boolean {
  return fontScale <= H.fan.maxFontScale && width >= H.fan.minWidth;
}

/** The column from the divider to the safe bottom (694 on 852), from the window and safe areas. */
export function columnHeight(windowHeight: number, insets: { top: number; bottom: number }): number {
  return windowHeight - insets.top - insets.bottom - HEADER_HEIGHT;
}

/**
 * The glass is dropped before anything else changes: it stays only while the
 * 7 : 7 : 50 spacers keep at least ref.space.xl above and below it (a column
 * of 658 at the default text size).
 */
export function glassFits(column: number, fontScale: number): boolean {
  const free = column - H.glass - heroBlock(fontScale);
  return (free * W.aboveGlass) / (W.aboveGlass + W.belowGlass + W.belowFan) >= ref.space.xl;
}

/** Layout marks, each in its column's own coordinates (the column View, or the stacked scroll content). */
export interface Marks {
  /** The fanned column's top and height in the screen (divider bottom to safe bottom). */
  columnY?: number;
  column?: number;
  titleY?: number;
  subtitleBottom?: number;
  glassX?: number;
  glassY?: number;
  /** The stacked column's top spacer, frozen while the notice shows so nothing above it moves. */
  topSpacer?: number;
}

/**
 * The two static pools of the fanned layout, in screen coordinates.
 * - Glass (ref.light.object): x on the lens centre; y on the lens centre,
 *   raised to title top - 120 whenever it sits below that line, so the pool
 *   ends exactly at the title's top edge. Drawn only between the divider and
 *   the title. Dropped with the glass.
 * - Fan (ref.light.hero): x on the fan's axis, y = subtitle bottom + 220, so
 *   the pool ends exactly at the subtitle's bottom edge.
 */
export function fanPools(marks: Marks, width: number, withGlass: boolean): LightPoolSpec[] {
  const { columnY, titleY, subtitleBottom, glassX, glassY } = marks;
  if (columnY === undefined || titleY === undefined || subtitleBottom === undefined) return [];
  const titleTop = columnY + titleY;
  const pools: LightPoolSpec[] = [];
  if (withGlass && glassX !== undefined && glassY !== undefined) {
    const lensY = columnY + glassY + H.glass * H.lens.y;
    pools.push({
      kind: "object",
      cx: glassX + H.glass * H.lens.x,
      cy: Math.min(lensY, titleTop - ref.light.object.radius),
      clipTop: columnY,
      clipBottom: titleTop,
    });
  }
  pools.push({ kind: "hero", cx: width / 2, cy: columnY + subtitleBottom + ref.light.hero.radius });
  return pools;
}

/** The stacked layout keeps only the fan pool's centre rule, in the scroll content's coordinates, so it scrolls with the column. */
export function stackPools(marks: Marks, width: number): LightPoolSpec[] {
  if (marks.subtitleBottom === undefined) return [];
  return [{ kind: "hero", cx: width / 2, cy: marks.subtitleBottom + ref.light.hero.radius }];
}
