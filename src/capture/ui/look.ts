// The camera's own values beside ref.layout.camera: the turn guide's look
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
