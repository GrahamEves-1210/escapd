import { useEffect, useState } from "react";

/**
 * True once `active` has stayed true for `delay` ms; false again as soon as it
 * turns false. For "show a loading indicator only if the wait runs past ~1 s"
 * (02, 03 and 04), so a fast wait shows nothing and nothing flickers. The
 * delay comes from the screen's ref.layout block (no shared token holds it).
 */
export function useShowAfter(active: boolean, delay: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setElapsed(true), delay);
    return () => {
      clearTimeout(id);
      setElapsed(false);
    };
  }, [active, delay]);
  return active && elapsed;
}
