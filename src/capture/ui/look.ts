// The camera's own values beside ref.layout.camera: the camera's chrome (CHROME:
// the rendered leather-and-brass body round the live preview, the sizes its
// pictures share with scripts/blender/props/camera_*.py, and the few movements
// it adds); the turn guide's look
// (src/capture/ui/rangefinder/TurnGuide.tsx), the strokes and see-through
// shares of its two lines and the ghost of the last photo, white over the
// feed with a faint dark casing so both lines read on a bright wall and a
// dark one; and how long a new lens's camera may take to say it's ready.

/** A camera mounted for a new lens that never says it's ready is taken as ready after this (ms). */
export const LENS_SWITCH_TIMEOUT = 2000;

export const GUIDE = {
  /** The last photo over the feed, fixed to the room: see-through enough that the room shows under it. */
  ghostOpacity: 0.38,
  /** It is drawn in this many strips, each stretched to where its part of the room now is (ghostStrip). */
  ghostStrips: 10,
  /** Both lines' white stroke, and the dark casing either side of it. */
  line: 2,
  casing: 1,
  casingOpacity: 0.35,
  /** The mark (where the edge goes): dashes `dash` long `gap` apart, at `markOpacity` until the edge reaches it. */
  dash: 8,
  gap: 6,
  markOpacity: 0.75,
  /** The mark's end ticks, top and bottom: `tick` wide, `tickInset` in from the frame's edges. */
  tick: 14,
  tickLine: 3,
  tickInset: 72,
  /** The moving edge's arrowhead, pointing the way it moves as the player turns right: `arrow` long, at mid-height. */
  arrow: 10,
  /** How far past the frame's sides the moving edge is clamped (share of its width), so it parks just off screen. */
  park: 0.05,
} as const;

// The camera's chrome: a leather camera back with brass fittings, rendered in
// Blender (scripts/blender/props/camera_*.py -> assets/capture, required in
// ./art.ts). Every picture is still and lies under or round its control; the
// live preview is never covered by one. Sizes in points, as the scripts'.
export const CHROME = {
  /** The leather grain's repeating square. */
  leather: 120,
  finder: {
    /** The preview's corner, a share of its width (26 on 1x's 365). */
    radius: 26 / 365,
    /** The frame pictures' margin round the preview, at the width each was drawn for. */
    margin: 13,
    drawn: { main: 365, wide: 273.75 },
    /** Etched marks on the glass at the middle of each side: `length` in from the edge, `line` wide, white at `opacity`. */
    tick: { length: 7, line: 1, opacity: 0.55 },
    /** The shutter's blink over the preview as a photo is taken: to `opacity` over `close` ms, clear again over `open`. */
    blink: { opacity: 0.92, close: 45, open: 150 },
  },
  shutter: {
    /** The release's picture, centred on its 75 box. */
    art: 84,
    /** The advance lever's picture, centred on the release; it turns about its middle. */
    lever: 150,
    /** The lever turned at rest (degrees clockwise; the picture is drawn at rest) and at the far end of its stroke. */
    rest: 0,
    stroke: -32,
    /** Winding on after a photo: out over `out` ms, home over `home`. */
    wind: { out: 170, home: 300 },
    /** The glass sinks this far with the pressed release. */
    travel: 1,
  },
  counter: {
    /** The window's corner, and its bezel picture's margin round it. */
    radius: 9,
    margin: 8,
    /** The plan's count engraved beside the window ("/7"): `gap` right of the window, in the counter's italic at `size`. */
    total: { gap: 13, size: 16, lineHeight: 20 },
  },
  lens: {
    /** The slot's and the cursor's pictures' margins round the track and the thumb. */
    track: 6,
    thumb: 3,
  },
  /** The push buttons' pictures: back and library (their 44 square in a 52 picture), flash and grid (a 48 picture). */
  square: 52,
  round: 48,
  tray: {
    /** The tray picture's margin round the 72 control: its sides and foot, and its top (the cover stands over the control). */
    side: 6,
    top: 12,
    /** The well the prints lie in: inset in the control, its corner; prints come out from under the cover `slot` below the control's top. */
    inset: 4,
    radius: 8,
    slot: 5,
  },
  print: {
    /** A print (the sheet), its white edge, and its picture's margin round the sheet. */
    width: 48,
    height: 62,
    border: 3.5,
    margin: 4,
    /** Where the newest print lies in the well, from the well's top. */
    top: 0.75,
    /** The print under it leans by `lean` degrees; from three photos a third shows, leaning `leanBack`. */
    lean: -7,
    leanBack: 6,
    /** A new print slides out from under the cover over `slide` ms. */
    slide: 460,
    /** The sheet's tone where no photo covers it. */
    paper: "#E9E1D2",
  },
} as const;
