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

/**
 * The music box, seen from above (everything but the crank's arm), and the crank's arm pointing right from
 * its pivot. What the sheet draws over the box, in the picture's points: the cylinder (its ends, its axis,
 * its radius: the pins ride it), the comb's six teeth low to high (each one's column, its tip, its root,
 * its engraved mark), and the pivot the crank turns on.
 */
export const MUSICBOX = {
  art: require("../../../assets/reveal/musicbox.png") as number,
  crank: require("../../../assets/reveal/musicbox-crank.png") as number,
  w: 330,
  h: 300,
  cyl: { x0: 44, x1: 232, y: 128, r: 30 },
  columns: [[42.2, 70.47], [74.87, 103.13], [107.53, 135.8], [140.2, 168.47], [172.87, 201.13], [205.53, 233.8]],
  tip: 159,
  roots: [212, 208, 204, 200, 196, 192],
  markY: 181,
  mark: 15,
  pivot: { x: 278, y: 152 },
  arm: 26,
  crankW: 64,
  crankH: 36,
  crankPivot: { x: 15, y: 18 },
} as const;

/**
 * The typewriter ribbon's spool standing on the desk (lower flange and winding), its top flange as
 * `frames` pictures over a sixth of a turn (a sheet, `columns` across), and the clip on the ribbon's end.
 * In the spool's picture: where the ribbon leaves the winding (`leaves`: its x, its top and bottom edge)
 * and the top of the spool's axis, which the flange's `flangeCentre` sits on. `radius` is the winding's,
 * `flangeR` the flange's, in points; `black`, `red` and `redShare` are the ribbon as the picture has it
 * there, for the ribbon drawn on from it.
 */
export const RIBBON = {
  spool: require("../../../assets/reveal/ribbon-spool.png") as number,
  flange: require("../../../assets/reveal/ribbon-flange.png") as number,
  clip: require("../../../assets/reveal/ribbon-clip.png") as number,
  w: 190,
  h: 172,
  leaves: { x: 95, top: 79.56, bottom: 135.56 },
  axis: { x: 95, y: 51.62 },
  flangeW: 176,
  flangeH: 100,
  frames: 8,
  columns: 4,
  flangeCentre: { x: 88, y: 49.17 },
  radius: 52,
  flangeR: 84,
  clipW: 40,
  clipH: 72,
  clipEnd: { x: 4.19, y: 36 },
  clipTop: 8,
  black: "#262123",
  red: "#752725",
  redShare: 26 / 56,
} as const;
