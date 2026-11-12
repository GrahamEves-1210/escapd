// Home's deck of mode cards (docs/DESIGN.md, 01 · Layout): how tall each card
// is and how far each one lies over the card above it. Home is one fixed
// screen: the deck never scrolls. It takes the room between the header and
// the cat on the sill, and when that is tight (a small phone, large text) the
// cards shrink and lie closer over each other before the cat gives up any of
// its size; the cat is never left out. Pure: no React.
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

/** The least a deck may be: every card's words with DECK.peekMin under them, the front card's with DECK.last. */
export function deckNeeds(words: number, count: number): number {
  return (count - 1) * Math.ceil(words + DECK.peekMin) + Math.ceil(words + DECK.last);
}

/**
 * The deck for `available` points of height holding `count` cards whose
 * tallest words block is `words` (0 until measured). Whole points; it is
 * never taller than `available`.
 * - Roomy: the cards fill it, each covering `deck.cover` of the one above,
 *   as long as that leaves each card's words and DECK.peek uncovered.
 * - Tight: each card keeps its words and what peek there is room for
 *   (DECK.peek down to DECK.peekMin) uncovered; the front card takes the rest.
 * - Under deckNeeds (the caller has nothing left to give): the cards share
 *   what there is, the lower ones lying over the foot of the words above.
 */
export function deckLayout(available: number, words: number, count: number): DeckLayout {
  const room = Math.max(0, Math.floor(available));
  const exposedShare = 1 - D.cover;
  const fill = Math.floor(room / (1 + (count - 1) * exposedShare));
  const roomy = fill - Math.round(fill * D.cover) >= words + DECK.peek;
  if (roomy || room < deckNeeds(words, count)) {
    const overlap = Math.round(fill * D.cover);
    return { card: fill, overlap, height: fill + (count - 1) * (fill - overlap) };
  }
  // The slack over the least is shared between every card's peek, up to DECK.peek.
  const slack = room - deckNeeds(words, count);
  const peek = Math.min(DECK.peek, DECK.peekMin + Math.floor(slack / count));
  const exposed = Math.ceil(words + peek);
  const card = room - (count - 1) * exposed;
  return { card, overlap: card - exposed, height: room };
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
  /** The deck's foot on screen, its turned cards included. */
  bottom: number;
  /** The sill cat's width: CAT.width where there's room, never under CAT.minWidth. */
  cat: number;
}

/**
 * Home's deck and the cat on the sill under it, on one fixed screen. The
 * deck (its top `top` on screen, cards `cardWidth` wide) ends above the cat,
 * sitting on the sill (its top `sillTop` on screen): never touching, the
 * deck, its turned corners and CAT.gap all lie above the cat's ears.
 * The cat keeps its full CAT.width while the deck has at least deckNeeds
 * above it; on a smaller screen (or with larger text) it shrinks to give the
 * deck that, down to CAT.minWidth, and past that the cards squeeze. Pure.
 */
export function homeDeck({ top, sillTop, cardWidth, words, count }: { top: number; sillTop: number; cardWidth: number; words: number; count: number }): HomeDeck {
  const overhang = tiltOverhang(cardWidth);
  const feet = sillTop + CAT.sink;
  // The deck's room above a cat `width` wide.
  const above = (width: number) => feet - width * CAT.aspect - CAT.gap - overhang - top;
  const needs = deckNeeds(words, count);
  const cat = above(CAT.width) >= needs ? CAT.width : Math.max(CAT.minWidth, Math.min(CAT.width, Math.floor((feet - CAT.gap - overhang - top - needs) / CAT.aspect)));
  const deck = deckLayout(above(cat), words, count);
  return { deck, bottom: top + deck.height + overhang, cat };
}
