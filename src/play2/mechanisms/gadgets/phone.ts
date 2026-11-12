// The rotary dial's geometry and its arithmetic. Angles are degrees clockwise from twelve.
export const PHONE = {
  /** The radius of the circle the holes are on (points; gadget_phone.py HOLES). */
  holes: 51,
  /** Where a hole comes to rest against the finger stop. */
  stopAt: 113,
  /** Within this of the stop counts as reaching it (degrees). */
  slack: 9,
  /** The wheel's run home: ten pulses a second, a pulse every 30 degrees. */
  pace: 300,
  /** Let go short of the stop it slips back, quicker (degrees a second). */
  slip: 620,
  /** Wound by a tap, not a finger (degrees a second). */
  wind: 420,
} as const;

/** Where digit d's hole rests: 1 at two o'clock, round anticlockwise to 9 at six and 0 at five. */
export const holeAngle = (d: number) => {
  "worklet";
  return (((90 - 30 * (d === 0 ? 10 : d)) % 360) + 360) % 360;
};

/** How far digit d's hole goes round to reach the stop (degrees): 1 the least, 0 the most. */
export const travelOf = (d: number) => {
  "worklet";
  return (((PHONE.stopAt - (90 - 30 * (d === 0 ? 10 : d))) % 360) + 360) % 360;
};

/** The pulses digit d sends as the wheel runs home: its clicks. */
export const pulsesOf = (d: number) => (d === 0 ? 10 : d);

/** One more digit dialled: what is dialled so far, and the whole number once it has `length` digits (the next digit starts a new one). */
export function digitsToSend(soFar: string, d: number, length: number): { digits: string; send: string | null } {
  const next = (soFar.length >= length ? "" : soFar) + String(d);
  return next.length >= length ? { digits: "", send: next } : { digits: next, send: null };
}
