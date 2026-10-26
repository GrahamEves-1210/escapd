// Turns a Scene into a flat draw list: the gradients and paths StepArt renders
// with react-native-svg. Free of React, so the art can be checked in tests and
// previewed exactly as the app draws it.
import { gradientLine } from "@/components/noir/gradient";
import { ref, type GradientStop } from "@/theme/tokens";
import { pathBounds, pathTail } from "./geometry";
import type { Fill, Ink, Mark, Scene } from "./types";

const G = ref.layout.guide;
const INK = G.ink;

/** A linear gradient in the art box's own units (gradientUnits="userSpaceOnUse"). */
export interface Gradient {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: readonly GradientStop[];
}

export interface DrawOp {
  key: string;
  d: string;
  /** A colour, a gradient url or "none". */
  stroke: string;
  strokeWidth: number;
  /** A colour, a gradient url or "none". */
  fill: string;
}

export interface DrawList {
  gradients: Gradient[];
  ops: DrawOp[];
}

/** No fill or no stroke: the SVG keyword, not a colour. */
const NONE = "none";
const url = (id: string) => `url(#${id})`;

/** Each ink's colour; the screen edge's is its top (it darkens downward). */
export const INKS: Record<Ink, `#${string}`> = {
  hero: ref.color.textPrimary,
  mid: ref.color.lineMid,
  back: ref.color.lineBack,
  context: ref.color.lineContext,
  bezel: ref.color.lineBack,
  screen: ref.color.lineContext,
  text: INK.text,
  textDim: INK.textDim,
  ridge: INK.ridge,
};

/** Inks drawn at the thin width: the phone's bezel, its screen's edge and the ridges. Every other ink is ref.icon.illustrationStroke. */
export const THIN_INKS: readonly Ink[] = ["bezel", "screen", "ridge"];

/** The gradient fills, each drawn across its shape's own box. */
export const FILLS: Record<Exclude<Fill, "void">, { angle: number; stops: readonly GradientStop[] }> = {
  device: ref.gradient.deviceFill,
  panel: G.fill.panel,
  tag: G.fill.tag,
};

const stop = (offset: number, color: `#${string}`, opacity: number): GradientStop => ({ offset, color, opacity });

/**
 * The draw list for one scene. `id` prefixes every gradient id, so two scenes
 * on screen at once (during a step crossfade) never share one.
 */
export function drawList(scene: Scene, id: string): DrawList {
  const gradients: Gradient[] = [];
  const add = (gradient: Gradient) => {
    gradients.push(gradient);
    return url(gradient.id);
  };

  const strokeOf = (mark: Mark, ink: Ink, key: string): string => {
    const color = INKS[ink];
    if (ink === "screen") {
      // The inner screen's edge darkens from its top to its bottom.
      const box = pathBounds(mark.d);
      return add({
        id: `${id}${key}s`,
        x1: 0,
        y1: box.y,
        x2: 0,
        y2: box.y + box.height,
        stops: [stop(0, color, 1), stop(1, INK.screenBottom, 1)],
      });
    }
    if (mark.fade === "down") {
      // Full above ink.fade.from, nothing at ink.fade.to (the box's bottom).
      return add({ id: `${id}${key}d`, x1: 0, y1: INK.fade.from, x2: 0, y2: INK.fade.to, stops: [stop(0, color, 1), stop(1, color, 0)] });
    }
    if (mark.fade === "end") {
      // Full up to ink.endFade before its end, transparent at the end.
      const { from, to } = pathTail(mark.d);
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const ux = length > 0 ? (to[0] - from[0]) / length : 0;
      const uy = length > 0 ? (to[1] - from[1]) / length : 0;
      return add({
        id: `${id}${key}e`,
        x1: to[0] - ux * INK.endFade,
        y1: to[1] - uy * INK.endFade,
        x2: to[0],
        y2: to[1],
        stops: [stop(0, color, 1), stop(1, color, 0)],
      });
    }
    return color;
  };

  const fillOf = (mark: Mark, key: string): string => {
    if (!mark.fill) return NONE;
    if (mark.fill === "void") return ref.color.void;
    const token = FILLS[mark.fill];
    const box = pathBounds(mark.d);
    const line = gradientLine(mark.fillAngle ?? token.angle, box.width, box.height);
    return add({
      id: `${id}${key}f`,
      x1: box.x + line.x1,
      y1: box.y + line.y1,
      x2: box.x + line.x2,
      y2: box.y + line.y2,
      stops: token.stops,
    });
  };

  const ops = scene.marks.map((mark, i): DrawOp => {
    const key = `m${i}`;
    const fill = fillOf(mark, key);
    if (!mark.ink) return { key, d: mark.d, stroke: NONE, strokeWidth: 0, fill };
    const strokeWidth = THIN_INKS.includes(mark.ink) ? INK.thin : ref.icon.illustrationStroke;
    return { key, d: mark.d, stroke: strokeOf(mark, mark.ink, key), strokeWidth, fill };
  });

  return { gradients, ops };
}
