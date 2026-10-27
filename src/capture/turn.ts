// The 360: the player stands in the middle of the room and turns right a
// little between photos until they are back where they started (docs/DESIGN.md
// 02, the turn dial). Pure maths, shared by the camera's turn dial, its
// sensor hook and their tests:
// - rollPlan / turnPlan: how many photos and how far to turn between them,
//   from the lens's field of view, a target overlap and the photo limits, and
//   switchLens: the plan re-spaced when the lens changes mid-roll;
// - the sensor maths: how far the phone has turned about the vertical since
//   the last photo, from DeviceMotion's rotation rate and gravity;
// - the dial's geometry.
import type { LensChoice } from "./ui/rangefinder/useLenses";
import { MAX_PLATES, MIN_PLATES } from "./slots";

/**
 * Each lens's horizontal field of view in degrees with the phone upright and
 * the 3:4 frame (the sensor's short side across). The iPhone ultra-wide is
 * sold as 120 degrees across the diagonal (13 mm full-frame equivalent): on a
 * 4:3 sensor the short side is 0.6 of the diagonal, so 2 atan(0.6 tan 60) =
 * 92. The main lens is 24 to 26 mm, 2 atan(13 / 26 to 24) = 53 to 57. Typical
 * phones; close enough to plan the turns.
 */
export const LENS_FOV: Readonly<Record<LensChoice, number>> = { wide: 92, main: 55 };

/**
 * How much of their width neighbouring photos should share. 0: the fewest
 * photos that still go all the way round. 0.5x (92) takes 4 photos 90 apart,
 * which just meet (2 degrees shared): the ultra-wide sees enough that four
 * cover the room, and every extra photo is a near-duplicate to take and to
 * build from. The main lens (55) would need 7 and is held to 6 (60 apart),
 * leaving thin gaps, so its prompts word the turn edge to edge. 0.2 gave 0.5x
 * 5 photos 72 apart.
 */
export const TARGET_OVERLAP = 0;

/**
 * Neighbours that share any of the view overlap: "keep part of the last photo
 * in view" is something the player can do (0.5x's 4 photos share a sliver,
 * and the prompt keeps them from turning too far). Below it (1x, held to 6
 * photos, leaves thin gaps) the turn prompts word the turn edge to edge.
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

/** The widest turn that keeps TARGET_OVERLAP on this lens. */
const idealStep = (lens: LensChoice) => LENS_FOV[lens] * (1 - TARGET_OVERLAP);

function overlapOf(lens: LensChoice, step: number): Pick<TurnPlan, "overlap" | "overlaps"> {
  const fov = LENS_FOV[lens];
  const overlap = (fov - step) / fov;
  return { overlap, overlaps: overlap >= MIN_OVERLAP };
}

/**
 * The roll's stops for `lens`. The photos already placed keep their stops
 * (`kept`, slots 0 on, in order; none for a new roll); the rest of the circle,
 * from the last kept stop back round to photo 1, is shared evenly between the
 * fewest more photos that keep TARGET_OVERLAP on this lens, held to the photo
 * limits (never fewer than the photos kept). With nothing kept it is an even
 * circle: 0.5x (92) 5 photos 72 apart, sharing about a fifth; the main lens
 * (55) would need 9, so held to 6 its turn is 60 and neighbours just meet (5
 * degrees of gap): a smaller turn would make them overlap but stop short of
 * the start, and the photos are shown as a loop round the room (the build
 * wait, the play screen), so the plan always closes the circle. The camera
 * says so on 1x and points to 0.5 where the phone has it.
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
 * How far toward the next photo, 0 to 1. Either way round counts: the sign
 * of the turn depends on the platform's axes, and turning left still goes
 * all the way round.
 */
export function turnProgress(turned: number, step: number): number {
  if (!(step > 0)) return 0;
  return Math.min(Math.abs(turned) / step, 1);
}

/** Far enough: within 5 % of the turn (4 degrees at 72), well inside the overlap's margin. */
export const TURN_REACHED = 0.95;

export const isTurnReached = (progress: number) => progress >= TURN_REACHED;

/**
 * Progress as drawn: in steps of 1 / steps so the dial redraws only when the
 * arc visibly moves; under Reduce Motion in quarters, so it steps rather
 * than sweeps.
 */
export function quantizeProgress(progress: number, reducedMotion: boolean): number {
  const steps = reducedMotion ? 4 : 50;
  return Math.floor(Math.min(Math.max(progress, 0), 1) * steps + 1e-9) / steps;
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
