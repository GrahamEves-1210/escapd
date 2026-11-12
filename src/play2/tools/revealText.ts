// The reveal tools' text and gesture arithmetic (pure: tested without a renderer).
import type { Reveal as SharedReveal } from "@/engine/v2";

/** How a card's writing comes to light: the shared core's kinds (heat, mirror, rub, lens, fold), so the two can't drift. */
export type RevealKind = SharedReveal;

/** How far (points) the page travels to reach the warmth or the glass. */
export const REACH = 150;
/** Past this much of the way it holds: the writing stays. */
export const HOLD_AT = 0.85;

/** What a drag of `dy` points (down positive) does to the reveal (0..1), for a tool: heat goes up to the bulb, mirror down to the glass. */
export function progressFor(kind: RevealKind, dy: number): number {
  "worklet";
  const toward = kind === "heat" ? -dy : dy;
  return Math.min(1, Math.max(0, toward / REACH));
}

/**
 * What is written on a card that reads with a tool: all of it. The card holds only the writing itself (never a
 * line of narration before it), so nothing is split off at a colon ("Never the first: what lies flat on the
 * floor." is one line of writing) and nothing is captioned under the page.
 */
export function writingOf(text: string): string {
  return text.trim();
}

/** The card a result showed that reads with a tool (warmed, in a mirror), as the sheet opens it; else null. */
export function revealOf(
  def: { cards: { id: string; reveal?: RevealKind }[] } | null | undefined,
  result: { effects: { do: string; card?: string; title?: string; text?: string }[] } | null,
): { kind: RevealKind; title: string; text: string } | null {
  for (const e of result?.effects ?? []) {
    if (e.do !== "show_card" || !e.card) continue;
    const kind = def?.cards.find((c) => c.id === e.card)?.reveal;
    if (kind) return { kind, title: e.title ?? "", text: e.text ?? "" };
  }
  return null;
}

/** One word (or, in a short note, one character) as a hand set it down, and when the heat finds it. */
export interface HandWord {
  word: string;
  /** Degrees: the pen's tilt for this word. */
  rot: number;
  /** Points: how far it sits off the line. */
  dy: number;
  /** The reveal (0..1) at which it starts to brown: nearest the heat (the top, the middle) first. */
  at: number;
  /** How dark it scorches in the end (0.7..1): the top lines, nearest the bulb, the darkest. */
  depth: number;
}

/** A short note (a digit, a symbol, a word or two) is written large, character by character. */
export const isShort = (text: string) => text.trim().length <= 12;

/** A small seeded generator (mulberry32) in [0, 1). */
function seeded(seed: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The writing as lines of words in a hand: each word tilted and lifted a little its own way, and
 * (for lemon juice) when it browns and how dark. A short note goes character by character, so even
 * "▲ 4." comes up unevenly. The same text and seed, the same hand.
 */
export function handLayout(text: string, seed: string): HandWord[][] {
  const r = seeded(seed);
  const short = isShort(text);
  const lines = text.trim().split(/\n+/).map((l) => (short ? Array.from(l.replace(/\s+/g, " ")) : l.split(/\s+/)).filter((w) => w.length > 0));
  const n = Math.max(1, lines.length);
  return lines.map((words, li) => words.map((word, wi) => {
    const fromTop = n === 1 ? 0 : li / (n - 1);
    const fromMiddle = words.length < 2 ? 0 : Math.abs(wi / (words.length - 1) - 0.5) * 2;
    return {
      word,
      rot: (r() - 0.5) * (short ? 9 : 4.5),
      dy: (r() - 0.5) * (short ? 5 : 3),
      at: Math.min(0.55, 0.03 + fromTop * 0.26 + fromMiddle * 0.14 + r() * 0.12),
      depth: Math.max(0.7, Math.min(1, 1 - fromTop * 0.16 - r() * 0.14)),
    };
  }));
}

/**
 * The door's wheel symbols, drawn by hand (the hand face has none of its own): a 24-point box each,
 * the outline a little off true, as a pen would fill it in.
 */
export const SYMBOL: Record<string, string> = {
  "▲": "M12.3 3.2 C15.4 8.6 18.6 14.4 21.4 20.2 C15.4 20.9 8.6 20.4 2.8 20.8 C5.8 14.8 9 8.8 12.3 3.2 Z",
  "●": "M12 3.4 C17.2 3.1 20.9 7.2 20.7 12.3 C20.5 17.4 16.6 21 11.6 20.7 C6.7 20.5 3.1 16.7 3.3 11.8 C3.5 7 7.1 3.6 12 3.4 Z",
  "◆": "M12.1 2.6 C15 5.8 18 9 21 12.1 C18 15.3 14.9 18.5 11.8 21.5 C8.9 18.3 5.9 15.1 3 11.9 C6 8.8 9.1 5.7 12.1 2.6 Z",
  "■": "M4.2 4.5 C9.4 3.9 14.8 4.3 19.9 4 C20.3 9.4 19.9 14.7 20.2 19.9 C14.9 20.4 9.3 19.8 3.9 20.2 C4.3 15 3.7 9.7 4.2 4.5 Z",
  "★": "M12 2.8 L14.6 9.2 L21.3 9.5 L16.1 13.8 L17.9 20.6 L12.1 16.8 L6.2 20.7 L8 13.9 L2.8 9.6 L9.5 9.1 Z",
  "✚": "M9.4 3.2 C11.1 3 12.9 3.1 14.6 3.2 L14.5 9.4 L20.8 9.5 C21 11.2 20.9 12.9 20.8 14.6 L14.6 14.5 L14.7 20.8 C12.9 21 11.1 20.9 9.4 20.8 L9.5 14.6 L3.2 14.7 C3 12.9 3.1 11.1 3.2 9.4 L9.5 9.5 Z",
};

/** A short line (a digit, a symbol) is written large, as a person would; a note at a reading size. */
export const sizeFor = (text: string) => (isShort(text) ? 46 : text.length > 70 ? 20 : 22);

// ---- Writing set on a drawn page (the pencil rubbing, the red-lens card, the fold-in) ----------------

/** A word where it sits on the page: its left edge, its baseline, its width, its tilt. */
export interface Placed {
  word: string;
  x: number;
  /** The baseline. */
  y: number;
  w: number;
  /** Degrees. */
  rot: number;
  /** A wheel symbol, drawn (SYMBOL) rather than set in the face. */
  symbol: boolean;
  /** Which set line it landed on (after wrapping). */
  row: number;
}

export interface Setting {
  words: Placed[];
  width: number;
  height: number;
  lineHeight: number;
  rows: number;
}

/** How wide a drawn wheel symbol sits, for writing of `size`. */
export const symbolWidth = (size: number) => size * 0.74;

/**
 * A hand layout set into a column `width` wide, by a face's own measure: words wrap as a line fills,
 * each row flush left or centred. The first baseline is one size down from the top; rows are 1.32
 * sizes apart (as the paper sheets set it).
 */
export function setHand(lines: HandWord[][], size: number, width: number, measure: (word: string) => number, align: "left" | "center" = "left"): Setting {
  const lineHeight = Math.round(size * 1.32);
  const short = isShort(lines.map((ws) => ws.map((w) => w.word).join("")).join(" "));
  const gap = short ? 0 : size * 0.28;
  const rows: Placed[][] = [];
  for (const ws of lines) {
    let row: Placed[] = [];
    let x = 0;
    for (const hw of ws) {
      const symbol = SYMBOL[hw.word] !== undefined;
      const w = hw.word === " " ? size * 0.3 : symbol ? symbolWidth(size) : measure(hw.word);
      if (x > 0 && x + w > width) {
        rows.push(row);
        row = [];
        x = 0;
      }
      // A space set down as a gap (a short note goes character by character).
      if (hw.word !== " ") row.push({ word: hw.word, x, y: hw.dy, w, rot: hw.rot, symbol, row: 0 });
      x += w + gap;
    }
    rows.push(row);
  }
  const words: Placed[] = [];
  rows.forEach((row, ri) => {
    const last = row[row.length - 1];
    const used = last ? last.x + last.w : 0;
    const shift = align === "center" ? (width - used) / 2 : 0;
    for (const p of row) words.push({ ...p, x: p.x + shift, y: size + ri * lineHeight + p.y, row: ri });
  });
  return { words, width, height: rows.length * lineHeight, lineHeight, rows: rows.length };
}

/**
 * Points along the writing (flat: x0, y0, x1, y1, ...), through the middle of its letters, about
 * `step` apart: what a pencil has to shade over, or a lens pass over, for it to count as read.
 */
export function samplesOf(setting: Setting, size: number, dx = 0, dy = 0, step = 12): number[] {
  const out: number[] = [];
  for (const p of setting.words) {
    const n = Math.max(1, Math.round(p.w / step));
    for (let i = 0; i < n; i++) out.push(dx + p.x + (p.w * (i + 0.5)) / n, dy + p.y - size * 0.3);
  }
  return out;
}

/** Marks every sample within `r` of (x, y) as covered (in `covered`, one flag a sample); the share covered so far. */
export function cover(samples: readonly number[], covered: number[], x: number, y: number, r: number): number {
  "worklet";
  const n = samples.length / 2;
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (!covered[i]) {
      const ax = samples[i * 2] - x;
      const ay = samples[i * 2 + 1] - y;
      if (ax * ax + ay * ay <= r * r) covered[i] = 1;
    }
    if (covered[i]) got++;
  }
  return n === 0 ? 1 : got / n;
}

/** Enough of the writing shaded over, or passed under the lens, for it to count as read. */
export const READ_AT = 0.8;

/** A pencil's back-and-forth over a box (flat points), for the rubbing done at once (reduced motion, a screen reader). */
export function hatch(x0: number, y0: number, x1: number, y1: number, pitch = 16): number[] {
  const out: number[] = [];
  let left = true;
  for (let y = y0; y <= y1 + pitch / 2; y += pitch) {
    out.push(left ? x0 : x1, y, left ? x1 : x0, y + pitch * 0.45);
    left = !left;
  }
  return out;
}

/**
 * The fold-in page: a left strip `a` wide, a middle `m` wide that pleats away, the right strip after it.
 * At fold `p` (0 flat .. 1 home) the middle shows `m * (1 - p)` wide in two leaning panels and the right
 * strip has come in by `m * p`; the page is narrower by as much, so it is nudged to stay centred.
 */
export function foldAt(a: number, m: number, p: number): { lean: number; valley: number; right: number; shift: number; shade: number } {
  "worklet";
  const lean = 1 - Math.min(1, Math.max(0, p));
  return {
    /** How wide each middle panel shows, as a share of its own width (the cosine of its lean). */
    lean,
    /** Where the pleat's valley lies. */
    valley: a + (m * lean) / 2,
    /** Where the right strip's left edge lies. */
    right: a + m * lean,
    shift: (m * (1 - lean)) / 2,
    /** How dark the pleat's shadow is (the sine of its lean). */
    shade: Math.sqrt(1 - lean * lean),
  };
}

/** How far a drag of `dx` points (leftward negative) has folded a middle `m` wide (0..1). */
export function foldProgress(dx: number, m: number): number {
  "worklet";
  return Math.min(1, Math.max(0, -dx / m));
}

/** Filler printed across the fold-in's middle: words that read on from nothing to nothing, the same for the same seed. */
export function filler(seed: string, row: number): string {
  const words = ["and", "the", "lamp", "by", "seven", "rain", "on", "a", "tin", "roof", "said", "nothing", "of", "it", "then", "left", "two", "cups", "cold", "under", "glass", "who", "kept", "time", "for", "her", "stair", "dust", "an", "old", "key", "in", "wax"];
  const r = seeded(`${seed}:fill:${row}`);
  return Array.from({ length: 9 }, () => words[Math.floor(r() * words.length)]).join(" ");
}
