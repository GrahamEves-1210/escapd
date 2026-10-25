// The guide's line art as data (docs/DESIGN.md 04, Inner plate and Steps).
// One renderer (StepArt) draws every scene, so the stroke, tones, fills,
// fades, phone, screen clip and brackets come from tokens in one place.
// Coordinates are the art box's own units (ref.layout.guide.art, 240 x 266):
// the whole drawing scales with the plate when large text shrinks it.

/** Depth comes only from stroke brightness (ref.layout.guide.line). */
export type Tone = "hero" | "mid" | "back" | "context";

export type Point = readonly [number, number];

/**
 * One stroked shape. Path data uses only M, L, H, V, C and Z, so every number
 * in it is a coordinate (the ink-width test reads them as a conservative
 * bound: a curve stays inside its control points).
 */
export interface Mark {
  d: string;
  tone: Tone;
  /**
   * Fades linearly to transparent over its last ref.layout.guide.line.fade,
   * along the path's final direction, reaching nothing at its last point
   * (context lines: the hand and the view wedges; also step 3's desk edges).
   */
  fade?: boolean;
  /** Opaque fill in a live colour that hides the marks drawn before it (device bodies). */
  fill?: "surface" | "canvas";
}

/** The hero phone (steps 1, 3 and 4): ref.layout.guide.phone, drawn face-on. */
export interface HeroPhone {
  /** Top-left corner of the body. */
  x: number;
  y: number;
  /** The framed subject, redrawn inside the inner screen and clipped to its radius-6 corners. */
  screen: readonly Mark[];
}

export interface Scene {
  /** Drawn first, back to front. The phone body hides what it covers. */
  behind: readonly Mark[];
  phone?: HeroPhone;
  /** Drawn over the phone. */
  front?: readonly Mark[];
}
