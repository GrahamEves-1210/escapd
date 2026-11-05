// Laser-pointer play: the flashlight's spot held still near the cat on the
// ledge (or drawn slowly past it) is a laser pointer to a cat. This decides
// when it's worth a pounce; PeekingCat plays it (eyes locked on, a crouch, the
// butt wiggle, the swat, and a pleased or embarrassed look after). Rare enough
// to stay a treat: once the spot has dwelt near it a moment, and never again
// until a long cooldown has run and the spot has moved since.

/** The spot counts as near within `near` points of its head; slow is under `slow` pt/s; it must dwell `dwell` ms. */
export const LASER = {
  near: 150,
  slow: 170,
  dwell: 900,
  /** After a play, none for this long (ms). */
  cooldown: 40000,
  /** A move this far (points) between samples is the player moving the light. */
  moved: 2,
  /** At the swat, the spot still this close (points) to where it was at the crouch: a catch (mostly). */
  catchWithin: 36,
  /** How often a still spot is caught anyway (the rest: a near miss, for charm). */
  catchOdds: 0.75,
  /** The most one sample counts for (ms). */
  gap: 200,
} as const;

/** The laser's read of the light, sample to sample. */
export type LaserState = {
  last: { x: number; y: number; t: number } | null;
  /** How long (ms) the spot has dwelt near, slowly. */
  dwell: number;
  /** The light has moved since the last play (or since the room came up). */
  moved: boolean;
  /** When the last play started (ms). */
  lastPlay: number;
};

export const initialLaser = (): LaserState => ({ last: null, dwell: 0, moved: false, lastPlay: -Infinity });

/**
 * One sample of the light (`x`, `y`: window points, at `t` ms) against the
 * cat's head (`cat`, window points). `ready`: the cat is free to play (awake,
 * idle, no hand on it, nothing else going on). A new state, and whether to
 * start a play now.
 */
export function laserTick(s: LaserState, x: number, y: number, t: number, cat: { x: number; y: number }, ready: boolean): { state: LaserState; start: boolean } {
  const last = s.last;
  // A long gap between samples (the app paused) counts as one sample's worth, never as a long dwell.
  const dt = last ? Math.min(LASER.gap, Math.max(0, t - last.t)) : 0;
  const step = last ? Math.hypot(x - last.x, y - last.y) : 0;
  const speed = dt > 0 ? (step / dt) * 1000 : 0;
  const moved = s.moved || step > LASER.moved;
  const near = Math.hypot(x - cat.x, y - cat.y) < LASER.near;
  let dwell = s.dwell;
  if (near && speed < LASER.slow && moved) dwell += dt;
  else if (near) dwell = Math.max(0, dwell - dt * 2);
  else dwell = 0;
  const next: LaserState = { last: { x, y, t }, dwell, moved, lastPlay: s.lastPlay };
  if (ready && moved && dwell >= LASER.dwell && t - s.lastPlay >= LASER.cooldown) {
    return { state: { ...next, dwell: 0, moved: false, lastPlay: t }, start: true };
  }
  return { state: next, start: false };
}

/** At the swat: caught it, if the spot stayed put (and the cat's aim is true this time: `luck` 0..1, as Math.random). */
export function caught(at: { x: number; y: number }, now: { x: number; y: number }, luck: number) {
  return Math.hypot(now.x - at.x, now.y - at.y) < LASER.catchWithin && luck < LASER.catchOdds;
}
