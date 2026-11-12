// The reveal sheets' rendered props (scripts/blender/props/reveal_*.py: modelled, lit and inked with
// the Blender kit, static pictures). Each is its picture, the picture's size in points, and the point
// in it the sheet places it by (the script prints these when it renders; change them together).
//
// Everything that moves or is written stays drawn live: the writing, the graphite, the red filter,
// the reflection, the fold. These are only the hard objects in the scene.

/** The brass gooseneck lamp, off and lit (one framing): placed by its bulb's centre. */
export const LAMP = {
  off: require("../../../assets/reveal/lamp.png") as number,
  lit: require("../../../assets/reveal/lamp-lit.png") as number,
  w: 312,
  h: 216,
  bulb: { x: 81.6, y: 118.24 },
} as const;

/**
 * The arched wall mirror, for a mirror 300 x 336 pt with its glass inset 22 pt (smaller mirrors scale
 * both): the frame (its opening empty; `box` is the mirror's top-left corner in the picture), and what
 * lies on the glass, to go over the reflection (the opening and `bleed` more on every side).
 */
export const MIRROR = {
  frame: require("../../../assets/reveal/mirror-frame.png") as number,
  glass: require("../../../assets/reveal/mirror-glass.png") as number,
  width: 300,
  inset: 22,
  w: 316,
  h: 362,
  box: { x: 8, y: 18 },
  glassW: 260,
  glassH: 296,
  bleed: 2,
} as const;

/** The red gel in its brass ring, see-through: placed by the gel's centre; the gel is 56 pt in radius. */
export const LENS = {
  art: require("../../../assets/reveal/lens.png") as number,
  w: 152,
  h: 152,
  gel: { x: 73, y: 73 },
} as const;

/** The pencil stub, lying along +x: placed (and turned) by its point. */
export const PENCIL = {
  art: require("../../../assets/reveal/pencil.png") as number,
  w: 158,
  h: 34,
  tip: { x: 3.25, y: 17 },
} as const;

/** The notepad's wire coil and torn stub, for a pad 290 pt wide (narrower pads scale it): `pad` is the pad's top-left corner in the picture. */
export const BINDING = {
  art: require("../../../assets/reveal/notepad-binding.png") as number,
  padW: 290,
  w: 302,
  h: 66,
  pad: { x: 6, y: 16 },
} as const;

/** The brass paperweight on the fold-in page's corner, seen from above, its shadow in the picture: placed by its middle. */
export const PAPERWEIGHT = {
  art: require("../../../assets/reveal/paperweight.png") as number,
  w: 60,
  h: 60,
  centre: { x: 28.32, y: 28.32 },
} as const;
