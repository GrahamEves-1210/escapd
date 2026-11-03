// The victory moment's data (victory.ts): the session's stats as they are,
// the magnifier rating's rule, and the moment's beats.
import { motion } from "@/theme/tokens";
import {
  RATING_LABEL, RATING_MARK, SERIES_LINE, caseLabel, caseNumber, caseSummary, caseSummaryFromStats, catVerdict, magnifierRating, ratingReason, statDuration, statLines, victoryTimeline,
} from "../victory";

const done = { started_at: "2026-10-25T10:00:00.000Z", completed_at: "2026-10-25T10:08:00.000Z", hints_used: 1, wrong_answer_count: 3 };

describe("caseSummary", () => {
  it("takes the session's own numbers", () => {
    expect(caseSummary(done)).toEqual({ time: "8 min", hints: 1, wrong: 3 });
  });

  it("leaves out what the session doesn't hold, and is null without a session", () => {
    expect(caseSummary(null)).toBeNull();
    expect(caseSummary({ started_at: "2026-10-25T10:00:00.000Z", completed_at: null, hints_used: 2 })).toEqual({ hints: 2 });
    expect(caseSummary({ completed_at: null })).toBeNull();
  });
});

describe("caseSummaryFromStats: a v2 game's own count", () => {
  it("shows the hints, wrong answers and time the game counted", () => {
    expect(caseSummaryFromStats({ hints: 2, wrong: 3, ms: 400_000 })).toEqual({ time: "7 min", hints: 2, wrong: 3 });
    expect(caseSummaryFromStats({ hints: 0, wrong: 0, ms: 0 })).toEqual({ time: "<1 min", hints: 0, wrong: 0 });
    expect(caseSummaryFromStats(null)).toBeNull();
  });

  it("keeps a time short enough for a stat card", () => {
    expect(statDuration(59_000)).toBe("<1 min");
    expect(statDuration(8 * 60_000)).toBe("8 min");
    expect(statDuration(65 * 60_000)).toBe("1 h 5 min");
  });
});

describe("RATING_LABEL", () => {
  it("is the detective's eye in noir and crime scene, second sight in paranormal", () => {
    expect(RATING_LABEL).toEqual({ noir: "Observation", crime_scene: "Observation", paranormal: "Second sight" });
  });

  it("earns magnifiers in noir and crime scene, moons in paranormal", () => {
    expect(RATING_MARK).toEqual({ noir: "magnifier", crime_scene: "magnifier", paranormal: "moon" });
  });
});

describe("SERIES_LINE", () => {
  it("names each mode's book in the series", () => {
    expect(SERIES_LINE).toEqual({ noir: "A Detective Noir Mystery", crime_scene: "A True Crime Club Mystery", paranormal: "A Moonlit Mystery" });
  });
});

describe("magnifierRating: observation, not speed", () => {
  it.each([
    [{ hints: 0, wrong: 0 }, 3],
    [{ hints: 1, wrong: 0 }, 2],
    [{ hints: 0, wrong: 2 }, 2],
    [{ hints: 1, wrong: 2 }, 2],
    [{ hints: 2, wrong: 0 }, 1],
    [{ hints: 0, wrong: 3 }, 1],
    [{ hints: 5, wrong: 9 }, 1],
  ])("%o earns %i", (summary, rating) => {
    expect(magnifierRating(summary)).toBe(rating);
  });

  it("is null when either number is missing: no rating is better than a made-up one", () => {
    expect(magnifierRating(null)).toBeNull();
    expect(magnifierRating({ hints: 0 })).toBeNull();
    expect(magnifierRating({ wrong: 0 })).toBeNull();
  });

  it("ignores time", () => {
    expect(magnifierRating({ ...caseSummary({ ...done, completed_at: "2026-10-25T13:00:00.000Z" }), hints: 0, wrong: 0 })).toBe(3);
  });
});

describe("statLines", () => {
  it("lands time, hints, then wrong answers, naming crime scene's count for what it holds", () => {
    expect(statLines("noir", { time: "8 min", hints: 1, wrong: 3 }).map((l) => l.label)).toEqual(["Time", "Tips taken", "Wrong codes"]);
    expect(statLines("crime_scene", { wrong: 3 }).map((l) => `${l.label}: ${l.value}`)).toEqual(["Wrong calls: 3"]);
    expect(statLines("paranormal", { wrong: 1 }).map((l) => `${l.label}: ${l.value}`)).toEqual(["Missteps: 1"]);
    expect(statLines("paranormal", null)).toEqual([]);
  });

  it("gives each cell a short label (a quarter of the page across), and adds the clues found", () => {
    expect(statLines("noir", { time: "8 min", hints: 1, wrong: 3 }, { found: 3, total: 4 }).map((l) => [l.short, l.value])).toEqual([
      ["Time", "8 min"], ["Tips", "1"], ["Wrong", "3"], ["Clues", "3 of 4"],
    ]);
    expect(statLines("paranormal", { wrong: 1 }).map((l) => l.short)).toEqual(["Missteps"]);
    expect(statLines("noir", null, { found: 2, total: 2 }).map((l) => `${l.label}: ${l.value}`)).toEqual(["Clues found: 2 of 2"]);
    // No case's clue count, or nothing to count: no cell.
    expect(statLines("noir", null, { found: 2 })).toEqual([]);
    expect(statLines("noir", null, { found: 0, total: 0 })).toEqual([]);
  });
});

describe("victoryTimeline", () => {
  it("noir: the stamp's impact, then each stat, each earned magnifier, solved, then the actions", () => {
    const t = victoryTimeline({ genre: "noir", reduced: false, stats: 3, rating: 2 });
    const order = [t.stamp, t.impact, ...t.stats, t.rating!, ...t.magnifiers, t.solved, t.cta];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(t.magnifiers).toHaveLength(2);
    expect(t.snap).toBeUndefined();
    // The most satisfying ~3 seconds, not more.
    expect(t.cta).toBeLessThanOrEqual(3000);
  });

  it("paranormal: the room snaps back before its seal (the presence is gone) comes down", () => {
    const t = victoryTimeline({ genre: "paranormal", reduced: false, stats: 3, rating: 3 });
    expect(t.snap!).toBeLessThan(t.stamp);
    expect(t.cta).toBeLessThanOrEqual(3000);
  });

  it("stats never land before they arrive", () => {
    const t = victoryTimeline({ genre: "noir", reduced: false, stats: 2, rating: null, dataAt: 2000 });
    expect(t.stats[0]).toBe(2000);
    expect(t.magnifiers).toEqual([]);
    expect(t.solved).toBeGreaterThan(t.stats[1]);
  });

  it("with nothing to show, solved still follows the impact", () => {
    const t = victoryTimeline({ genre: "crime_scene", reduced: false, stats: 0, rating: null });
    expect(t.solved).toBeGreaterThan(t.impact);
  });

  it.each(["noir", "crime_scene", "paranormal"] as const)("%s, reduced motion: no stagger for the magnifiers, all within 600 ms", (genre) => {
    const t = victoryTimeline({ genre, reduced: true, stats: 3, rating: 3 });
    expect(t.stamp).toBe(0);
    expect(t.impact).toBe(motion.reducedFade);
    expect(t.magnifiers).toEqual([]);
    expect(Math.max(t.impact, ...t.stats, t.rating!, t.solved, t.cta)).toBeLessThan(600);
  });
});

describe("caseNumber: a neutral label for the case", () => {
  it("is four figures, the same for the same room, and differs between rooms", () => {
    const a = caseNumber("11111111-1111-4111-8111-111111111111");
    expect(a).toMatch(/^\d{4}$/);
    expect(caseNumber("11111111-1111-4111-8111-111111111111")).toBe(a);
    expect(caseNumber("22222222-2222-4222-8222-222222222222")).not.toBe(a);
    expect(caseLabel("11111111-1111-4111-8111-111111111111")).toBe(`Case no. ${a}`);
    expect(caseNumber("")).not.toBe("0000");
  });
});

describe("ratingReason: what earned the rating", () => {
  it("says a clean solve earns three", () => {
    expect(ratingReason("noir", { hints: 0, wrong: 0 })).toBe("3 magnifiers: solved with no tips and no wrong codes.");
    expect(ratingReason("paranormal", { hints: 0, wrong: 0 })).toBe("3 moons: solved with no tips and no missteps.");
  });

  it("says what cost the marks and what earns the next", () => {
    expect(ratingReason("crime_scene", { hints: 1, wrong: 0 })).toBe("2 magnifiers for 1 tip. No tips and no wrong calls earns 3.");
    expect(ratingReason("noir", { hints: 1, wrong: 2 })).toBe("2 magnifiers for 1 tip and 2 wrong codes. No tips and no wrong codes earns 3.");
    expect(ratingReason("paranormal", { hints: 3, wrong: 1 })).toBe("1 moon for 3 tips and 1 misstep. At most 1 tip and 2 missteps earns 2.");
  });

  it("is null without a rating", () => {
    expect(ratingReason("noir", { hints: 1 })).toBeNull();
    expect(ratingReason("noir", null)).toBeNull();
  });
});

describe("catVerdict", () => {
  it("is the cat's word on how it went", () => {
    expect(catVerdict({ hints: 0, wrong: 0 })).toMatch(/^Not one tip/);
    expect(catVerdict({ hints: 1, wrong: 0 })).toMatch(/helped a little/);
    expect(catVerdict({ hints: 0, wrong: 2 })).toMatch(/wrong turn/);
    expect(catVerdict({ hints: 4, wrong: 4 })).toMatch(/together/);
    expect(catVerdict(null)).toMatch(/shelf/);
  });
});
