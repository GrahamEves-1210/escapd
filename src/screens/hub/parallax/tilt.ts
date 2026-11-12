// Home's motion parallax (HubScreen, WindowBackdrop): how the phone's tilt
// becomes a small, steady offset for the set's layers. Pure maths, no React:
// - tiltAngles: gravity in the phone's own axes -> how far it is rolled to the
//   side and pitched back (radians);
// - aimTilt: those angles against a slowly moving rest pose -> where the
//   layers should head, -1..1 each way. Whatever angle the phone is held at
//   becomes neutral within a few seconds, so there is no "right" way to hold it;
// - movesTilt: the dead band, so a still hand gives a still picture (the
//   glide to each new aim is a critically damped spring: PARALLAX.glide);
// - layerShift: a layer's slide in points for a tilt and its depth.
// The numbers are PARALLAX (art/nook.ts).
import { PARALLAX } from "../art/nook";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Where the layers are headed (and are): -1..1 across (x, + = seen from the right) and down (y, + = seen from below). */
export interface Tilt {
  x: number;
  y: number;
}

/** The rest pose the tilt is measured from: the phone's roll and pitch, low-passed over PARALLAX.recentre seconds. */
export interface TiltRest {
  roll: number;
  pitch: number;
  primed: boolean;
}

export const NO_TILT: Tilt = { x: 0, y: 0 };
export const NO_REST: TiltRest = { roll: 0, pitch: 0, primed: false };

const clamp = (v: number, lo: number, hi: number) => {
  "worklet";
  return Math.min(hi, Math.max(lo, v));
};

/**
 * The phone's lean from gravity in its own axes (x to its right, y to its
 * top, z out of the screen; the vector points at the ground, as expo-sensors'
 * accelerationIncludingGravity does on both platforms): `roll` + when its
 * right edge dips, `pitch` 0 held upright .. a quarter turn lying flat on its
 * back, growing as its top edge tips away. Null when there's no gravity to read.
 */
export function tiltAngles(g: Vec3): { roll: number; pitch: number } | null {
  const size = Math.hypot(g.x, g.y, g.z);
  if (!Number.isFinite(size) || size < PARALLAX.minGravity) return null;
  return { roll: Math.asin(clamp(g.x / size, -1, 1)), pitch: Math.atan2(-g.z, -g.y) };
}

/**
 * One sensor sample: the rest pose drifts toward the phone's pose (so any
 * pose it's held in for a while is neutral), and the aim is the pose's
 * distance from it, as shares of PARALLAX.range, clamped. A dipped right edge
 * shows the scene from the left (x < 0); a top edge tipped away shows it from
 * below (y > 0). The first sample only sets the rest pose.
 */
export function aimTilt(rest: TiltRest, roll: number, pitch: number, dt: number): { rest: TiltRest; aim: Tilt } {
  if (!rest.primed) return { rest: { roll, pitch, primed: true }, aim: NO_TILT };
  const k = 1 - Math.exp(-Math.max(0, dt) / PARALLAX.recentre);
  const next = { roll: rest.roll + (roll - rest.roll) * k, pitch: rest.pitch + (pitch - rest.pitch) * k, primed: true };
  return {
    rest: next,
    aim: {
      x: clamp(-(roll - next.roll) / PARALLAX.range, -1, 1),
      y: clamp((pitch - next.pitch) / PARALLAX.range, -1, 1),
    },
  };
}

/**
 * Whether a new aim is worth moving for: inside PARALLAX.dead of the last one
 * it isn't (sensor noise never reaches the picture: a still hand, a still
 * picture), except to come exactly to rest.
 */
export function movesTilt(last: Tilt, aim: Tilt): boolean {
  if (aim.x === 0 && aim.y === 0) return last.x !== 0 || last.y !== 0;
  return Math.abs(aim.x - last.x) >= PARALLAX.dead || Math.abs(aim.y - last.y) >= PARALLAX.dead;
}

/** A layer's slide in points: `depth` points at full tilt across, PARALLAX.vertical of that up and down. */
export function layerShift(tilt: Tilt, depth: number): Tilt {
  "worklet";
  return { x: tilt.x * depth, y: tilt.y * depth * PARALLAX.vertical };
}

/** A pointer on the web stands in for the tilt: its place in the window, -1..1 from the middle. */
export function pointerTilt(x: number, y: number, width: number, height: number): Tilt {
  if (!(width > 0) || !(height > 0)) return NO_TILT;
  return { x: clamp((x / width) * 2 - 1, -1, 1), y: clamp((y / height) * 2 - 1, -1, 1) };
}

/** A tilt given by hand ("0.5,-1": development only), or null. */
export function parseTilt(text: string | null | undefined): Tilt | null {
  if (!text) return null;
  const [x, y] = text.split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
}
