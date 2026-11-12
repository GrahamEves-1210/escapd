// The safe dial's works, as numbers: where the dial stands (whole ticks, turned right is up), which way
// it was last turned, and the numbers it has registered. Turning it back the other way registers the
// number it was turned back from (right to the first, left to the second); the last number is simply
// where it is left. A whole turn one way clears it, as on a real lock. Pure: SafeDial.tsx draws it.
export interface DialWorks {
  /** Whole ticks turned, unwrapped; turning right (clockwise) counts up. */
  pos: number;
  /** The way it was last turned: 1 right, -1 left, 0 not yet. */
  dir: -1 | 0 | 1;
  /** Ticks turned that way since it last changed. */
  run: number;
  /** The numbers registered so far (at most count - 1: the last is where it stands). */
  entered: number[];
}

export const DIAL_REST: DialWorks = { pos: 0, dir: 0, run: 0, entered: [] };

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** The number under the index: the dial's numbers run clockwise, so turning it right brings lower ones up. */
export const numberAt = (pos: number, size: number) => mod(-pos, size);

export interface DialTurn {
  works: DialWorks;
  /** Numbers registered on the way, in order. */
  registered: number[];
  /** A whole turn one way let go of what was registered. */
  cleared: boolean;
}

/** Turn the dial to `to` (whole ticks), a tick at a time. */
export function turnDial(works: DialWorks, to: number, size: number, count: number): DialTurn {
  let { pos, dir, run } = works;
  let entered = works.entered;
  const registered: number[] = [];
  let cleared = false;
  while (pos !== to) {
    const d = to > pos ? 1 : -1;
    if (dir !== 0 && d !== dir) {
      if (entered.length < count - 1) {
        const n = numberAt(pos, size);
        entered = [...entered, n];
        registered.push(n);
      }
      run = 0;
    }
    dir = d;
    pos += d;
    run += 1;
    if (run >= size && entered.length > 0) {
      entered = [];
      cleared = true;
      run = 0;
    }
  }
  return { works: { pos, dir, run, entered }, registered, cleared };
}

/** What the handle would try: the registered numbers and the one it stands on; null until all but the last are in. */
export function dialled(works: DialWorks, size: number, count: number): string[] | null {
  if (works.entered.length !== count - 1) return null;
  return [...works.entered, numberAt(works.pos, size)].map(String);
}

/** The works with slot `i` stepped by `delta` (a screen reader's way in): earlier numbers not yet set count as 0. */
export function stepNumber(works: DialWorks, i: number, delta: 1 | -1, size: number, count: number): DialWorks {
  const entered = Array.from({ length: count - 1 }, (_, k) => works.entered[k] ?? 0);
  if (i < count - 1) {
    entered[i] = mod(entered[i] + delta, size);
    return { ...works, entered };
  }
  // The last number is where the dial stands: one tick the other way round.
  return { pos: works.pos - delta, dir: delta > 0 ? -1 : 1, run: 0, entered };
}
