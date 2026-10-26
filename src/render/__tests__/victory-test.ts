// The victory moment's data (victory.ts): the session's stats as they are,
// the magnifier rating's rule, and the moment's beats.
import { motion } from "@/theme/tokens";
import { caseSummary, magnifierRating, statLines, victoryTimeline } from "../victory";

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

  it("paranormal: the snap and the gone line come before CASE CLOSED", () => {
    const t = victoryTimeline({ genre: "paranormal", reduced: false, stats: 3, rating: 3 });
    expect(t.snap!).toBeLessThan(t.gone!);
    expect(t.gone!).toBeLessThan(t.stamp);
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
