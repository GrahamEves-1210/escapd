// The guide's line art as data (docs/DESIGN.md 04, Layout: Illustration;
// Steps). One renderer (StepArt) draws every scene, so the strokes, fills and
// fades come from tokens in one place. Coordinates are the art box's own
// units (ref.layout.guide.art, 240 x 266): the whole drawing scales evenly
// when large text shrinks the box.

/**
 * Stroke inks, brightest first. Depth comes from brightness alone: `hero`
 * (textPrimary) in front, then `mid` (lineMid), `back` (lineBack) and
 * `context` (lineContext). A subject's outline takes its depth's ink; detail
 * inside it is dimmer (back, ridge or print). `bezel` is the thin lineBack
 * shoulder just inside the hero phone's outline; `screen` its inner screen
 * edge (thin, darkening downward); `text` and `textDim` are print on a lit
 * panel; `ridge` is thin detail inside a dark shape.
 */
export type Ink = "hero" | "mid" | "back" | "context" | "bezel" | "screen" | "text" | "textDim" | "ridge";

/**
 * Fills. Every fill is opaque, so a shape hides whatever was drawn before it.
 * void: flat black. device: the top-lit gradient inside a device outline
 * (ref.gradient.deviceFill). panel: the lit panel, light at the top right.
 * tag: the small top-to-bottom gradient of a label or picture.
 */
export type Fill = "void" | "device" | "panel" | "tag";

/**
 * "down": the stroke fades toward the art box's bottom (a hand running off
 * the drawing). "end": it fades over its own last stretch, along its final
 * direction (step 2's view rays, step 3's desk edges).
 */
export type Fade = "down" | "end";

export type Point = readonly [number, number];

/**
 * One shape. Path data is absolute M, L, H, V, C and Z only, so every number
 * in it is a coordinate and its control points bound it (the gradients and
 * the ink tests rely on that).
 */
export interface Mark {
  d: string;
  /** Stroke ink; none for a fill-only shape. */
  ink?: Ink;
  fill?: Fill;
  /** The fill gradient's CSS angle when the shape is turned (step 2's plan phones). Default: the fill's own. */
  fillAngle?: number;
  fade?: Fade;
}

/** One step's drawing: marks in paint order, back to front. */
export interface Scene {
  marks: readonly Mark[];
}
