// What the player holds, for a gadget worked with other held things (the balance and its weights; a lock
// and the bar of soap a key was pressed into): the player (PlayerV2) provides it round the close-up, as it
// does the cipher's clues. None provided (a bench, a test): the balance takes everything it names as held.
import { createContext, useContext } from "react";

export interface HeldItem {
  id: string;
  name: string;
  /** What its card says, once read (a key's pressing: its cuts). */
  text?: string;
}

export const HeldContext = createContext<HeldItem[] | null>(null);
export const useHeld = () => useContext(HeldContext);

/** The symbol a weight is named by ("Brass weight ▲" -> "▲"): what is stamped on it. */
export function stampOf(name: string, fallback: string): string {
  const last = [...name.trim()].pop() ?? "";
  return /[A-Za-z0-9\s.]/.test(last) || !last ? fallback : last;
}

/** What two pans hold, as the engine takes it ("left|right"), once both do. */
export const pansValue = (left: string | null, right: string | null) => (left && right && left !== right ? `${left}|${right}` : null);

export type Tilt = -1 | 0 | 1;
/**
 * Which way the beam leans (-1: its left end down): one pan loaded, that side, by itself; both, whatever
 * the engine saw for exactly these two (state.tilt, the heavier side), and level until it has.
 */
export function leanOf(left: string | null, right: string | null, state: { pans?: unknown; tilt?: unknown }): Tilt | null {
  if (!left && !right) return 0;
  if (left && !right) return -1;
  if (right && !left) return 1;
  if (state.pans !== pansValue(left, right)) return null;
  return state.tilt === "left" ? -1 : state.tilt === "right" ? 1 : 0;
}
