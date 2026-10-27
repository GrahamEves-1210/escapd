// Taken objects leave the room (docs/DESIGN.md, Game feel · 4a): at most one
// object per room physically disappears from the photo once it is taken.
// Presentation only, decided on the device from the public definition and
// the photo's own pixels, so it works on every room, old ones included, with
// no server change. This file is the choice; src/game/inpaint.ts makes the
// fill and src/render/removalPatch.ts bakes it.
//
// An object qualifies when taking it can't break later play and the fill
// will look right:
// - exactly one puzzle targets its hotspot, an inspect (no use_item, code or
//   accuse there), and it isn't hidden or haunted (a paranormal effect);
// - its label names a small portable thing (PORTABLE, below);
// - its box is 1-15% of the photo, at least 2% in from every edge, and no
//   other hotspot reaches into its hole except one that holds it whole (the
//   desk a mug stands on);
// - the ring round it on the photo is plain (ringStats: little spread
//   round a fitted plane, so a lit wall's gradient passes and books don't).
// Of those, the plainest ring wins, then the box nearest a mid size, then the id.
import type { Hotspot, Id, PuzzleDefinitionV1 } from "@/lib/puzzle-types";
import { FILL, padRect, ringStats, type PixelRegion, type Rect, type RingStats } from "./inpaint";

export const REMOVAL = {
  minArea: 0.01,
  maxArea: 0.15,
  /** The box keeps at least this far from every photo edge. */
  margin: 0.02,
  /** The region read round a box: this fraction of its size each side. */
  regionPad: 0.15,
  /** The region's long edge, at most (px). */
  maxEdge: 384,
  /** A ring busier than this (luminance spread round a plane, 0..255) is rejected. */
  busy: 18,
  /** Rings within this much of each other count as equally plain (then the size decides). */
  plainStep: 3,
  /** The size the tie-break prefers, as a fraction of the photo. */
  midArea: 0.04,
} as const;

/** Words naming a small portable thing on their own (a trailing plural s is ignored). */
const WORDS = new Set([
  "book", "notebook", "journal", "diary", "ledger", "vase", "mug", "cup", "teacup", "jar", "bottle", "flask", "decanter",
  "box", "tin", "canister", "pot", "teapot", "kettle", "candle", "candlestick", "figurine", "statuette", "ornament",
  "trinket", "bowl", "basket", "bag", "handbag", "purse", "backpack", "satchel", "briefcase", "cushion", "pillow", "toy",
  "teddy", "doll", "shoe", "boot", "sneaker", "slipper", "hat", "cap", "camera", "headphone", "headphones", "trophy",
  "globe", "remote", "controller", "gamepad", "ashtray", "radio", "lantern", "flashlight", "torch", "wallet", "skull",
  "telephone", "phone",
]);

/** Words that qualify only with one of these beside them ("desk lamp", "alarm clock"). */
const QUALIFIED: Record<string, readonly string[]> = {
  lamp: ["desk", "table", "bedside", "reading", "small", "oil", "banker", "bankers"],
  clock: ["alarm", "desk", "mantel", "mantle", "table", "small", "pocket", "carriage", "bedside"],
  speaker: ["small", "portable", "bluetooth", "smart"],
  frame: ["picture", "photo", "small", "desk"],
  plant: ["small", "potted", "pot", "little"],
};

/** Words that rule a label out: too big, or fixed to the room. */
const DENY = new Set(["large", "big", "huge", "giant", "floor", "grandfather", "standing", "fuse", "breaker", "electrical", "mounted", "built"]);

/** The word and its singular, so "books" and "boxes" match "book" and "box". */
function forms(word: string): string[] {
  const out = [word];
  if (word.length > 3 && word.endsWith("es")) out.push(word.slice(0, -2));
  if (word.length > 2 && word.endsWith("s")) out.push(word.slice(0, -1));
  return out;
}

/** True when the label names a small portable thing (case-insensitive, by whole words). */
export function isPortableLabel(label: string): boolean {
  const words = label.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.length === 0 || words.some((w) => DENY.has(w))) return false;
  for (const word of words) {
    for (const f of forms(word)) {
      if (WORDS.has(f)) return true;
      const needs = QUALIFIED[f];
      if (needs && words.some((other) => other !== word && needs.includes(other))) return true;
    }
  }
  return false;
}

const area = (r: Rect) => r.w * r.h;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

/** The one puzzle on the hotspot, when it is the only one and an inspect; else null. */
export function soleInspect(def: PuzzleDefinitionV1, hotspotId: Id): Id | null {
  const on = def.puzzles.filter((p) => p.hotspot_id === hotspotId);
  return on.length === 1 && on[0].kind === "inspect" ? on[0].id : null;
}

/** The hotspots that could leave the room, before looking at the photo. Definition order. */
export function removableCandidates(def: PuzzleDefinitionV1): Hotspot[] {
  return def.hotspots.filter((h) => {
    if (h.hidden || h.effect || h.shape?.type !== "rect") return false;
    if (!isPortableLabel(h.object_label) || soleInspect(def, h.id) === null) return false;
    const s = h.shape;
    if (![s.x, s.y, s.w, s.h].every(Number.isFinite)) return false;
    const a = area(s);
    if (a < REMOVAL.minArea || a > REMOVAL.maxArea) return false;
    const m = REMOVAL.margin;
    if (s.x < m || s.y < m || s.x + s.w > 1 - m || s.y + s.h > 1 - m) return false;
    // What the fill paints over: the hole and its feather. Another object there
    // would lose a piece, unless it holds this one whole (the desk under the mug).
    const painted = padRect(s, FILL.holePad + FILL.feather);
    return !def.hotspots.some((o) => o.id !== h.id && o.photo_index === h.photo_index && overlaps(o.shape, painted) && !contains(o.shape, s));
  });
}

/** Where a box's region sits on a photo `width` x `height` px, and the size it is read at. */
export interface RegionGeometry {
  /** The crop on the photo, in its pixels (whole numbers). */
  src: Rect;
  /** The region's size once read (long edge at most REMOVAL.maxEdge). */
  width: number;
  height: number;
  /** The object's box in the region's pixels. */
  box: Rect;
  /** The crop as fractions of the photo: where the patch goes. */
  rect: Rect;
}

export function regionGeometry(shape: Rect, width: number, height: number, maxEdge: number = REMOVAL.maxEdge): RegionGeometry {
  const pad = REMOVAL.regionPad;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const x0 = Math.floor(clamp(shape.x - shape.w * pad) * width);
  const y0 = Math.floor(clamp(shape.y - shape.h * pad) * height);
  const x1 = Math.max(x0 + 1, Math.ceil(clamp(shape.x + shape.w * (1 + pad)) * width));
  const y1 = Math.max(y0 + 1, Math.ceil(clamp(shape.y + shape.h * (1 + pad)) * height));
  const sw = x1 - x0;
  const sh = y1 - y0;
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const sx = w / sw;
  const sy = h / sh;
  return {
    src: { x: x0, y: y0, w: sw, h: sh },
    width: w,
    height: h,
    box: { x: (shape.x * width - x0) * sx, y: (shape.y * height - y0) * sy, w: shape.w * width * sx, h: shape.h * height * sy },
    rect: { x: x0 / width, y: y0 / height, w: sw / width, h: sh / height },
  };
}

export interface RemovalChoice {
  hotspot: Hotspot;
  /** The inspect puzzle whose solve takes it. */
  puzzleId: Id;
  /** The pixels round it, as sampled: the fill's input. */
  region: PixelRegion;
  ring: RingStats;
}

/**
 * The room's one removable object, or null. `sample` reads a candidate's
 * region from its photo (null when it can't), so the photo's pixels are a
 * dependency and the choice itself is pure: the same room and pixels always
 * give the same answer.
 */
export function chooseRemovable(def: PuzzleDefinitionV1, sample: (hotspot: Hotspot) => PixelRegion | null): RemovalChoice | null {
  const scored: (RemovalChoice & { area: number })[] = [];
  for (const hotspot of removableCandidates(def)) {
    const puzzleId = soleInspect(def, hotspot.id)!;
    const region = sample(hotspot);
    if (!region) continue;
    const ring = ringStats(region);
    if (!ring || !(ring.residual <= REMOVAL.busy)) continue;
    scored.push({ hotspot, puzzleId, region, ring, area: area(hotspot.shape) });
  }
  scored.sort((a, b) =>
    Math.floor(a.ring.residual / REMOVAL.plainStep) - Math.floor(b.ring.residual / REMOVAL.plainStep)
    || Math.abs(Math.log(a.area / REMOVAL.midArea)) - Math.abs(Math.log(b.area / REMOVAL.midArea))
    || (a.hotspot.id < b.hotspot.id ? -1 : a.hotspot.id > b.hotspot.id ? 1 : 0));
  const best = scored[0];
  if (!best) return null;
  return { hotspot: best.hotspot, puzzleId: best.puzzleId, region: best.region, ring: best.ring };
}
