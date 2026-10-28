// Gameplay v2's own measures and motion (chunk 2). Colours come from the mode
// theme; type and spacing from ref.
import type { Genre } from "@/lib/puzzle-types";

export const V2 = {
  torch: {
    /** The beam's radius, as a share of the photo's width. */
    radius: 0.26,
    /** How dark the room is outside the beam, per mode. */
    darkness: { noir: 0.93, crime_scene: 0.86, paranormal: 0.95 } satisfies Record<Genre, number>,
    /** A lit lamp's pool of light, as a multiple of its box's long side. */
    lampReach: 2.6,
    /** Where the beam rests before the first touch (image fractions). */
    rest: { x: 0.5, y: 0.45 },
  },
  glint: {
    /** A fine line along the object's outline, in a soft halo; never a box. */
    stroke: 1.2,
    halo: 6,
    blur: 6,
    /** No outline (yet): a faint oval this far inside the box, at this share of the glint. */
    inset: 0.12,
    oval: 0.45,
    peak: 0.45,
    /** An object already looked at glints this much as the beam passes. */
    seen: 0.35,
    /** "Show interactives": every object keeps a faint outline. */
    assist: 0.28,
  },
  page: {
    /** A horizontal fling past this distance and speed turns to the next view. */
    flingDistance: 110,
    flingVelocity: 1300,
  },
  inspect: {
    /** The close-up's crop: the object's box grown by this, then at least `min` of the photo. */
    grow: 1.8,
    min: 0.32,
    /** Ken Burns settle: from this scale to 1. */
    settleFrom: 1.07,
    settleMs: 900,
    cropRadius: 18,
    /** The mechanism's band under the crop. */
    mechanismH: 300,
  },
  tray: { height: 56, chip: 40 },
  ending: { lightMs: 1600, holdMs: 900 },
} as const;
