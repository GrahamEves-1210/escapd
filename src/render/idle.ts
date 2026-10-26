// The idle glint (GAME_FEEL_PROMPT.md, 4): when the player hasn't touched the
// screen for a while, the objects still to find catch a flashlight's glint
// once, then stop until the next idle spell. It never says more than the
// hotspot assist (Show interactives) already shows: only hotspots on the
// photo in view that are visible now (revealed), and only those not yet
// solved or tapped.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Hotspot, Id } from "@/lib/puzzle-types";

/**
 * The hotspots to glint: visible (`hotspots` is the view's visible set, as
 * HotspotLayer draws it), not solved, not tapped this visit. When every one
 * has been tapped, the unsolved ones (the check seal already marks the rest).
 */
export function glintTargets(hotspots: readonly Hotspot[], solved: ReadonlySet<Id>, tapped: ReadonlySet<Id>): Id[] {
  const open = hotspots.filter((h) => !solved.has(h.id));
  const fresh = open.filter((h) => !tapped.has(h.id));
  return (fresh.length ? fresh : open).map((h) => h.id);
}

/**
 * A key that changes once each time the screen has been idle for `ms`
 * (null while the player is active). `touch()` restarts the wait and ends a
 * glint; `enabled` false (a sheet is up, the case is closing) holds it off.
 * Touches only touch refs, so they never re-render the player; the key is
 * state only when it changes.
 */
export function useIdle(ms: number, enabled: boolean) {
  const [idleKey, setIdleKey] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      active.current = true;
      setIdleKey(Date.now());
    }, ms);
  }, [ms]);

  const touch = useCallback(() => {
    if (active.current) {
      active.current = false;
      setIdleKey(null);
    }
    if (enabled) arm();
  }, [enabled, arm]);

  useEffect(() => {
    if (!enabled) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (active.current) {
        active.current = false;
        setIdleKey(null);
      }
      return;
    }
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [enabled, arm]);

  return { idleKey, touch };
}
