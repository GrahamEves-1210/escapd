// The reveal tools' text and gesture arithmetic (pure: tested without a renderer).
export type RevealKind = "heat" | "mirror";

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
 * A card's text as the narration ("Held to the warm bulb, brown letters creep up:") and what is written
 * (the values): the page shows only the writing, the narration is the caption once it's read.
 */
export function splitCard(text: string): { lead: string; writing: string } {
  const m = /:(\s)/.exec(text);
  if (!m) return { lead: "", writing: text };
  return { lead: text.slice(0, m.index + 1).trim(), writing: text.slice(m.index + 1).trim() };
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
