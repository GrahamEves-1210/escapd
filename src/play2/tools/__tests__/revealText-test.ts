import { HOLD_AT, progressFor, REACH, revealOf, splitCard } from "../revealText";

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
