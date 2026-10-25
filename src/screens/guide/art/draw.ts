// Turns a Scene into a flat draw list: what StepArt renders as react-native-svg
// elements. Kept free of React so the art can be checked in tests (and
// previewed) exactly as the app draws it.
import { color, ref } from "@/theme/tokens";
import { bracketPaths, pathTail, phoneBody, phoneScreen, type Box } from "./geometry";
import type { Mark, Scene, Tone } from "./types";

const G = ref.layout.guide;
const LINE = G.line;

/** A stroke's live colour and its opacity (the depth's dimming), kept apart for react-native-svg. */
export interface Ink {
  color: string;
  opacity: number;
}

const TONE: Record<Tone, Ink> = {
  hero: LINE.hero,
  mid: LINE.mid,
  back: LINE.back,
  context: LINE.context,
};

/** The viewfinder brackets: brass, as the capture brackets were. */
const BRACKET: Ink = { color: LINE.bracket, opacity: 1 };

/** A linear fade to transparent, in user space (the art box's units): stopColor `color` at `opacity`, then 0. */
export interface FadeGradient {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  opacity: number;
}

export type DrawOp =
  | { kind: "path"; key: string; d: string; stroke: string; strokeOpacity: number; strokeWidth: number; fill: string }
  | { kind: "rect"; key: string; box: Box; stroke: string; strokeOpacity: number; strokeWidth: number; fill: string };

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

/** No fill or no stroke: the SVG keyword, not a colour. */
const NONE = "none";

/**
 * The draw list for one scene. `id` prefixes gradient and clip ids, so two
 * scenes on screen at once (during a step crossfade) never share one.
 */
export function drawList(scene: Scene, id: string): DrawList {
  const gradients: FadeGradient[] = [];

  const markOp = (mark: Mark, key: string): DrawOp => {
    const ink = TONE[mark.tone];
    const fill = mark.fill ? color[mark.fill] : NONE;
    if (!mark.fade) {
      return { kind: "path", key, d: mark.d, stroke: ink.color, strokeOpacity: ink.opacity, strokeWidth: LINE.stroke, fill };
    }
    const tail = pathTail(mark.d);
    const [fx, fy] = tail.from;
    const [tx, ty] = tail.to;
    const length = Math.hypot(tx - fx, ty - fy);
    const ux = length > 0 ? (tx - fx) / length : 0;
    const uy = length > 0 ? (ty - fy) / length : 0;
    const gradientId = `${id}${key}`;
    // At the tone's opacity up to `fade` before the end, transparent at the end.
    gradients.push({
      id: gradientId,
      x1: tx - ux * LINE.fade,
      y1: ty - uy * LINE.fade,
      x2: tx,
      y2: ty,
      color: ink.color,
      opacity: ink.opacity,
    });
    // The gradient carries the opacity, so the stroke itself stays at 1.
    return { kind: "path", key, d: mark.d, stroke: `url(#${gradientId})`, strokeOpacity: 1, strokeWidth: LINE.stroke, fill };
  };

  const under = scene.behind.map((mark, i) => markOp(mark, `b${i}`));
  const clipped: DrawOp[] = [];
  const over: DrawOp[] = [];
  let clip: Box | null = null;

  if (scene.phone) {
    const { x, y } = scene.phone;
    const screen = phoneScreen(x, y);
    clip = screen;
    const hero = TONE.hero;
    const context = TONE.context;
    // The walnut body hides what it covers; the screen is a window of plate canvas.
    under.push({
      kind: "rect",
      key: "body",
      box: phoneBody(x, y),
      stroke: hero.color,
      strokeOpacity: hero.opacity,
      strokeWidth: LINE.stroke,
      fill: color.surface,
    });
    under.push({ kind: "rect", key: "screen", box: screen, stroke: NONE, strokeOpacity: 1, strokeWidth: 0, fill: color.canvas });
    scene.phone.screen.forEach((mark, i) => clipped.push(markOp(mark, `s${i}`)));
    // The screen's 1 pt context edge, drawn over the subject so it stays whole.
    over.push({
      kind: "rect",
      key: "edge",
      box: screen,
      stroke: context.color,
      strokeOpacity: context.opacity,
      strokeWidth: G.hairline,
      fill: NONE,
    });
    bracketPaths(screen).forEach((d, i) =>
      over.push({
        kind: "path",
        key: `k${i}`,
        d,
        stroke: BRACKET.color,
        strokeOpacity: BRACKET.opacity,
        strokeWidth: LINE.stroke,
        fill: NONE,
      }),
    );
  }
  scene.front?.forEach((mark, i) => over.push(markOp(mark, `f${i}`)));

  return { gradients, clip, under, clipped, over };
}
