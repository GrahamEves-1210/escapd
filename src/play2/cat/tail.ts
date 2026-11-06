// The sitting cat's tail, as a real one moves (SittingCat draws it). A chain
// of `joints` along it (s 0 at the base, 1 at the tip), each a damped spring
// following the one below it, so whatever the base does runs up the tail late
// and the tip, lightest and loosest, swings past where it's going and snaps
// back. What the springs chase, at each joint, is the bend its muscles make
// from the joint below:
//   - a `sweep` of the whole tail out and back (`swing` degrees at full, most
//     of it low, where the tail lifts off the floor),
//   - a `wave` travelling up it: a bend that runs from base to tip, each joint
//     a little later than the one below (`lag` radians of phase over the
//     tail, a bit more than half a wave, so it lies in an S and snakes), its
//     speed and size drifting on incommensurate slow sines (`drift`) so the
//     sway is never quite periodic,
//   - a `curl` at the tip (`hook` degrees: the question mark),
//   - and a `twitch` of the tip alone, a quick ringing spring of its own.
// The sweep and the curl ease to their goals as critically damped springs, at
// a rate the mood sets. Its moods (moves picked on the UI thread, stepTail):
//   - calm: a slow lazy sway, the S-wave rolling gently up it; now and then a
//     rest curled into a question mark, a flick (out and back in about a third
//     of a second, the tip cracking past and snapping back), or a tip-only flick,
//   - cross (rough handling): big lashes side to side, the wave fast and large,
//     the tip twitching,
//   - content (purring): a slow, small sway, the tip curled.
// The base, under the haunch, never moves (no seam); the floor part barely.
export const WHIP = {
  joints: [0.22, 0.4, 0.58, 0.76, 0.9, 1],
  // Stiff enough that a flick is done in a third of a second; the tip loosest (it overshoots and snaps back).
  omega: [26, 23, 20, 18, 16, 15],
  zeta: [0.8, 0.6, 0.5, 0.45, 0.4, 0.36],
  swing: 52,
  sweep: [0.04, 0.42, 0.26, 0.14, 0.09, 0.05],
  hook: 42,
  curl: [0, 0, 0.04, 0.16, 0.34, 0.46],
  twitch: [0, 0, 0, 0.25, 0.6, 1],
  twitchOmega: 34,
  twitchZeta: 0.18,
  twitchKick: 22,
  /** The travelling wave: each joint's share of `swing` degrees of bend, its phase `lag` over the tail, and its frequency (Hz) per mood. */
  wave: {
    swing: 48,
    share: [0, 0.2, 0.3, 0.32, 0.3, 0.26],
    lag: Math.PI * 1.35,
    hz: { calm: 0.32, cross: 1.35, content: 0.18 },
    /** Its size per mood (of `swing`), easing to it at `omega` rad/s. */
    amp: { calm: 0.7, cross: 1, content: 0.35 },
    omega: 2.2,
    /** Slow drifts of its speed and size: [rate (rad/s), depth] pairs, summed. */
    drift: [[0.37, 0.28], [0.91, 0.17], [0.23, 0.22]],
  },
  /** Calm: a sway out to `out` (plus up to `outSpread`) or in to `in` (less up to `inSpread`), easing at `omega` (plus up to `omegaSpread`), for `s` s (plus up to `sSpread`). */
  swish: { out: 0.45, outSpread: 0.3, in: -0.25, inSpread: 0.25, omega: 3, omegaSpread: 1.6, s: 1.6, sSpread: 2.2, curl: 0.18 },
  /** A rest, now and then (`chance` of each move): nearly still, curled into a question mark, eased in slowly (the wave dies down). */
  rest: { chance: 0.18, at: 0.12, atSpread: 0.18, omega: 1.8, s: 2.4, sSpread: 2.6, curl: 1, wave: 0.25 },
  /** A flick (`chance` of each move): out to `to` fast, held `hold` s, then back at `back` rad/s; the whip runs up the tail. */
  flick: { chance: 0.16, to: 1.6, omega: 30, hold: 0.14, back: 14 },
  /** A flick of the tip alone (`chance` of each move): a kick to the twitch, a bit harder. */
  tipFlick: { chance: 0.14, kick: 1.6 },
  twitches: { calm: [3, 5], cross: [0.4, 0.7], content: [4, 5] },
  cross: { at: 0.55, atSpread: 0.3, omega: 18, omegaSpread: 6, s: 0.28, sSpread: 0.22, curl: -0.2 },
  content: { at: 0.22, atSpread: 0.12, omega: 1.5, s: 2.4, sSpread: 1.2, curl: 1 },
  /** How fast the curl eases to its goal (rad/s, critically damped). */
  curlOmega: 2.6,
  /** Integration step (s): small enough for the stiffest spring, whatever the frame rate. */
  step: 1 / 300,
} as const;

const RADIANS = Math.PI / 180;

/** Calm, cross (rough handling) or content (purring). */
export type TailMood = 0 | 1 | 2;

/** The tail's motion (see WHIP): each joint's turn and spin, the sweep's, the curl's, the wave's and the twitch's, and its timetable (s). */
export type TailState = {
  t: number; th: number[]; v: number[];
  sweep: number; sweepV: number; goal: number; omega: number;
  curl: number; curlV: number; curlGoal: number;
  /** The wave's phase (radians), its size (0..1) and the size it's easing to. */
  ph: number; wa: number; waGoal: number;
  tw: number; twV: number;
  next: number; back: number; backGoal: number; backOmega: number; twitchAt: number;
  /** The mood its moves were picked for (a new one starts a move at once). */
  mood: TailMood;
};

/** The tail as it lies, about to start a sway. */
export function restTail(): TailState {
  "worklet";
  const n = WHIP.joints.length;
  const th: number[] = [], v: number[] = [];
  for (let j = 0; j < n; j++) {
    th.push(0);
    v.push(0);
  }
  return {
    t: 0, th, v, sweep: 0, sweepV: 0, goal: 0, omega: WHIP.swish.omega,
    curl: 0, curlV: 0, curlGoal: WHIP.swish.curl, ph: 0, wa: 0, waGoal: WHIP.wave.amp.calm, tw: 0, twV: 0,
    next: 0.4, back: -1, backGoal: 0, backOmega: 0, twitchAt: 3, mood: 0,
  };
}

/** Its next move, when the last one's time is up (`rand` 0..1, as Math.random). */
function nextMove(st: TailState, mood: TailMood, rand: () => number) {
  "worklet";
  if (mood === 1) {
    const c = WHIP.cross;
    st.goal = (st.goal > 0 ? -1 : 1) * (c.at + c.atSpread * rand());
    st.omega = c.omega + c.omegaSpread * rand();
    st.curlGoal = c.curl;
    st.waGoal = WHIP.wave.amp.cross;
    st.next = st.t + c.s + c.sSpread * rand();
    return;
  }
  if (mood === 2) {
    const c = WHIP.content;
    st.goal = (st.goal > 0.05 ? -0.3 : 1) * (c.at + c.atSpread * rand());
    st.omega = c.omega;
    st.curlGoal = c.curl;
    st.waGoal = WHIP.wave.amp.content;
    st.next = st.t + c.s + c.sSpread * rand();
    return;
  }
  const r = rand();
  st.waGoal = WHIP.wave.amp.calm;
  if (r < WHIP.flick.chance) {
    // A flick out, then back to where it was going.
    const f = WHIP.flick;
    st.back = st.t + f.hold;
    st.backGoal = st.goal;
    st.backOmega = f.back;
    st.goal = f.to * (rand() < 0.75 ? 1 : -0.6);
    st.omega = f.omega;
    st.next = st.t + 1 + rand() * 1.4;
  } else if (r < WHIP.flick.chance + WHIP.tipFlick.chance) {
    // Just the tip, flicked; the rest keeps swaying.
    st.twV += (rand() < 0.5 ? -1 : 1) * WHIP.twitchKick * WHIP.tipFlick.kick;
    st.next = st.t + 0.6 + rand() * 1.2;
  } else if (r < WHIP.flick.chance + WHIP.tipFlick.chance + WHIP.rest.chance) {
    const w = WHIP.rest;
    st.goal = w.at + w.atSpread * rand();
    st.omega = w.omega;
    st.curlGoal = w.curl;
    st.waGoal = WHIP.wave.amp.calm * w.wave;
    st.next = st.t + w.s + w.sSpread * rand();
  } else {
    // A sway the other way: out (away from the body) further than in.
    const w = WHIP.swish;
    st.goal = st.goal > 0.2 ? w.in - w.inSpread * rand() : w.out + w.outSpread * rand();
    st.omega = w.omega + w.omegaSpread * rand();
    st.curlGoal = w.curl;
    st.next = st.t + w.s + w.sSpread * rand();
  }
}

/** The wave's drift (a multiplier near 1) at `t` s, from WHIP.wave.drift, offset by `k`. */
function drift(t: number, k: number) {
  "worklet";
  let d = 1;
  const list = WHIP.wave.drift;
  for (let i = 0; i < list.length; i++) d += list[i][1] * Math.sin(t * list[i][0] + k * (i + 1) * 1.7);
  return d;
}

/**
 * The tail `dt` seconds on (on the UI thread, each frame): its moves picked as
 * they fall due, then its springs run in small steps. A new state; and the
 * joints' turns (radians) for tailBends.
 */
export function stepTail(from: TailState, mood: TailMood, dt: number, rand: () => number): { state: TailState; joints: number[] } {
  "worklet";
  const st: TailState = { ...from, th: from.th.slice(), v: from.v.slice() };
  const n = WHIP.joints.length;
  const steps = Math.max(1, Math.ceil(Math.min(0.1, dt) / WHIP.step));
  const h = Math.min(0.1, dt) / steps;
  const swing = WHIP.swing * RADIANS, hook = WHIP.hook * RADIANS, wswing = WHIP.wave.swing * RADIANS;
  const W = WHIP.wave;
  const hz = mood === 1 ? W.hz.cross : mood === 2 ? W.hz.content : W.hz.calm;
  if (st.mood !== mood) {
    st.mood = mood;
    st.next = st.t;
    st.back = -1;
  }
  for (let k = 0; k < steps; k++) {
    st.t += h;
    if (st.back >= 0 && st.t >= st.back) {
      st.goal = st.backGoal;
      st.omega = st.backOmega;
      st.back = -1;
    }
    if (st.t >= st.next) nextMove(st, mood, rand);
    if (st.t >= st.twitchAt) {
      const [every, spread] = mood === 1 ? WHIP.twitches.cross : mood === 2 ? WHIP.twitches.content : WHIP.twitches.calm;
      st.twV += (rand() < 0.5 ? -1 : 1) * WHIP.twitchKick * (mood === 2 ? 0.5 : 1);
      st.twitchAt = st.t + every + spread * rand();
    }
    // The sweep and the curl ease to their goals (critically damped); the twitch rings and dies away.
    st.sweepV += (st.omega * st.omega * (st.goal - st.sweep) - 2 * st.omega * st.sweepV) * h;
    st.sweep += st.sweepV * h;
    const co = WHIP.curlOmega;
    st.curlV += (co * co * (st.curlGoal - st.curl) - 2 * co * st.curlV) * h;
    st.curl += st.curlV * h;
    const to = WHIP.twitchOmega;
    st.twV += (-to * to * st.tw - 2 * WHIP.twitchZeta * to * st.twV) * h;
    st.tw += st.twV * h;
    // The wave rolls on, its speed and size drifting; its size eases to the mood's.
    st.ph += Math.PI * 2 * hz * drift(st.t, 0) * h;
    st.wa += (st.waGoal - st.wa) * Math.min(1, W.omega * h);
    const size = st.wa * drift(st.t, 1);
    // Each joint follows the one below it, bent by its muscles' share (semi-implicit Euler).
    let below = 0;
    for (let j = 0; j < n; j++) {
      const w = WHIP.omega[j];
      const wave = size * W.share[j] * wswing * Math.sin(st.ph - W.lag * WHIP.joints[j]);
      const target = below + st.sweep * WHIP.sweep[j] * swing + st.curl * WHIP.curl[j] * hook + wave;
      st.v[j] += (w * w * (target - st.th[j]) - 2 * WHIP.zeta[j] * w * st.v[j]) * h;
      st.th[j] += st.v[j] * h;
      below = st.th[j];
    }
  }
  const joints: number[] = [];
  for (let j = 0; j < n; j++) joints.push(st.th[j] + st.tw * WHIP.twitch[j]);
  return { state: st, joints };
}
