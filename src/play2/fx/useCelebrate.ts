// The player's moments of discovery, celebrated: each find or solved step makes
// a burst of inked sparks at the thing on the photo (the Stage draws it, zoomed
// or not) or at a point on screen (a slot in the tray). No word is stamped over
// it: the sparks are the whole of it. A solved step's is bigger and lands with
// a thump; finds in quick succession put the player on a roll, which rings the
// rising celesta shimmer instead.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult, Rect as Box } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { useFeedback } from "@/game/feedback";
import { BURST } from "./Burst";
import { strengthOf, streakAfter, type Strength } from "./celebrate";

/** Where a moment happened: an object in the room, or a point on screen (the player's root points). */
export type Anchor = { object: string } | { x: number; y: number };

export interface BurstEvent {
  id: number;
  genre: Genre;
  strength: Strength;
  /** No longer set: nothing is stamped over a moment (kept so the Stage's burst still compiles). */
  word?: undefined;
  level: number;
  count: number;
  seed: number;
  /** On the photo: the object's box (photo fractions). */
  box?: Box;
  /** On screen: a point in root points. */
  point?: { x: number; y: number };
}

export interface Celebrate {
  /** The burst on the photo, if any (for the Stage). */
  stage: BurstEvent | null;
  /** The burst on screen, if any (over the tray). */
  screen: BurstEvent | null;
  /** A result's moment, if it had one, at `anchor`. In a close-up, items granted aren't counted (picking one up is). */
  result: (result: ActionResult | null, anchor: Anchor | null, opts?: { grants?: boolean }) => void;
  /** A find the player made by hand (an item picked up). */
  find: (anchor: Anchor | null) => void;
}

/** A solved step's thump lands as its sparks leave; the roll's shimmer just after. */
const SOUND_AT = { stamp: BURST.solve.thumpAt, roll: 200 } as const;

export function useCelebrate(genre: Genre | null, locate: (objectId: string) => Box | null): Celebrate {
  const feedback = useFeedback();
  const [stage, setStage] = useState<BurstEvent | null>(null);
  const [screen, setScreen] = useState<BurstEvent | null>(null);
  const times = useRef<number[]>([]);
  const next = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.current = timers.current.filter((x) => x !== t);
      fn();
    }, ms);
    timers.current.push(t);
  };
  const locateRef = useRef(locate);
  useEffect(() => {
    locateRef.current = locate;
  }, [locate]);

  const fire = useCallback((strength: Strength | null, anchor: Anchor | null) => {
    if (!strength || !genre) return;
    const now = Date.now();
    const roll = streakAfter(times.current, now);
    times.current = roll.times;
    const id = next.current++;
    const event: BurstEvent = { id, genre, strength, level: roll.level, count: roll.count, seed: (now ^ (id * 7919)) >>> 0 };
    const box = anchor && "object" in anchor ? locateRef.current(anchor.object) : null;
    const ms = BURST[strength].ms + roll.level * 120 + 150;
    if (box) {
      setStage({ ...event, box });
      later(ms, () => setStage((e) => (e?.id === id ? null : e)));
    } else if (anchor && "x" in anchor) {
      setScreen({ ...event, point: { x: anchor.x, y: anchor.y } });
      later(ms, () => setScreen((e) => (e?.id === id ? null : e)));
    }
    if (roll.level > 0) later(SOUND_AT.roll, feedback.solved);
    else if (strength === "solve") later(SOUND_AT.stamp, feedback.stamp);
  }, [genre, feedback]);

  const result = useCallback((r: ActionResult | null, anchor: Anchor | null, opts?: { grants?: boolean }) => {
    if (!r) return;
    const counted = opts?.grants === false ? { ...r, effects: r.effects.filter((e) => e.do !== "grant") } : r;
    fire(strengthOf(counted), anchor);
  }, [fire]);
  const find = useCallback((anchor: Anchor | null) => fire("find", anchor), [fire]);
  return { stage, screen, result, find };
}
