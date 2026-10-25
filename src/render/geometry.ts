// Scene geometry. Hotspot rects are fractions of the image, so the photo is
// always laid out with `contain` (never `cover`) and hotspots are positioned
// inside the image's own box. Screen size never moves them.
//
// Functions are marked as worklets so gesture callbacks can call them on the
// UI thread; they are plain functions everywhere else (including tests).

export interface Size {
  width: number;
  height: number;
}

export interface Box extends Size {
  x: number;
  y: number;
}

/** The box an image of `aspect` (width / height) occupies inside `viewport` with contain. */
export function containBox(viewport: Size, aspect: number): Box {
  "worklet";
  if (viewport.width <= 0 || viewport.height <= 0 || !(aspect > 0)) return { x: 0, y: 0, width: 0, height: 0 };
  const viewportAspect = viewport.width / viewport.height;
  if (viewportAspect > aspect) {
    const width = viewport.height * aspect;
    return { x: (viewport.width - width) / 2, y: 0, width, height: viewport.height };
  }
  const height = viewport.width / aspect;
  return { x: 0, y: (viewport.height - height) / 2, width: viewport.width, height };
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const DOUBLE_TAP_ZOOM = 2;

export function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

/**
 * Largest translation that keeps the zoomed image covering the viewport on
 * that axis. When the scaled image is smaller than the viewport, it stays
 * centred (0).
 */
export function maxTranslate(viewportLength: number, imageLength: number, scale: number) {
  "worklet";
  return Math.max(0, (imageLength * scale - viewportLength) / 2);
}

export interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

/** Clamp a transform so the image never drifts away from the viewport. */
export function clampTransform(t: Transform, viewport: Size, image: Size): Transform {
  "worklet";
  const scale = clamp(t.scale, MIN_ZOOM, MAX_ZOOM);
  const mx = maxTranslate(viewport.width, image.width, scale);
  const my = maxTranslate(viewport.height, image.height, scale);
  return { scale, tx: clamp(t.tx, -mx, mx), ty: clamp(t.ty, -my, my) };
}

/**
 * Zoom so the image point under `start` focal stays under `focal`.
 * Transforms are applied around the image centre, which sits at the viewport
 * centre under contain. `focal` is in viewport coordinates.
 */
export function zoomAround(start: Transform, startFocal: { x: number; y: number }, focal: { x: number; y: number },
  nextScale: number, viewport: Size): Transform {
  "worklet";
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
  // Image-local point (relative to centre, unscaled) under the starting focal.
  const px = (startFocal.x - cx - start.tx) / start.scale;
  const py = (startFocal.y - cy - start.ty) / start.scale;
  return { scale, tx: focal.x - cx - scale * px, ty: focal.y - cy - scale * py };
}

/** Double-tap target: 1x <-> 2x around the tap point. */
export function doubleTapTarget(current: Transform, tap: { x: number; y: number }, viewport: Size, image: Size): Transform {
  "worklet";
  if (current.scale > MIN_ZOOM + 0.05) return { scale: MIN_ZOOM, tx: 0, ty: 0 };
  return clampTransform(zoomAround(current, tap, tap, DOUBLE_TAP_ZOOM, viewport), viewport, image);
}

/**
 * Extra hit area so a hotspot is at least `min` points on each axis.
 * `rect` is in image-local points at 1x zoom.
 */
export function hitSlopFor(rect: Size, min: number) {
  const h = Math.max(0, (min - rect.width) / 2);
  const v = Math.max(0, (min - rect.height) / 2);
  return { left: h, right: h, top: v, bottom: v };
}
