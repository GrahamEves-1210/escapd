// The 360: the player stands in the middle of the room and turns right a
// little between photos until they are back where they started (docs/DESIGN.md
// 02, the turn dial). Pure maths, shared by the camera's turn dial, its
// sensor hook and their tests:
// - turnPlan: how many photos and how far to turn between them, from the
//   lens's field of view and the photo limits;
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

/** Neighbouring photos should share about a third of their width. */
export const TARGET_OVERLAP = 1 / 3;

export interface TurnPlan {
  /** Photos all the way round. */
  shots: number;
  /** Degrees to turn between photos (360 / shots). */
  step: number;
  /** The share of a photo its neighbour also shows; negative is a gap between them. */
  overlap: number;
  /**
   * Neighbours share part of the view, so "keep part of the last photo in
   * view" is something the player can do. False where the photo limit holds
   * the lens to turns wider than it sees (1x): the photos only just meet.
   */
  overlaps: boolean;
}

/**
 * The fewest photos that go all the way round with TARGET_OVERLAP, held to
 * the photo limits; the turn is then an even share of the circle. The
 * ultra-wide (92) needs 6 photos 60 apart, about a third overlapping. The
 * main lens (55) would need 10; held to 6, its turn is also 60, so neighbours
 * just meet (5 degrees of gap): a smaller turn would make them overlap but
 * stop short of the start, and the photos are shown as a loop round the room
 * (the build wait, the play screen), so the plan always closes the circle.
 * The camera says so on 1x and points to 0.5 where the phone has it.
 */
export function turnPlan(lens: LensChoice, max = MAX_PLATES, min = MIN_PLATES): TurnPlan {
  const fov = LENS_FOV[lens];
  const ideal = fov * (1 - TARGET_OVERLAP);
  // The epsilon keeps 360 / 60 at 6, not 7, through floating point.
  const shots = Math.min(Math.max(Math.ceil(360 / ideal - 1e-9), min), max);
  const step = 360 / shots;
  const overlap = (fov - step) / fov;
  return { shots, step, overlap, overlaps: overlap > 0 };
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

/** Far enough: within 5 % of the turn (3 degrees at 60), well inside the overlap's margin. */
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

/** Each photo's stop round the dial: photo 1 at the top, the rest clockwise, `step` apart. */
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
