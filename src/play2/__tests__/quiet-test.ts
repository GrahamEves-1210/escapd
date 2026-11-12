// Show, never tell, for old rooms too (quiet.ts): a room stored before round
// 14 still sends beats and trace reports; the screen takes neither.
import type { Action, ActionResult, TraceSpec } from "@/engine/v2";
import { emptyLog } from "../journal/threads";
import { strengthOf } from "../fx/celebrate";
import { revealOf } from "../tools/revealText";
import { isOldTrace, OLD_REPORT_TITLES, quietResult, withoutTraceReports } from "../quiet";

const oldTrace = (kind: TraceSpec["kind"]): TraceSpec => ({ kind, surface: "floor", anchor: "rug", seed: 7 });
const newPrints: TraceSpec = { kind: "footprints", surface: "floor", anchor: "rug", seed: 7, size: "large", tread: "zigzag" };
const newWriting: TraceSpec = { kind: "writing", surface: "wall", anchor: "desk", seed: 9, hand: "block" };

const oldDef = {
  objects: [
    { id: "drawer" },
    { id: "trace_fp", trace: oldTrace("footprints") },
    { id: "trace_wr", trace: oldTrace("writing") },
  ],
  cards: [{ id: "c_report" }, { id: "c_note" }],
};
const newDef = { objects: [{ id: "drawer" }, { id: "trace_fp", trace: newPrints }, { id: "trace_wr", trace: newWriting }] };

/** An old room's answer to the UV light finding footprints: it glows, a beat says so. */
const oldLit: ActionResult = {
  outcome: "ok",
  effects: [
    { do: "overlay", object: "trace_fp", overlay: "glow_mark" },
    { do: "beat", text: "Footprints glow across the floor by the rug." },
  ],
};
/** An old room's answer to the magnifier on those footprints: its report card, a beat, the step solved. */
const oldRead: ActionResult = {
  outcome: "ok",
  effects: [
    { do: "show_card", card: "c_report", title: "Footprint report", text: "A man's boot, size eleven. Whoever stood here was no gardener: the tread is a city shoe's." },
    { do: "beat", text: "The lab's slip is short and sure of itself." },
    { do: "solved", step: "step_4" },
  ],
};
const light: Action = { type: "use_item", item: "uv", object: "trace_fp" };
const read: Action = { type: "inspect", object: "trace_fp" };

describe("an old room's result, kept quiet", () => {
  it("drops the beat: nothing narrates what the player just saw", () => {
    const quiet = quietResult(oldDef, light, oldLit)!;
    expect(quiet.effects).toEqual([{ do: "overlay", object: "trace_fp", overlay: "glow_mark" }]);
    expect(quiet.outcome).toBe("ok");
    // The same for a beat anywhere else (a drawer, the door).
    const drawer = quietResult(oldDef, { type: "set_control", target: "drawer", control: "open", value: true }, {
      outcome: "ok", effects: [{ do: "open", object: "drawer" }, { do: "beat", text: "The drawer slides out." }, { do: "grant", item: "key" }],
    })!;
    expect(drawer.effects.map((e) => e.do)).toEqual(["open", "grant"]);
  });

  it("never lets a trace's report card arrive: no card, so no burst, no sheet, no sound for it", () => {
    const quiet = quietResult(oldDef, read, oldRead)!;
    expect(quiet.effects).toEqual([{ do: "solved", step: "step_4" }]);
    expect(quiet.effects.some((e) => e.do === "show_card" || e.do === "beat")).toBe(false);
    // Lighting a trace is never a "find" to celebrate, old room or new.
    expect(strengthOf(quietResult(oldDef, light, oldLit))).toBeNull();
    expect(strengthOf(quietResult(newDef, { ...light, object: "trace_wr" }, {
      outcome: "ok",
      effects: [{ do: "overlay", object: "trace_wr", overlay: "glow_mark", text: "▲ 4" }, { do: "show_card", card: "c_w", title: "Writing on the wall", text: "▲ 4" }],
    }))).toBeNull();
    expect(revealOf(oldDef, quiet)).toBeNull();
  });

  it("a thing turning up never brings a note that only says what the thing is", () => {
    const def = { objects: [{ id: "rug" }], items: [{ id: "lens", card: "c_lens" }, { id: "key" }] };
    const lifted: ActionResult = {
      outcome: "ok",
      effects: [
        { do: "grant", item: "lens" },
        { do: "show_card", card: "c_lens", title: "Red lens", text: "A square of red gel in a cardboard frame, from a spy kit." },
        { do: "show_card", card: "c_ticket", title: "Cloakroom ticket", text: "Never redeemed. Punched through the middle: ◆ 0." },
        { do: "solved", step: "s1" },
      ],
    };
    const quiet = quietResult(def, { type: "set_control", target: "rug", control: "lifted", value: true }, lifted)!;
    // The lens is there to pick up; the ticket is a real find; the lens's own card is a hold away (and in the casebook).
    expect(quiet.effects.map((e) => (e.do === "show_card" ? e.card : e.do))).toEqual(["grant", "c_ticket", "solved"]);
    expect(strengthOf(quiet)).toBe("solve");
  });

  it("leaves a card found anywhere else alone, and a result with nothing to drop untouched", () => {
    const found: ActionResult = { outcome: "ok", effects: [{ do: "show_card", card: "c_note", title: "Cloakroom ticket", text: "Punched through the middle: ◆ 0." }] };
    expect(quietResult(oldDef, { type: "inspect", object: "drawer" }, found)).toBe(found);
    expect(quietResult(oldDef, light, null)).toBeNull();
    expect(quietResult(null, light, oldLit)!.effects.map((e) => e.do)).toEqual(["overlay"]);
    const wrong: ActionResult = { outcome: "wrong", effects: [], start_cooldown: true };
    expect(quietResult(oldDef, { type: "submit", object: "drawer", value: ["1"] }, wrong)).toBe(wrong);
  });
});

describe("the casebook, without a trace's report", () => {
  const report = { id: "c_report", title: "Footprint report", text: "A man's boot, size eleven. Whoever stood here was no gardener." };
  const note = { id: "c_note", title: "Cloakroom ticket", text: "Punched through the middle: ◆ 0." };
  const logged = (places: Record<string, string | null>) => ({ ...emptyLog(), cards: Object.fromEntries(Object.entries(places).map(([id, place], i) => [id, { at: i, place, batch: 1 }])) });

  it("an old save's report is never listed, whether the log knows where it turned up or not", () => {
    const cards = [report, note];
    // Read at the trace (the log has its place).
    expect(withoutTraceReports(cards, oldDef, logged({ c_report: "trace_fp", c_note: "drawer" }))).toEqual([note]);
    // Found before the log was kept: an old room's report is known by its title.
    expect(withoutTraceReports(cards, oldDef, logged({ c_report: null, c_note: null }))).toEqual([note]);
    expect(withoutTraceReports(cards, oldDef, null)).toEqual([note]);
    for (const title of OLD_REPORT_TITLES) expect(withoutTraceReports([{ ...report, title }], oldDef, null)).toEqual([]);
  });

  it("an old room's writing report goes too (it narrated); a new room's writing keeps its bare words, and only those", () => {
    const oldWriting = { id: "c_w", title: "Lab slip", text: "Written in something clear, and legible under UV: ▲ 4." };
    expect(withoutTraceReports([oldWriting], oldDef, logged({ c_w: "trace_wr" }), [{ object: "trace_wr", overlay: "glow_mark", mark: "▲ 4" }])).toEqual([]);
    const words = { id: "c_w", title: "Writing on the wall", text: "Never the first: what lies flat on the floor." };
    const overlays = [{ object: "trace_wr", overlay: "glow_mark", mark: "Never the first: what lies flat on the floor." }];
    expect(withoutTraceReports([words, note], newDef, logged({ c_w: "trace_wr", c_note: "drawer" }), overlays)).toEqual([words, note]);
    // A card at a writing trace that says more than the wall does is a report.
    expect(withoutTraceReports([{ ...words, text: `Chalked in a hurry, by a left hand: ${words.text}` }], newDef, logged({ c_w: "trace_wr" }), overlays)).toEqual([]);
    // Nothing is ever logged for the other traces.
    expect(withoutTraceReports([report], newDef, logged({ c_report: "trace_fp" }))).toEqual([]);
  });

  it("is the same list when there's nothing to drop (no traces, or none of the cards is a report)", () => {
    const cards = [note];
    expect(withoutTraceReports(cards, { objects: [{ id: "drawer" }] }, null)).toBe(cards);
    expect(withoutTraceReports(cards, newDef, logged({ c_note: "drawer" }))).toBe(cards);
    // A new room never drops a card by its title alone.
    expect(withoutTraceReports([{ ...note, title: "Lab slip" }], newDef, null)).toHaveLength(1);
    expect(withoutTraceReports(cards, null, null)).toBe(cards);
  });

  it("knows an old trace from a new one by what it carries", () => {
    expect(isOldTrace(oldTrace("prints"))).toBe(true);
    expect(isOldTrace(newPrints)).toBe(false);
    expect(isOldTrace(newWriting)).toBe(false);
  });
});
