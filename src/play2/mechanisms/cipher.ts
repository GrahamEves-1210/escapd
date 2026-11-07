// What the cipher wheel knows about the room's coded line, from what the player
// has found: the coded letters (off the card that carries them), whether the
// plain text is digits (a code) or letters, and, once the engine has shown the
// decoded note, the setting it was read at. The mechanism never knows an
// answer before the player has it: the coded line shows only once its card is
// found, and the "it reads" moment only after the engine has shown the note.
//
// The planner's cipher (planner.ts `encipher`) shifts each letter forward by
// the ring's offset and maps each digit d to the letter d + offset, so a ring
// set to +k reads a coded letter c as c - k: a letter, or for a code the digit
// 0..9 that letter's place on the plain ring stands for (A = 0 ... J = 9).
import { createContext, useContext } from "react";

export interface CipherClues {
  /** The coded line as the player found it ("HL MX"), or null before its card is found. */
  coded: string | null;
  /** Where it was found: the card's title ("Telegram"). */
  source: string | null;
  /** The plain text is digits (a code, a page, a time): A..J read as 0..9. */
  numeric: boolean;
  /** The decoded note has been shown: the ring setting it reads at (1..25), and the plain line. */
  solved: { offset: number; reads: string; note?: string } | null;
}

export const NO_CIPHER: CipherClues = { coded: null, source: null, numeric: false, solved: null };

/** The room's cipher, for the cipher wheel's close-up (PlayerV2 provides it). */
export const CipherContext = createContext<CipherClues>(NO_CIPHER);
export const useCipher = () => useContext(CipherContext);

const SLOT = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;
/** Slot kinds whose values are digits (with their own punctuation: "3:15", "94.7"). */
const NUMERIC = ["digits", "page", "time", "freq", "offset", "code"];

const kindOf = (slot: string) => slot.replace(/_\d+$/, "");

/** A card template's slot values, read back out of its rendered text (null when it doesn't fit). */
export function slotValues(template: string, text: string): Record<string, string> | null {
  const names: string[] = [];
  const parts = template.split(SLOT);
  // split with a capture group: literal, name, literal, name, ...
  const pattern = parts.map((p, i) => {
    if (i % 2) {
      names.push(p);
      return "(.+?)";
    }
    return p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  const m = new RegExp(`^${pattern}$`, "s").exec(text);
  if (!m) return null;
  return Object.fromEntries(names.map((n, i) => [n, m[i + 1]]));
}

const A = 65;
const isLetter = (c: string) => c >= "A" && c <= "Z";
const isDigit = (c: string) => c >= "0" && c <= "9";

/** One coded character read at ring setting `k`: a letter (or its digit, for a code); anything else as is. */
export function decodeChar(c: string, k: number, numeric: boolean): string {
  const u = c.toUpperCase();
  if (!isLetter(u)) return c;
  const i = (((u.charCodeAt(0) - A - k) % 26) + 26) % 26;
  return numeric && i < 10 ? String(i) : String.fromCharCode(A + i);
}

/** The coded line read at ring setting `k`. */
export const decode = (coded: string, k: number, numeric: boolean) => [...coded].map((c) => decodeChar(c, k, numeric)).join("");

/** The setting (1..25) that turns `coded` into `plain`, or null when none does. */
export function settingFor(coded: string, plain: string, numeric: boolean): number | null {
  const c = [...coded.toUpperCase()].find(isLetter);
  const p = [...plain.toUpperCase()].find((x) => isLetter(x) || isDigit(x));
  if (!c || !p) return null;
  const pi = isDigit(p) ? Number(p) : p.charCodeAt(0) - A;
  const k = (((c.charCodeAt(0) - A - pi) % 26) + 26) % 26;
  if (k === 0 || decode(coded, k, numeric).replace(/\s+/g, "") !== plain.toUpperCase().replace(/\s+/g, "")) return null;
  return k;
}

interface Card { id: string; title: string; text: string }

/**
 * The room's cipher as far as the player has found it. `cards` are the room's card templates (the
 * definition's, with {{slot}}s); `found` the cards the player has been shown (rendered).
 */
export function cipherClues(cards: readonly Card[], found: readonly Card[]): CipherClues {
  const seen = new Map(found.map((c) => [c.id, c]));
  // The coded card: the one whose template carries the cipher slot.
  let coded: string | null = null;
  let source: string | null = null;
  for (const card of cards) {
    const slot = [...card.text.matchAll(SLOT)].map((m) => m[1]).find((s) => kindOf(s) === "cipher");
    const shown = slot ? seen.get(card.id) : undefined;
    if (!slot || !shown) continue;
    const v = slotValues(card.text, shown.text)?.[slot];
    if (v) {
      coded = v.trim();
      source = shown.title;
      break;
    }
  }
  // The decoded note: what its slots are tells digits from letters; once shown, it says what the line reads.
  const decodedCard = cards.find((c) => /\bdecoded\b/i.test(c.title));
  const kinds = decodedCard ? [...decodedCard.text.matchAll(SLOT)].map((m) => kindOf(m[1])) : [];
  const numeric = kinds.length > 0 && kinds.every((k) => NUMERIC.includes(k));
  let solved: CipherClues["solved"] = null;
  const shownDecoded = decodedCard ? seen.get(decodedCard.id) : undefined;
  if (decodedCard && shownDecoded && coded) {
    const values = slotValues(decodedCard.text, shownDecoded.text);
    const plain = values ? Object.values(values).join(" ") : "";
    const offset = plain ? settingFor(coded, plain, numeric) : null;
    // The note's own words for it ("◆ 4": a code keeps the mark that says where it goes).
    const note = shownDecoded.text.split(":").pop()?.trim().replace(/\.$/, "");
    if (offset !== null) solved = { offset, reads: decode(coded, offset, numeric), ...(note ? { note } : {}) };
  }
  return { coded, source, numeric, solved };
}
