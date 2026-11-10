import { cover, filler, foldAt, foldProgress, hatch, HOLD_AT, handLayout, progressFor, READ_AT, REACH, revealOf, samplesOf, setHand, splitCard, symbolWidth } from "../revealText";

test("the page warms as it's dragged up to the bulb, and a note reflects as it's dragged down to the mirror", () => {
  expect(progressFor("heat", -REACH)).toBe(1);
  expect(progressFor("heat", -REACH / 2)).toBeCloseTo(0.5);
  expect(progressFor("heat", 40)).toBe(0);           // away from the bulb: no warmth
  expect(progressFor("mirror", REACH * 2)).toBe(1);
  expect(progressFor("mirror", -30)).toBe(0);
  expect(HOLD_AT).toBeLessThan(1);
});

test("a card splits into its narration and what is written", () => {
  expect(splitCard("Held to the warm bulb, brown letters creep up: ▲ 4.")).toEqual({ lead: "Held to the warm bulb, brown letters creep up:", writing: "▲ 4." });
  expect(splitCard("In the glass the letters come right:\nNever the first: what holds the light.")).toEqual({
    lead: "In the glass the letters come right:", writing: "Never the first: what holds the light.",
  });
  expect(splitCard("Departure 7:40 sharp")).toEqual({ lead: "", writing: "Departure 7:40 sharp" });
});

test("only a card that reads with a tool opens the reveal", () => {
  const def = { cards: [{ id: "c1", reveal: "heat" as const }, { id: "c2" }] };
  expect(revealOf(def, { effects: [{ do: "show_card", card: "c2", title: "Note", text: "x" }] })).toBeNull();
  expect(revealOf(def, { effects: [{ do: "beat" }, { do: "show_card", card: "c1", title: "Lemon-juice letter", text: "Brown: ▲ 4." }] }))
    .toEqual({ kind: "heat", title: "Lemon-juice letter", text: "Brown: ▲ 4." });
  expect(revealOf(def, null)).toBeNull();
});

test("the writing comes up in a hand: nearest the heat first, every word read before the hold", () => {
  const lines = handLayout("Never the last: what slides out of the dark.\nNever the first: what lies flat on the floor.", "m");
  expect(lines).toHaveLength(2);
  expect(lines.flat().map((w) => w.word).join(" ")).toBe("Never the last: what slides out of the dark. Never the first: what lies flat on the floor.");
  for (const w of lines.flat()) {
    expect(w.at).toBeGreaterThanOrEqual(0);
    expect(w.at + 0.42).toBeLessThan(HOLD_AT + 0.15);
    expect(w.depth).toBeGreaterThanOrEqual(0.7);
  }
  const avg = (ws: { at: number }[]) => ws.reduce((s, w) => s + w.at, 0) / ws.length;
  expect(avg(lines[0])).toBeLessThan(avg(lines[1]));   // the top line, nearer the bulb, browns first
  expect(handLayout("▲ 4.", "h")[0].map((w) => w.word)).toEqual(["▲", " ", "4", "."]);
  expect(handLayout("▲ 4.", "h")).toEqual(handLayout("▲ 4.", "h"));
});

test("writing sets onto a drawn page: wrapped by the face's measure, centred or flush left, symbols drawn", () => {
  const measure = (w: string) => w.length * 10;
  const long = setHand(handLayout("Never the last: what slides out of the dark.\nNever the first.", "s"), 20, 200, measure);
  expect(long.rows).toBeGreaterThan(2);                       // the first line wraps
  expect(long.height).toBe(long.rows * long.lineHeight);
  for (const p of long.words) expect(p.x + p.w).toBeLessThanOrEqual(200);
  expect(long.words.map((p) => p.word).join(" ")).toBe("Never the last: what slides out of the dark. Never the first.");
  const short = setHand(handLayout("▲ 4.", "s"), 46, 200, measure, "center");
  expect(short.words.map((p) => p.word)).toEqual(["▲", "4", "."]);
  expect(short.words[0].symbol).toBe(true);
  expect(short.words[0].w).toBe(symbolWidth(46));
  const [first, last] = [short.words[0], short.words[2]];
  expect(first.x).toBeCloseTo(200 - (last.x + last.w));      // centred: the same margin either side
});

test("a rubbing or a lens counts as read once most of the writing has been gone over", () => {
  const set = setHand(handLayout("Bring the key. Tell no one.", "s"), 20, 400, (w) => w.length * 10);
  const samples = samplesOf(set, 20, 30, 40);
  const covered = new Array(samples.length / 2).fill(0);
  expect(cover(samples, covered, -500, -500, 20)).toBe(0);
  let share = 0;
  for (let i = 0; i < samples.length / 4; i++) share = cover(samples, covered, samples[i * 2], samples[i * 2 + 1], 4);
  expect(share).toBeGreaterThan(0.3);
  expect(share).toBeLessThan(READ_AT);                        // half gone over: not read yet
  for (let i = 0; i < samples.length / 2; i++) share = cover(samples, covered, samples[i * 2], samples[i * 2 + 1], 4);
  expect(share).toBe(1);
  const h = hatch(0, 0, 100, 60);
  expect(h.length % 2).toBe(0);
  expect(Math.max(...h.filter((_, i) => i % 2 === 1))).toBeGreaterThanOrEqual(60);   // down the whole box
});

test("the fold-in's middle pleats away until its two strips meet", () => {
  const flat = foldAt(100, 80, 0);
  expect(flat.right).toBe(180);
  expect(flat.shade).toBe(0);
  const home = foldAt(100, 80, 1);
  expect(home.right).toBe(100);                               // the right strip's edge on the left strip's
  expect(home.shift).toBe(40);                                // and the narrower page still centred
  const half = foldAt(100, 80, 0.5);
  expect(half.valley).toBe(120);
  expect(half.shade).toBeGreaterThan(0.8);                    // the pleat's shadow deep as it leans
  expect(foldProgress(-40, 80)).toBe(0.5);
  expect(foldProgress(30, 80)).toBe(0);                       // dragged the wrong way: nothing
  expect(foldProgress(-200, 80)).toBe(1);
  expect(filler("x", 0)).toBe(filler("x", 0));
  expect(filler("x", 0)).not.toBe(filler("x", 1));
});
