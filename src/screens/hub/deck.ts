// Home's deck of mode cards (docs/DESIGN.md, 01 · Layout): how tall each card
// is and how far each one lies over the card above it. Pure: no React.
import { ref } from "@/theme/tokens";
import { CAT, DECK, RADIANS } from "./art/nook";

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
 * of the one above; when that leaves less than the words plus home's
 * DECK.peek uncovered (large text, a short screen) the cards grow instead, keeping the
 * same share covered, and the deck scrolls. Never under `minHeight`. Whole points.
 */
export function deckLayout(available: number, words: number, count: number): DeckLayout {
  const exposedShare = 1 - D.cover;
  const fill = available / (1 + (count - 1) * exposedShare);
  const needed = (words + DECK.peek) / exposedShare;
  const card = Math.max(Math.floor(fill), Math.ceil(needed), M.minHeight);
  // Rounding never takes a point from the words' room.
  const overlap = Math.min(Math.round(card * D.cover), card - Math.ceil(words + DECK.peek));
  return { card, overlap, height: card + (count - 1) * (card - overlap) };
}

/** A card's tilt in degrees, by its place in the deck. */
export function deckTilt(index: number): number {
  return D.tilt[index % D.tilt.length];
}

/** How far the turned cards reach below their unturned box: half the card's width times the steepest tilt's sine. */
export function tiltOverhang(cardWidth: number): number {
  const steepest = Math.max(...D.tilt.map(Math.abs));
  return Math.ceil((cardWidth / 2) * Math.sin(steepest * RADIANS));
}

export interface HomeDeck {
  deck: DeckLayout;
  /** Whether the deck fits the column (else it scrolls). */
  fits: boolean;
  /** The deck's foot on screen, its turned cards included. */
  bottom: number;
  /** The sill cat's width, 0 when it's left out. */
  cat: number;
}

/**
 * Home's deck and the cat on the sill under it. The deck (its top `top` on
 * screen, `room` the most it may take, cards `cardWidth` wide) stops short of
 * the room the cat needs at its full CAT.width, sitting on the sill (its top
 * `sillTop` on screen); when the words need taller cards than that leaves,
 * the cards win and the cat shrinks into what's left, or is left out under
 * CAT.minWidth (or when the deck scrolls). Never touching: the deck, its
 * turned corners and CAT.gap all lie above the cat. Pure.
 */
export function homeDeck({ room, top, sillTop, cardWidth, words, count }: { room: number; top: number; sillTop: number; cardWidth: number; words: number; count: number }): HomeDeck {
  const overhang = tiltOverhang(cardWidth);
  const feet = sillTop + CAT.sink;
  const catTop = feet - CAT.width * CAT.aspect;
  const deck = deckLayout(Math.max(0, Math.min(room, catTop - CAT.gap - overhang - top)), words, count);
  const fits = deck.height <= room;
  const bottom = top + deck.height + overhang;
  const cat = Math.floor(Math.min(CAT.width, (feet - bottom - CAT.gap) / CAT.aspect));
  return { deck, fits, bottom, cat: fits && cat >= CAT.minWidth ? cat : 0 };
}
