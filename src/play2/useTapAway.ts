// A tap anywhere, watched without taking it from whatever it lands on (the
// photo's light, a button, the close-up's mechanism all still get it): for
// putting down the item selected in the hotbar, or trying it on what was
// tapped. Raw touches (and pointers, on the web) bubble up to the screen's root
// regardless of who handles them; a short touch that hardly moved is a tap.
// Inner places say what they are (`tapMark`: the room's photo, the object up
// close, something found in it) as the touch goes down through them: the
// innermost wins.
import { useCallback, useEffect, useRef } from "react";
import type { NativeTouchEvent } from "react-native";

/** A touch or a pointer event. */
type AnyEvent = { nativeEvent: object };

/** Where a touch went down: the room's photo, the object up close (its mechanism), something found in it. */
export type TapPlace = "room" | "object" | "found" | null;

/** A tap moves less than this (pt) and lasts less than this (ms). */
export const TAP = { slop: 10, ms: 450 } as const;
/** A mark counts for the touch that goes down within this long (ms) of it. */
const MARK_MS = 120;

// The place the touch going down now went through (one screen, one finger's tap at a time).
let mark: { place: TapPlace; at: number } | null = null;
const marks = new Map<TapPlace, { onTouchStart: () => void; onPointerDown: () => void }>();

/** An inner place's touch-down handlers (spread on its view): the innermost place a touch goes down through is the one it's on. */
export function tapMark(place: TapPlace) {
  let handlers = marks.get(place);
  if (!handlers) {
    const set = () => {
      if (mark && Date.now() - mark.at < MARK_MS) return;
      mark = { place, at: Date.now() };
    };
    handlers = { onTouchStart: set, onPointerDown: set };
    marks.set(place, handlers);
  }
  return handlers;
}

type Point = { pageX: number; pageY: number };
const pointOf = (e: AnyEvent): Point | null => {
  const n = e.nativeEvent as Partial<NativeTouchEvent> & Partial<Point>;
  const t = n.changedTouches?.[0] ?? n.touches?.[0];
  const p = t ?? n;
  return typeof p.pageX === "number" && typeof p.pageY === "number" ? { pageX: p.pageX, pageY: p.pageY } : null;
};

/**
 * The root's handlers (spread on the screen's root view): `onTap` gets each tap's place in window points and
 * where it went down.
 */
export function useTapAway(onTap: (x: number, y: number, place: TapPlace) => void) {
  const down = useRef<{ x: number; y: number; at: number; far: boolean; place: TapPlace } | null>(null);
  const tap = useRef(onTap);
  useEffect(() => {
    tap.current = onTap;
  });

  const start = useCallback((e: AnyEvent) => {
    // Touch and pointer events both come for one touch on some platforms: the first starts it.
    if (down.current) return;
    const p = pointOf(e);
    if (!p) return;
    const place = mark && Date.now() - mark.at < MARK_MS ? mark.place : null;
    down.current = { x: p.pageX, y: p.pageY, at: Date.now(), far: false, place };
  }, []);
  const move = useCallback((e: AnyEvent) => {
    const d = down.current;
    const p = pointOf(e);
    if (d && p && Math.hypot(p.pageX - d.x, p.pageY - d.y) > TAP.slop) d.far = true;
  }, []);
  // Ended, or cancelled (a gesture took the touch over: the light's tap, a mechanism): a tap, if it hardly moved.
  const end = useCallback((e: AnyEvent) => {
    const d = down.current;
    down.current = null;
    mark = null;
    if (!d || d.far || Date.now() - d.at > TAP.ms) return;
    const p = pointOf(e) ?? { pageX: d.x, pageY: d.y };
    if (Math.hypot(p.pageX - d.x, p.pageY - d.y) > TAP.slop) return;
    tap.current(d.x, d.y, d.place);
  }, []);

  return {
    onTouchStart: start, onTouchMove: move, onTouchEnd: end, onTouchCancel: end,
    onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end,
  };
}
