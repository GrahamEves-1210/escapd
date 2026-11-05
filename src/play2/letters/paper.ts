// The letters' made-by-hand maths (Brief.tsx and Ending.tsx, src/play2/letters):
// everything that makes a sheet look cut, torn or deckled by hand rather than
// drawn by a computer, worked out once from a seed so the same case always
// gets the same sheet. Pure functions, no drawing: Paper.tsx and Marks.tsx draw.
//
// - rng(seed): a small seeded generator (mulberry32) from a string.
// - edgePath(w, h, edges, seed): the sheet's outline as an SVG path, each side
//   cut clean (a guillotine's faint wobble), deckled (the feathery,
//   wandering edge of handmade paper) or torn (a ragged rip with a fibrous lip).
// - inkWords(text, seed): the typed words, each struck a little harder or
//   softer, as a typewriter's keys strike (the ink's weight per word).
// - strikeover(text, seed): where the typist misspelled a word, x'd it out and
//   typed it again (only ever a word that is already in the text, so the
//   words a reader hears are the text's own).
// - keepTogether(text): the last two words joined with a no-break space, so a
//   headline never leaves one word alone on its last line.
// - hang(text): an opening quote hung into the margin (the left gutter), when
//   the text starts with one.

/** A seeded generator in [0, 1): the same seed, the same sheet. */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Edge = "clean" | "deckle" | "torn";
export type Edges = { top: Edge; right: Edge; bottom: Edge; left: Edge };
export const edgesOf = (e: Edge | Partial<Edges>, fallback: Edge = "clean"): Edges =>
  typeof e === "string" ? { top: e, right: e, bottom: e, left: e } : { top: fallback, right: fallback, bottom: fallback, left: fallback, ...e };

/** How far each kind of edge wanders in from the box (points), and how finely. */
export const EDGE = {
  clean: { depth: 0.6, step: 22 },
  deckle: { depth: 3.2, step: 3.5 },
  torn: { depth: 6, step: 5 },
} as const;

/**
 * One side's offsets inward from the box, at `n + 1` points along it: a
 * smooth wander (two slow waves) plus, for deckle and torn, a rough grain.
 * Never negative (the sheet stays inside its box) and never past `depth`.
 */
export function wander(n: number, edge: Edge, r: () => number): number[] {
  const { depth } = EDGE[edge];
  const p1 = r() * Math.PI * 2;
  const p2 = r() * Math.PI * 2;
  const f1 = 1 + r() * 2;
  const f2 = 4 + r() * 5;
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / Math.max(1, n);
    const slow = 0.5 + 0.3 * Math.sin(t * Math.PI * f1 + p1) + 0.2 * Math.sin(t * Math.PI * f2 + p2);
    const rough = edge === "clean" ? 0 : r();
    const v = edge === "clean" ? slow : edge === "deckle" ? 0.35 * slow + 0.65 * rough : 0.5 * slow + 0.5 * rough * rough;
    out.push(Math.max(0, Math.min(depth, v * depth)));
  }
  return out;
}

const f = (n: number) => Math.round(n * 10) / 10;

/** The sheet's outline in a `w` x `h` box, clockwise from the top left, as an SVG path. */
export function edgePath(w: number, h: number, edges: Edge | Partial<Edges>, seed: string): string {
  const e = edgesOf(edges);
  const r = rng(seed);
  const pts: string[] = [];
  const side = (edge: Edge, len: number, at: (s: number, off: number) => [number, number]) => {
    const n = Math.max(2, Math.round(len / EDGE[edge].step));
    const offs = wander(n, edge, r);
    // The corners stay on the box's corner (less the deeper side's wander), so the sides meet.
    for (let i = 0; i < n; i++) {
      const [x, y] = at((i / n) * len, offs[i]);
      pts.push(`${f(x)} ${f(y)}`);
    }
  };
  side(e.top, w, (s, o) => [s, o]);
  side(e.right, h, (s, o) => [w - o, s]);
  side(e.bottom, w, (s, o) => [w - s, h - o]);
  side(e.left, h, (s, o) => [o, h - s]);
  return `M${pts.join(" L")} Z`;
}

/** Spots of foxing (the brown freckles old paper grows): where, how big, how dark. */
export function foxing(w: number, h: number, count: number, seed: string): { x: number; y: number; r: number; a: number }[] {
  const r = rng(`${seed}:fox`);
  return Array.from({ length: count }, () => {
    // Mostly near the edges, where damp gets in.
    const nearEdge = r() < 0.7;
    const x = nearEdge && r() < 0.5 ? (r() < 0.5 ? r() * 0.14 : 1 - r() * 0.14) * w : r() * w;
    const y = nearEdge ? (r() < 0.5 ? r() * 0.18 : 1 - r() * 0.18) * h : r() * h;
    return { x, y, r: 0.8 + r() * r() * 5, a: 0.05 + r() * 0.12 };
  });
}

/** The typed words, each with its ink (0.74 to 1: how hard its keys struck). */
export function inkWords(text: string, seed: string): { word: string; ink: number }[] {
  const r = rng(`${seed}:ink`);
  return text.split(/(\s+)/).filter((w) => w.length > 0).map((word) => {
    if (/^\s+$/.test(word)) return { word, ink: 1 };
    // Mostly full; now and then a word struck light (a tired finger, a dry patch of ribbon).
    const x = r();
    return { word, ink: x < 0.16 ? 0.74 + r() * 0.1 : 0.9 + r() * 0.1 };
  });
}

/**
 * A typist's slip: the index (in inkWords' list) of a word she first
 * misspelled, and the misspelling she x'd out before typing it again. A word
 * of five or more plain letters in the text's second half, its middle two
 * letters swapped; null when the text has none.
 */
export function strikeover(text: string, seed: string): { index: number; typo: string } | null {
  const words = inkWords(text, seed);
  const r = rng(`${seed}:slip`);
  const candidates = words
    .map((w, i) => ({ ...w, i }))
    .filter((w) => w.i >= words.length * 0.35 && /^[a-z]{5,}$/.test(w.word));
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(r() * candidates.length)];
  const m = Math.floor(pick.word.length / 2) - 1;
  const chars = pick.word.split("");
  [chars[m], chars[m + 1]] = [chars[m + 1], chars[m]];
  const typo = chars.join("");
  return typo === pick.word ? null : { index: pick.i, typo };
}

/** The text with its last two words held together (a no-break space): no word left alone on a headline's last line. */
export function keepTogether(text: string): string {
  const t = text.trim();
  const at = t.lastIndexOf(" ");
  if (at <= 0 || t.slice(0, at).trim().indexOf(" ") < 0) return t;
  return `${t.slice(0, at)} ${t.slice(at + 1)}`;
}

/** An opening quote mark split off, to hang in the margin: [mark, rest]. */
export function hang(text: string): [string, string] {
  const m = /^["“‘']/.exec(text);
  return m ? [m[0], text.slice(1)] : ["", text];
}

/** A running head ("A Detective Noir Mystery · Case no. 2141") as its series line and its case number (or none). */
export function splitHead(head: string): [string, string] {
  const at = head.indexOf(" \u00b7 ");
  return at < 0 ? [head, ""] : [head.slice(0, at), head.slice(at + 3)];
}
