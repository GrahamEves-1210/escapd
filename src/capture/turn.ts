// The 360: the player stands in the middle of the room and turns right a
// little between photos until they are back where they started (docs/DESIGN.md
// 02, the turn dial). Pure maths, shared by the camera's turn dial, its
// sensor hook and their tests:
// - rollPlan / turnPlan: how many photos and how far to turn between them,
//   from the lens's field of view, a target overlap and the photo limits, and
//   switchLens: the plan re-spaced when the lens changes mid-roll;
// - the sensor maths: how far the phone has turned about the vertical since
//   the last photo, from DeviceMotion's rotation rate and gravity (signed:
//   positive is a turn to the right, clockwise seen from above);
// - the turn guide's geometry: where the last photo's edge is on the feed
//   after a turn, and where it has to be for the plan's turn;
// - the dial's geometry.
import type { LensChoice } from "./ui/rangefinder/useLenses";
import { MAX_PLATES, MIN_PLATES } from "./slots";

/** A phone's 4:3 sensor in full-frame-equivalent mm (the 43.27 mm diagonal): 34.62 x 25.96. */
export const SENSOR_MM = { long: 43.27 * 0.8, short: 43.27 * 0.6 } as const;

/** Each lens's 35 mm-equivalent focal length: the ultra-wide 13, the main lens 26. */
export const LENS_MM: Readonly<Record<LensChoice, number>> = { wide: 13, main: 26 };

/**
 * The frame each lens shoots, width / height with the phone upright (the
 * viewfinder and the crop follow it, ref.layout.camera frameAspect /
 * frameAspectWide): 1x the sensor's own 3:4, as the phone's Camera app; 0.5x
 * tall, 9:16 (the sensor's long side kept, the short side cut to 9/16 of it).
 */
export const LENS_ASPECT: Readonly<Record<LensChoice, number>> = { wide: 9 / 16, main: 3 / 4 };

/** Half the frame's width in full-frame-equivalent mm: 12.98 on 1x (the sensor's short side), 9.73 on 0.5x. */
export function frameHalfMm(lens: LensChoice): number {
  return Math.min(SENSOR_MM.short, SENSOR_MM.long * LENS_ASPECT[lens]) / 2;
}

const DEGREES = 180 / Math.PI;

/**
 * Each lens's horizontal field of view in degrees with the phone upright,
 * across the frame it shoots: 2 atan(half width / focal length). 1x:
 * 2 atan(12.98 / 26) = 53.1 (a 24 mm main lens sees 56.8, so 26 errs toward
 * more overlap); 0.5x: 2 atan(9.73 / 13) = 73.7. Typical phones; close
 * enough to plan the turns and to place the turn guide's lines.
 */
export const LENS_FOV: Readonly<Record<LensChoice, number>> = {
  wide: 2 * Math.atan(frameHalfMm("wide") / LENS_MM.wide) * DEGREES,
  main: 2 * Math.atan(frameHalfMm("main") / LENS_MM.main) * DEGREES,
};

/**
 * Photos all the way round on each lens, as the user found by turning with
 * the phone's own Camera app: 1x 7 (51.4 degrees apart, a thin shared edge on
 * a 53-57 degree view), 0.5x 5 (72 apart on a 74 degree view). Few photos
 * matter more than a wide overlap: the turn guide lines each photo up
 * against the last.
 */
export const LENS_SHOTS: Readonly<Record<LensChoice, number>> = { wide: 5, main: 7 };

/**
 * Neighbours that share any of the view overlap: "keep part of the last photo
 * in view" is something the player can do. Below it (a plan held to the photo
 * limit, leaving thin gaps) the turn prompts word the turn edge to edge.
 */
export const MIN_OVERLAP = 0;

export interface TurnPlan {
  /** Photos all the way round. */
  shots: number;
  /** Degrees to turn between the photos still to take (360 / shots on an even circle). */
  step: number;
  /** The share of a photo its neighbour also shows; negative is a gap between them. */
  overlap: number;
  /**
   * Neighbours share enough of the view (MIN_OVERLAP) that "keep part of the
   * last photo in view" is something the player can do. False where the
   * photo limit holds the lens to turns about as wide as it sees (1x): the
   * photos only just meet.
   */
  overlaps: boolean;
}

/** The plan for a roll: the turn plus each photo's stop round the circle. */
export interface RollPlan extends TurnPlan {
  /** Each photo's stop, degrees clockwise from photo 1 (always 0): `shots` of them, in slot order. */
  stops: readonly number[];
}

/** The turn between photos on an even circle of LENS_SHOTS for this lens. */
const idealStep = (lens: LensChoice) => 360 / LENS_SHOTS[lens];

function overlapOf(lens: LensChoice, step: number): Pick<TurnPlan, "overlap" | "overlaps"> {
  const fov = LENS_FOV[lens];
  const overlap = (fov - step) / fov;
  return { overlap, overlaps: overlap >= MIN_OVERLAP };
}

/**
 * The roll's stops for `lens`. The photos already placed keep their stops
 * (`kept`, slots 0 on, in order; none for a new roll); the rest of the circle,
 * from the last kept stop back round to photo 1, is shared evenly between the
 * fewest more photos that turn no wider than this lens's even circle
 * (LENS_SHOTS), held to the photo limits (never fewer than the photos kept).
 * With nothing kept it is an even circle: 1x 7 photos 51.4 apart, 0.5x 5
 * photos 72 apart.
 * Held to the limit, the turn widens rather than stop
 * short of the start: the photos are shown as a loop round the room (the
 * build wait, the play screen), so the plan always closes the circle.
 */
export function rollPlan(lens: LensChoice, kept: readonly number[] = [], max = MAX_PLATES, min = MIN_PLATES): RollPlan {
  // Photo 1 is the start, at 0, whatever lens it was taken on.
  const fixed = kept.length > 0 ? kept : [0];
  const from = fixed[fixed.length - 1];
  const arc = 360 - from;
  // The epsilon keeps 360 / 72 at 5, not 6, through floating point.
  const gaps = Math.max(1, Math.ceil(arc / idealStep(lens) - 1e-9));
  const shots = Math.max(Math.min(Math.max(fixed.length + gaps - 1, min), max), fixed.length);
  const step = arc / (shots - fixed.length + 1);
  const stops = [...fixed, ...Array.from({ length: shots - fixed.length }, (_, i) => from + step * (i + 1))];
  return { shots, step, stops, ...overlapOf(lens, step) };
}

/** The even circle for a lens: how many photos and how far to turn between them. */
export function turnPlan(lens: LensChoice, max = MAX_PLATES, min = MIN_PLATES): TurnPlan {
  const { shots, step, overlap, overlaps } = rollPlan(lens, [], max, min);
  return { shots, step, overlap, overlaps };
}

/**
 * The roll's plan once the lens in use changes to `lens`, with `inUse` slots
 * (up to the last photo, removed ones included) already placed. The photos
 * taken keep their stops and the rest re-space for the new lens, so the count
 * never drops below the photos taken. With none taken it is the lens's even
 * circle. Once every stop is reached the photos already go all the way
 * round, so the stops stay as they are.
 */
export function switchLens(plan: RollPlan, inUse: number, lens: LensChoice): RollPlan {
  if (inUse >= plan.shots) return { ...plan, ...overlapOf(lens, plan.step) };
  return rollPlan(lens, plan.stops.slice(0, inUse));
}

/**
 * The roll's plan when a camera first says which lens it uses. The photos
 * already in (library picks, or a roll begun before the lenses were known)
 * weren't taken on the plan's stops, so it is the lens's even circle when
 * that holds them; with more photos than it has, they keep their stops
 * (switchLens).
 */
export function firstLens(plan: RollPlan, inUse: number, lens: LensChoice): RollPlan {
  const even = rollPlan(lens);
  return inUse <= even.shots ? even : switchLens(plan, inUse, lens);
}

/** Degrees from the stop before `index` to its own (round past the start for photo 1). */
export function turnStep(stops: readonly number[], index: number): number {
  if (stops.length === 0) return 0;
  const at = Math.min(Math.max(index, 0), stops.length - 1);
  return at > 0 ? stops[at] - stops[at - 1] : 360 - stops[stops.length - 1] + stops[0];
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RotationRate {
  alpha: number;
  beta: number;
  gamma: number;
}

/**
 * DeviceMotion's rotationRate as the device's x, y and z axes, in deg/s.
 * Checked against expo-sensors 58's native code (turn-test pins it): iOS
 * sends CoreMotion's rotationRate converted with radiansToDegrees, alpha = z,
 * beta = y, gamma = x; Android the gyroscope's values through
 * Math.toDegrees, alpha = x, beta = y, gamma = z. Both stamp the sample in
 * seconds (CoreMotion's timestamp; the gyroscope's nanoseconds / 1e9).
 */
export function rateAxes(rate: RotationRate, os: string): Vec3 {
  return os === "ios" ? { x: rate.gamma, y: rate.beta, z: rate.alpha } : { x: rate.alpha, y: rate.beta, z: rate.gamma };
}

/** How much of each new gravity sample the smoothed direction takes. */
export const GRAVITY_SMOOTHING = 0.2;

/**
 * Low-pass filtered acceleration including gravity: what stays is gravity,
 * which way is down in the device's axes. Only its direction is used, so its
 * sign (the platforms disagree) doesn't matter.
 */
export function smoothGravity(previous: Vec3 | null, sample: Vec3, k = GRAVITY_SMOOTHING): Vec3 {
  if (!previous) return sample;
  return {
    x: previous.x + (sample.x - previous.x) * k,
    y: previous.y + (sample.y - previous.y) * k,
    z: previous.z + (sample.z - previous.z) * k,
  };
}

/**
 * The turn rate about the vertical (deg/s): the rotation rate along gravity,
 * so it holds however the phone is tilted. Signed; 0 with no usable gravity.
 */
export function turnRate(rate: Vec3, gravity: Vec3): number {
  const g = Math.hypot(gravity.x, gravity.y, gravity.z);
  if (!(g > 1e-6)) return 0;
  return (rate.x * gravity.x + rate.y * gravity.y + rate.z * gravity.z) / g;
}

/** About 30 motion samples a second: smooth enough for the arc, cheap on the battery. */
export const TURN_SAMPLE_MS = 33;

/** Wall-clock seconds, for a sample that comes without the sensor's own time. */
export const nowSeconds = () => Date.now() / 1000;

/** Rates slower than this (deg/s) are hand tremor and sensor drift, not a turn. */
export const TURN_DEADBAND = 2;
/** A gap between samples longer than this (s) is a stall (the app paused), not motion. */
export const MAX_SAMPLE_GAP = 0.25;

/** Adds one sample's turn to the running total (degrees, signed). */
export function integrateTurn(turned: number, rate: number, dt: number, deadband = TURN_DEADBAND): number {
  if (!(dt > 0) || dt > MAX_SAMPLE_GAP || !Number.isFinite(rate)) return turned;
  if (Math.abs(rate) < deadband) return turned;
  return turned + rate * dt;
}

/**
 * How far toward the next photo, 0 to 1. Only a turn to the right counts
 * (turnRate is positive clockwise on both platforms): the stops go round
 * clockwise, and the turn guide's lines only meet turning right.
 */
export function turnProgress(turned: number, step: number): number {
  if (!(step > 0) || !(turned > 0)) return 0;
  return Math.min(turned / step, 1);
}

/** Far enough, at most: within 5 % of the turn, where neighbours share plenty of view. */
export const TURN_REACHED = 0.95;

/** The least slack allowed short of the turn (degrees): about the sensor's own noise over one turn. */
export const MIN_TURN_SLACK = 0.5;

/**
 * How far into a turn of `step` degrees counts as far enough, 0 to 1, on a
 * view `fov` across: short of the turn by 5 % (TURN_REACHED) or by half the
 * view neighbours share, whichever is less, but never by under
 * MIN_TURN_SLACK. With 7 photos on 1x (51.4 on 53.1) neighbours share only
 * 1.6 degrees: 5 % (2.6) short at every photo would add up round the room
 * to a gap of about 13 degrees between the last photo and the first. Half the
 * share (0.8) keeps every pair overlapping, and the tick lands with the turn
 * guide's edge within about 6 pt of its mark (on a 365-pt feed). Without a
 * shared view (fov at or under the step) it is the least slack.
 */
export function turnReach(step: number, fov: number): number {
  if (!(step > 0)) return TURN_REACHED;
  const slack = Math.max(MIN_TURN_SLACK, Math.min(step * (1 - TURN_REACHED), (fov - step) / 2));
  return Math.max(0, 1 - slack / step);
}

export const isTurnReached = (progress: number, reach = TURN_REACHED) => progress >= reach - 1e-9;

/** What a turn carries into the next, at most this share of a step either way: past that it wasn't a turn toward the stop. */
const MAX_CARRY = 0.5;

/**
 * The carry into the turn after `old`: what `old` fell short of its target
 * (negative: went past), its target already holding what it carried itself;
 * only after a turn that was shown and went far enough (the photo was taken
 * on the guide), otherwise 0.
 */
export function turnCarry(old: { shown: boolean; reached: boolean; target: number; turned: number }, step: number): number {
  if (!old.shown || !old.reached || !(step > 0)) return 0;
  const limit = step * MAX_CARRY;
  return Math.min(Math.max(old.target - old.turned, -limit), limit);
}

/**
 * Progress as drawn: in steps of 1 / steps so the dial redraws only when the
 * arc visibly moves; under Reduce Motion in quarters, so it steps rather
 * than sweeps.
 */
export function quantizeProgress(progress: number, reducedMotion: boolean): number {
  const steps = reducedMotion ? 4 : 50;
  return Math.floor(Math.min(Math.max(progress, 0), 1) * steps + 1e-9) / steps;
}

// ---- The turn guide's geometry (TurnGuide.tsx). The feed is a pinhole view
// `fov` degrees across: a direction `a` degrees right of the view's middle
// shows at x = W / 2 + (W / 2) tan(a) / tan(fov / 2). The last photo's right
// edge was fov / 2 right of its middle; after the phone turns `turned`
// degrees right it is (fov / 2 - turned) right of the feed's middle, so it
// slides left across the feed as the player turns, fixed to the room.

const RAD = Math.PI / 180;

/**
 * Where a direction `deg` degrees right of the view's middle shows on a feed
 * `fov` degrees across, as a share of its width (0 its left edge, 1 its
 * right). Off the feed it is below 0 or above 1; behind the phone (90 or more
 * either side) it is -Infinity or Infinity.
 */
export function viewX(deg: number, fov: number): number {
  "worklet";
  if (deg <= -90) return -Infinity;
  if (deg >= 90) return Infinity;
  return 0.5 + (0.5 * Math.tan(deg * RAD)) / Math.tan((fov / 2) * RAD);
}

/** The direction (degrees right of the view's middle) that shows at share `x` of a feed `fov` across: viewX's inverse. */
export function angleAtX(x: number, fov: number): number {
  "worklet";
  return Math.atan((x - 0.5) * 2 * Math.tan((fov / 2) * RAD)) / RAD;
}

/**
 * Where the last photo's strip from share `from` to `to` of its width shows
 * on the feed after a turn of `turned` degrees right: the same directions,
 * now `turned` further left. The turn guide draws the last photo as such
 * strips, each stretched to its place, so it lies on the room across its
 * whole width (a turn bends a pinhole view: one shift for the whole photo
 * would drift off the room by up to 2 % of the width away from its edge).
 */
export function ghostStrip(from: number, to: number, turned: number, fov: number): { left: number; right: number } {
  "worklet";
  // Directions behind the phone have no place on the feed: held just short of it, far off the frame.
  const held = (a: number) => Math.min(Math.max(a, -89), 89);
  return { left: viewX(held(angleAtX(from, fov) - turned), fov), right: viewX(held(angleAtX(to, fov) - turned), fov) };
}

/** Where the last photo's right edge is on the feed after turning `turned` degrees right (1 before any turn). */
export function edgeX(turned: number, fov: number): number {
  "worklet";
  return viewX(fov / 2 - turned, fov);
}

/**
 * The turn guide's mark: where the last photo's edge has to be for the
 * plan's turn (`step`), as a share of the feed's width. Left of it the feed
 * shares the last photo's view: the overlap, (fov - step) / fov of the turn.
 */
export function targetX(step: number, fov: number): number {
  "worklet";
  return edgeX(step, fov);
}

// ---- The dial's geometry: degrees clockwise from straight up, as a compass.

const DEG = Math.PI / 180;

/** A point on a circle of `radius` round (cx, cy) at `deg` clockwise from the top. */
export function dialPoint(cx: number, cy: number, radius: number, deg: number): { x: number; y: number } {
  return { x: cx + Math.sin(deg * DEG) * radius, y: cy - Math.cos(deg * DEG) * radius };
}

/** An even circle's stops: photo 1 at the top, the rest clockwise, `step` apart. */
export function dialStops(shots: number, step = 360 / shots): number[] {
  return Array.from({ length: shots }, (_, i) => i * step);
}

/** SVG path data for an arc clockwise from `from` through `sweep` degrees (an empty string for none). */
export function arcPath(cx: number, cy: number, radius: number, from: number, sweep: number): string {
  if (!(sweep > 0)) return "";
  const clamped = Math.min(sweep, 359.99);
  const start = dialPoint(cx, cy, radius, from);
  const end = dialPoint(cx, cy, radius, from + clamped);
  const large = clamped > 180 ? 1 : 0;
  const r = (v: number) => Math.round(v * 100) / 100;
  return `M${r(start.x)} ${r(start.y)}A${r(radius)} ${r(radius)} 0 ${large} 1 ${r(end.x)} ${r(end.y)}`;
}
