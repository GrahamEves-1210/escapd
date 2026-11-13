// The music box's and the typewriter ribbon's arithmetic (pure: tested without a renderer).
//
// The music box: four pins on a brass cylinder, one for each note of the tune, each in the column of the
// comb's tooth it plucks. The crank turns the cylinder (geared down, forward only); a pin plucks its tooth
// as it comes round to the comb. The pins are NOTE_STEP apart, so the four notes take less than half a
// turn and the rest of the cylinder is bare: the tune has a beginning.
//
// The ribbon: the line lies along it from the clip inward, so pulling brings its first letter out first.

/** The comb's six teeth, low to high: the door's wheel symbols in their order. */
export const TUNE_MARKS = ["▲", "●", "◆", "■", "★", "✚"] as const;

/** A tune card's text ("◆ ★ ▲ ●") as the teeth it plucks, in order (anything that isn't a mark is skipped). */
export function tuneOf(text: string): number[] {
  const notes: number[] = [];
  for (const ch of text) {
    const i = (TUNE_MARKS as readonly string[]).indexOf(ch);
    if (i >= 0) notes.push(i);
  }
  return notes;
}

/** Degrees of the cylinder between one note's pin and the next. */
export const NOTE_STEP = 50;
/** The cylinder's turn for a turn of the crank. */
export const GEAR = 1 / 3;
/** Where a pin plucks, in degrees round the cylinder from its top toward the comb: at the edge, where it goes over onto the tooth. */
export const PLUCK_AT = 90;
/** How far short of plucking the first pin stands when the box is opened (degrees of cylinder). */
export const LEAD_IN = 26;

/** Pin `k`'s place round the cylinder once it has turned `turn` degrees: -180..180 from its top, positive toward the comb (in view between -90 and 90). */
export function pinAngle(k: number, turn: number): number {
  "worklet";
  const a = PLUCK_AT - LEAD_IN - k * NOTE_STEP + turn;
  return ((((a + 180) % 360) + 360) % 360) - 180;
}

/** How many times pin `k` has plucked by the time the cylinder has turned `turn` degrees (from 0, forward). */
export function plucks(k: number, turn: number): number {
  "worklet";
  return Math.max(0, Math.floor((turn - LEAD_IN - k * NOTE_STEP) / 360) + 1);
}

/** The cylinder's turn at which every one of `count` pins is in view at once, evenly either side of its top (for a still picture of the tune). */
export function parkedTurn(count: number): number {
  return LEAD_IN - PLUCK_AT + ((count - 1) * NOTE_STEP) / 2;
}

/** The crank's turn from the finger's angle about its pivot going from `from` to `to` (radians, screen: clockwise positive), the short way. */
export function crankStep(from: number, to: number): number {
  "worklet";
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** The ribbon: its blank leader between the clip and the line's first letter, and how far past the spool the line's last letter must come to be out. */
export const LEADER = 30;
export const CLEAR = 14;

/** How far the ribbon must be pulled for a line `width` points long to be all out, when `out` points of it are out before any pull and the spool hides the first `hidden` points. */
export function pullToRead(width: number, out: number, hidden: number): number {
  return Math.max(0, LEADER + width + CLEAR + hidden - out);
}

/** The top flange's picture (one of `frames` over a sixth of a turn) for a ribbon pulled `pulled` points off a winding `radius` points across. */
export function flangeFrame(pulled: number, radius: number, frames: number): number {
  "worklet";
  const sixth = (((pulled / radius) * 180) / Math.PI / 60) % 1;
  return Math.min(frames - 1, Math.floor((sixth < 0 ? sixth + 1 : sixth) * frames));
}
