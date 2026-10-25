// Turns a Scene into a flat draw list: what StepArt renders as react-native-svg
// elements. Kept free of React so the art can be checked in tests (and
// previewed) exactly as the app draws it.
import { ref } from "@/theme/tokens";
import { bracketPaths, pathTail, phoneBody, phoneScreen, type Box } from "./geometry";
import type { Mark, Scene, Tone } from "./types";

const ART = ref.illustration;

const TONE: Record<Tone, string> = {
  hero: ART.hero,
  mid: ART.mid,
  back: ART.back,
  context: ART.context,
};

/** A linear fade to transparent, in user space (the art box's units). */
export interface FadeGradient {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export type DrawOp =
  | { kind: "path"; key: string; d: string; stroke: string; strokeWidth: number; fill: string }
  | { kind: "rect"; key: string; box: Box; stroke: string; strokeWidth: number; fill: string };

export interface DrawList {
  gradients: FadeGradient[];
  /** The inner screen, for the clip path, when the scene has a hero phone. */
  clip: Box | null;
  /** Drawn in order: everything before the screen's subject. */
  under: DrawOp[];
  /** The framed subject, inside the clip. */
  clipped: DrawOp[];
  /** Drawn last: the screen's edge, the brackets and any front marks. */
  over: DrawOp[];
}

/** No fill: the SVG keyword, not a colour. */
const NO_FILL = "none";

/**
 * The draw list for one scene. `id` prefixes gradient and clip ids, so two
 * scenes on screen at once (during a step crossfade) never share one.
 */
export function drawList(scene: Scene, id: string): DrawList {
  const gradients: FadeGradient[] = [];

  const markOp = (mark: Mark, key: string): DrawOp => {
    let stroke = TONE[mark.tone];
    if (mark.fade) {
      const tail = pathTail(mark.d);
      const [fx, fy] = tail.from;
      const [tx, ty] = tail.to;
      const length = Math.hypot(tx - fx, ty - fy);
      const ux = length > 0 ? (tx - fx) / length : 0;
      const uy = length > 0 ? (ty - fy) / length : 0;
      const gradientId = `${id}${key}`;
      // Opaque up to contextFade before the end, transparent at the end.
      gradients.push({ id: gradientId, x1: tx - ux * ART.contextFade, y1: ty - uy * ART.contextFade, x2: tx, y2: ty, color: stroke });
      stroke = `url(#${gradientId})`;
    }
    return { kind: "path", key, d: mark.d, stroke, strokeWidth: ART.stroke, fill: mark.fill ? ref.color[mark.fill] : NO_FILL };
  };

  const under = scene.behind.map((mark, i) => markOp(mark, `b${i}`));
  const clipped: DrawOp[] = [];
  const over: DrawOp[] = [];
  let clip: Box | null = null;

  if (scene.phone) {
    const { x, y } = scene.phone;
    const screen = phoneScreen(x, y);
    clip = screen;
    // The body hides what it covers and reads as a dark silhouette on the pool.
    under.push({ kind: "rect", key: "body", box: phoneBody(x, y), stroke: ART.hero, strokeWidth: ART.stroke, fill: ref.color.panel });
    under.push({ kind: "rect", key: "screen", box: screen, stroke: NO_FILL, strokeWidth: 0, fill: ref.color.ground });
    scene.phone.screen.forEach((mark, i) => clipped.push(markOp(mark, `s${i}`)));
    // The screen's 1 pt context edge, drawn over the subject so it stays whole.
    over.push({ kind: "rect", key: "edge", box: screen, stroke: ART.context, strokeWidth: ref.border.hairline, fill: NO_FILL });
    bracketPaths(screen).forEach((d, i) =>
      over.push({ kind: "path", key: `k${i}`, d, stroke: ART.hero, strokeWidth: ART.stroke, fill: NO_FILL }),
    );
  }
  scene.front?.forEach((mark, i) => over.push(markOp(mark, `f${i}`)));

  return { gradients, clip, under, clipped, over };
}
