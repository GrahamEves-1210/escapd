// The letters' hand-made maths (src/play2/letters/paper.ts): the same seed
// cuts the same sheet, edges stay inside their box, the typist's slip is a
// word already in the text, and a headline never ends on a lone word.
import { EDGE, edgePath, foxing, hang, inkWords, keepTogether, rng, splitHead, strikeover, wander } from "../letters/paper";

describe("the letters' paper", () => {
  it("is the same sheet for the same seed, another for another", () => {
    expect(edgePath(300, 400, "deckle", "a")).toBe(edgePath(300, 400, "deckle", "a"));
    expect(edgePath(300, 400, "deckle", "a")).not.toBe(edgePath(300, 400, "deckle", "b"));
    const r = rng("x");
    for (let i = 0; i < 50; i++) expect(r()).toBeGreaterThanOrEqual(0);
  });

  it("wanders in from its box, never out, and no further than its kind of edge", () => {
    for (const edge of ["clean", "deckle", "torn"] as const) {
      const offs = wander(80, edge, rng(edge));
      expect(Math.min(...offs)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...offs)).toBeLessThanOrEqual(EDGE[edge].depth);
    }
    const pts = edgePath(200, 100, "torn", "t").replace(/[MLZ]/g, " ").trim().split(/\s+/).map(Number);
    for (let i = 0; i < pts.length; i += 2) {
      expect(pts[i]).toBeGreaterThanOrEqual(0);
      expect(pts[i]).toBeLessThanOrEqual(200);
      expect(pts[i + 1]).toBeGreaterThanOrEqual(0);
      expect(pts[i + 1]).toBeLessThanOrEqual(100);
    }
    expect(foxing(200, 100, 12, "f")).toHaveLength(12);
  });
});

describe("the typewriter", () => {
  const text = "Somebody shut the door behind you and left the combination in this room, in pieces.";

  it("keeps every word and space of the text, each with its ink", () => {
    const words = inkWords(text, "s");
    expect(words.map((w) => w.word).join("")).toBe(text);
    for (const w of words) expect(w.ink).toBeGreaterThanOrEqual(0.74);
  });

  it("slips on a word that's in the text, its letters swapped, the same slip for the same case", () => {
    const slip = strikeover(text, "s")!;
    const words = inkWords(text, "s");
    expect(slip).not.toBeNull();
    expect(slip.typo).not.toBe(words[slip.index].word);
    expect([...slip.typo].sort().join("")).toBe([...words[slip.index].word].sort().join(""));
    expect(strikeover(text, "s")).toEqual(slip);
    expect(strikeover("A b c.", "s")).toBeNull();
  });
});

describe("the type's details", () => {
  it("holds a headline's last two words together, hangs an opening quote, splits a running head", () => {
    expect(keepTogether("Out into the night.")).toBe("Out into the night.");
    expect(keepTogether("You walk out.")).toBe("You walk out.");
    expect(keepTogether("Two words")).toBe("Two words");
    expect(hang("“Hello,” she said.")).toEqual(["“", "Hello,” she said."]);
    expect(hang("Hello.")).toEqual(["", "Hello."]);
    expect(splitHead("A Moonlit Mystery · Case no. 7413")).toEqual(["A Moonlit Mystery", "Case no. 7413"]);
    expect(splitHead("A Moonlit Mystery")).toEqual(["A Moonlit Mystery", ""]);
  });
});
