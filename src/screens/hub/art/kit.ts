// The drawing kit for home's mode art (docs/DESIGN.md, Modes › Mode art):
// small helpers over the Skia API that the three covers share.
// Everything here is pure drawing on a canvas it is handed: no React, no
// platform. Skia itself is passed in (`lib`), never imported, because on the
// web its module may only be evaluated once CanvasKit has loaded (bake.ts
// requires it lazily); here it is only a type.
//
// Colours come from the mode's theme (modeThemes) and nowhere else: a Tone is
// a theme colour as linear-free RGB floats, mixed between theme colours where
// a shade between two of them is needed (a brass highlight is the accent
// mixed toward the ink, say).
import type * as SkiaModule from "@shopify/react-native-skia";
import type { SkCanvas, SkColor, SkFont, SkPaint, SkPath, SkShader, SkTypeface } from "@shopify/react-native-skia";

export type SkiaLib = typeof SkiaModule;

/** A colour as red, green and blue from 0 to 1. */
export type Tone = readonly [number, number, number];

/** A theme colour (#RRGGBB) as a Tone. */
export function tone(hex: string): Tone {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Between two tones: 0 is `a`, 1 is `b`. */
export function mix(a: Tone, b: Tone, t: number): Tone {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A Skia colour from a tone and an alpha. */
export function rgba(t: Tone, alpha = 1): SkColor {
  return Float32Array.of(t[0], t[1], t[2], alpha);
}

/** A gradient stop: where (0 to 1), the tone and its alpha. */
export type Stop = readonly [offset: number, tone: Tone, alpha: number];

/** The faces the art may set words in (police tape, evidence numerals). */
export interface ArtFonts {
  grotesk: SkTypeface | null;
}

/** One cover being drawn: the canvas in points (the bake scales it to pixels), its size and a seeded random. */
export interface Art {
  lib: SkiaLib;
  canvas: SkCanvas;
  w: number;
  h: number;
  /** Device pixels per point: grain is drawn per pixel. */
  scale: number;
  /** A seeded random number from 0 to 1: the same cover every time. */
  rand: () => number;
  fonts: ArtFonts;
}

/** Mulberry32: a tiny seeded random, so every bake draws the same rain, motes and specks. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random number between `a` and `b`. */
export function between(art: Art, a: number, b: number): number {
  return a + (b - a) * art.rand();
}

export interface PaintOptions {
  color?: SkColor;
  shader?: SkShader | null;
  /** A BlendMode (default SrcOver). */
  blend?: number;
  alpha?: number;
  /** A gaussian blur of the shape's edge, in points. */
  blur?: number;
  /** Stroke width; absent fills. */
  stroke?: number;
  round?: boolean;
}

export function paint(art: Art, o: PaintOptions = {}): SkPaint {
  const { lib } = art;
  const p = lib.Skia.Paint();
  p.setAntiAlias(true);
  p.setDither(true);
  if (o.color) p.setColor(o.color);
  if (o.shader) p.setShader(o.shader);
  if (o.blend !== undefined) p.setBlendMode(o.blend);
  if (o.alpha !== undefined) p.setAlphaf(o.alpha);
  if (o.blur) p.setMaskFilter(lib.Skia.MaskFilter.MakeBlur(lib.BlurStyle.Normal, o.blur, true));
  if (o.stroke !== undefined) {
    p.setStyle(lib.PaintStyle.Stroke);
    p.setStrokeWidth(o.stroke);
    if (o.round) {
      p.setStrokeCap(lib.StrokeCap.Round);
      p.setStrokeJoin(lib.StrokeJoin.Round);
    }
  }
  return p;
}

function split(stops: readonly Stop[]) {
  return { colors: stops.map(([, t, a]) => rgba(t, a)), positions: stops.map(([o]) => o) };
}

export function linear(art: Art, x0: number, y0: number, x1: number, y1: number, stops: readonly Stop[]): SkShader {
  const { lib } = art;
  const { colors, positions } = split(stops);
  return lib.Skia.Shader.MakeLinearGradient({ x: x0, y: y0 }, { x: x1, y: y1 }, colors, positions, lib.TileMode.Clamp);
}

/** A radial gradient, squashed to `ry / r` vertically when `ry` is given (a pool of light seen at an angle). */
export function radial(art: Art, cx: number, cy: number, r: number, stops: readonly Stop[], ry?: number): SkShader {
  const { lib } = art;
  const { colors, positions } = split(stops);
  const squash = ry === undefined ? undefined : lib.Skia.Matrix().translate(cx, cy).scale(1, ry / r).translate(-cx, -cy);
  return lib.Skia.Shader.MakeRadialGradient({ x: cx, y: cy }, r, colors, positions, lib.TileMode.Clamp, squash);
}

/** Fills the whole cover. */
export function wash(art: Art, o: PaintOptions) {
  art.canvas.drawRect(art.lib.Skia.XYWHRect(0, 0, art.w, art.h), paint(art, o));
}

/** A path from points: straight segments, closed. */
export function poly(art: Art, points: readonly (readonly [number, number])[]): SkPath {
  const b = art.lib.Skia.PathBuilder.Make();
  points.forEach(([x, y], i) => (i === 0 ? b.moveTo(x, y) : b.lineTo(x, y)));
  return b.close().build();
}

/** An SVG path's data placed at (x, y) and scaled by `s` (drawn in its own units). */
export function svgPath(art: Art, d: string, x: number, y: number, s: number): SkPath {
  const { Skia } = art.lib;
  const path = Skia.Path.MakeFromSVGString(d);
  if (!path) return Skia.PathBuilder.Make().build();
  return Skia.PathBuilder.MakeFromPath(path).transform(Skia.Matrix().translate(x, y).scale(s, s)).build();
}

export interface NoiseOptions {
  /** Cycles per point, across and down. */
  fx: number;
  fy: number;
  octaves: number;
  seed: number;
  tone: Tone;
  /** How hard the noise is pushed apart about its middle (1 leaves it soft). */
  contrast: number;
  /** Shifts the noise's alpha up (positive) or down. */
  bias: number;
  alpha: number;
  blend?: number;
  /** Where the noise shows: a shader whose alpha masks it (a pool of light, a band of floor). */
  mask?: SkShader;
  /** Turbulence (wispy, ridged) rather than fractal noise (soft clouds). */
  turbulence?: boolean;
}

/**
 * Draws `draw` (in the cover's points) into a small offscreen picture at
 * `detail` of a point per pixel, then lays it over the whole cover, smoothly
 * scaled up, with `over`'s blend and alpha. Smoke, haze and mist are soft
 * clouds, so they lose nothing drawn small, and noise is the costly part of
 * a cover to compute per pixel.
 */
export function soft(art: Art, detail: number, over: PaintOptions, draw: (art: Art) => void) {
  const { lib, canvas } = art;
  const { Skia } = lib;
  const pw = Math.max(1, Math.ceil(art.w * detail));
  const ph = Math.max(1, Math.ceil(art.h * detail));
  const small = Skia.Surface.Make(pw, ph);
  if (!small) return;
  const inner = small.getCanvas();
  inner.scale(pw / art.w, ph / art.h);
  draw({ ...art, canvas: inner, scale: detail });
  small.flush();
  const image = small.makeImageSnapshot();
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect(0, 0, pw, ph),
    Skia.XYWHRect(0, 0, art.w, art.h),
    lib.FilterMode.Linear,
    lib.MipmapMode.None,
    paint(art, over),
  );
  image.dispose();
  small.dispose();
}

/**
 * Smoke, haze and mist: Skia's noise as alpha in one tone, masked to where
 * it should show, drawn small (soft()) and laid over the cover.
 */
export function noise(art: Art, o: NoiseOptions, detail = 0.25) {
  soft(art, detail, { alpha: o.alpha, blend: o.blend }, (small) => {
    const { lib, canvas } = small;
    const { Skia } = lib;
    const shader = o.turbulence
      ? Skia.Shader.MakeTurbulence(o.fx, o.fy, o.octaves, o.seed, 0, 0)
      : Skia.Shader.MakeFractalNoise(o.fx, o.fy, o.octaves, o.seed, 0, 0);
    const k = o.contrast;
    const [r, g, b] = o.tone;
    // The noise's red channel becomes alpha (pushed about 0.5), the colour the tone.
    const toAlpha = Skia.ColorFilter.MakeMatrix([0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, k, 0, 0, 0, 0.5 - 0.5 * k + o.bias]);
    const p = paint(small, { shader });
    p.setColorFilter(toAlpha);
    canvas.drawRect(Skia.XYWHRect(0, 0, small.w, small.h), p);
    if (o.mask) canvas.drawRect(Skia.XYWHRect(0, 0, small.w, small.h), paint(small, { shader: o.mask, blend: lib.BlendMode.DstIn }));
  });
}

/** The grain's tile, in device pixels: made once, repeated across every cover. */
const GRAIN_TILE = 256;

/**
 * Film grain over the whole cover, about a device pixel each, overlaid as
 * the photo treatment's grain is (ref.treatment.grain): one tile of fine
 * noise, made grey and stretched about mid-grey, repeated.
 */
export function grain(art: Art, strength: number, seed: number) {
  const { lib, canvas } = art;
  const { Skia } = lib;
  const tile = Skia.Surface.Make(GRAIN_TILE, GRAIN_TILE);
  if (!tile) return;
  const k = 2.6;
  const grey = Skia.ColorFilter.MakeMatrix([k, 0, 0, 0, 0.5 - 0.5 * k, k, 0, 0, 0, 0.5 - 0.5 * k, k, 0, 0, 0, 0.5 - 0.5 * k, 0, 0, 0, 0, 1]);
  const noisy = Skia.Paint();
  noisy.setShader(Skia.Shader.MakeFractalNoise(0.7, 0.7, 2, seed, GRAIN_TILE, GRAIN_TILE));
  noisy.setColorFilter(grey);
  tile.getCanvas().drawPaint(noisy);
  tile.flush();
  const image = tile.makeImageSnapshot();
  canvas.save();
  canvas.scale(1 / art.scale, 1 / art.scale);
  const p = paint(art, { blend: lib.BlendMode.Overlay, alpha: strength });
  p.setShader(image.makeShaderOptions(lib.TileMode.Repeat, lib.TileMode.Repeat, lib.FilterMode.Nearest, lib.MipmapMode.None));
  canvas.drawRect(Skia.XYWHRect(0, 0, art.w * art.scale, art.h * art.scale), p);
  canvas.restore();
  image.dispose();
  tile.dispose();
}

/** Words in a face, centred on (x, y)'s baseline; nothing when the face didn't load. */
export function words(art: Art, face: SkTypeface | null, text: string, size: number, x: number, y: number, p: SkPaint): number {
  if (!face) return 0;
  const font: SkFont = art.lib.Skia.Font(face, size);
  const width = font.measureText(text).width;
  art.canvas.drawText(text, x - width / 2, y, p, font);
  return width;
}
