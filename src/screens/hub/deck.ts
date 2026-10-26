// Home's deck of mode cards (docs/DESIGN.md, 01 · Layout): how tall each card
// is and how far each one lies over the card above it. Pure: no React.
import { ref } from "@/theme/tokens";

const M = ref.layout.hub.modes;
const D = M.deck;

export interface DeckLayout {
  /** Every card's height. */
  card: number;
  /** How much of the card above each card (after the first) covers. */
  overlap: number;
  /** The deck's total height: one whole card and the uncovered part of the others. */
  height: number;
}

/**
 * The deck for a column `available` tall (the scroll view less its top and
 * foot padding) holding `count` cards whose tallest words block is `words`
 * (0 until measured). The cards fill the column, each covering `deck.cover`
 * of the one above; when that leaves less than the words plus `deck.peek`
 * uncovered (large text, a short screen) the cards grow instead, keeping the
 * same share covered, and the deck scrolls. Never under `minHeight`. Whole points.
 */
export function deckLayout(available: number, words: number, count: number): DeckLayout {
  const exposedShare = 1 - D.cover;
  const fill = available / (1 + (count - 1) * exposedShare);
  const needed = (words + D.peek) / exposedShare;
  const card = Math.floor(Math.max(fill, needed, M.minHeight));
  const overlap = Math.round(card * D.cover);
  return { card, overlap, height: card + (count - 1) * (card - overlap) };
}

/** A card's tilt in degrees, by its place in the deck. */
export function deckTilt(index: number): number {
  return D.tilt[index % D.tilt.length];
}
