// The peeking cat's stop-motion frame: every value it's drawn from, snapshotted
// 12 times a second (useStopMotion), by index.
export const F = {
  rise: 0, hop: 1, breath: 2, tilt: 3, lid: 4, sx: 5, sy: 6, doze: 7, think: 8, bx: 9, by: 10, droop: 11, gaze: 12, gx: 13, gy: 14,
  excite: 15, touch: 16, lean: 17, purr: 18, clock: 19, rel: 20, track: 21, poke: 22,
  /** Laser play: eyes locked on the spot (0..1); crouched (1) or stretched up for the pounce (-1); the butt wiggle (0..1) and its clock (0..1, round and round). */
  hunt: 23, crouch: 24, wiggle: 25, wclock: 26,
  /** Its paws (left, right): lifted (art px up), moved across (art px, + right), turned (degrees, clockwise). */
  pawLY: 27, pawLX: 28, pawLR: 29, pawRY: 30, pawRX: 31, pawRR: 32,
  /** Its mouth open (a yawn, 0..1), its tongue out (a lick, 0..1), a blush (0..1), its tail up behind it (0..1). */
  mouth: 33, tongue: 34, blush: 35, tail: 36,
  /** Pleased with itself (0..1: a smug half-lid); looking away, embarrassed (-1..1: which way). */
  smug: 37, away: 38,
  /** A swat's swipe lines playing (0..1), and which side (-1 left, 1 right). */
  swipe: 39, swipeSide: 40,
} as const;
