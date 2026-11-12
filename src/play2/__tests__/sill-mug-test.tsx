// Home's mug, by the sitting cat: steaming on the sill; once a visit (never in its first moments) the cat pats it and knocks it off,
// a second after it leaves the sill the crash, the cat runs off and comes back; the mug stays gone that visit, back on the next.
// Not under reduced motion, and never while home isn't in front.
import { act, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { MUG, SittingCat } from "../SittingCat";
import { KNOCK, TUMBLE, tumbleFrame } from "../cat/Mug";

const mockMugBreak = jest.fn();
jest.mock("@/game/feedback", () => {
  const cues = { purr: () => {}, tick: () => {}, mugBreak: (...a: unknown[]) => mockMugBreak(...a) };
  return { useFeedback: () => cues };
});

const step = (ms: number) => act(async () => {
  jest.advanceTimersByTime(ms);
});
const mug = () => screen.queryByTestId("sill-mug", { includeHiddenElements: true });
const steam = () => screen.queryByTestId("sill-mug-steam", { includeHiddenElements: true });
const paw = () => screen.queryByTestId("sitting-cat-paw");

jest.setTimeout(60000);

describe("the mug on home's sill", () => {
  // Reanimated's frame callbacks start up on the first real frame: let one go by before the fake clock takes over.
  beforeAll(async () => {
    const warm = await render(<SittingCat width={10} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    await warm.unmount();
  });
  beforeEach(() => {
    jest.useFakeTimers();
    mockMugBreak.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("is knocked off once a visit: pats, a nudge, the crash a second after it leaves the sill; the cat runs off and comes back", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const view = await render(<SittingCat width={104} mug={{ visit: 1, active: true, base: 6 }} />);
    expect(mug()).toBeTruthy();
    expect(steam()).toBeTruthy();
    // Not in its first moments.
    await step(MUG.first - 1000);
    expect(mug()).toBeTruthy();
    expect(mockMugBreak).not.toHaveBeenCalled();
    // The moment comes: it pats it (its paw out), then nudges it off; the steam stops as it goes.
    await step(1000 + 700);
    expect(paw()).toBeTruthy();
    await step(2100);
    expect(steam()).toBeNull();
    await step(800);
    expect(mug()).toBeNull();
    expect(mockMugBreak).not.toHaveBeenCalled();
    // A second after it left the sill: the crash.
    await step(500);
    expect(mockMugBreak).toHaveBeenCalledTimes(1);
    // It runs off, is gone a while, comes back and sits; the mug stays gone, and it never happens twice in a visit.
    await step(MUG.gone + 3000);
    expect(mug()).toBeNull();
    await step(MUG.first + MUG.spread + 5000);
    expect(mockMugBreak).toHaveBeenCalledTimes(1);
    // Home opened again: the mug is back, steaming.
    await view.rerender(<SittingCat width={104} mug={{ visit: 2, active: true, base: 6 }} />);
    expect(mug()).toBeTruthy();
    expect(steam()).toBeTruthy();
    await view.unmount();
  });

  it("waits while home isn't in front, and never happens under reduced motion", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const away = await render(<SittingCat width={104} mug={{ visit: 1, active: false, base: 6 }} />);
    await step(MUG.first + MUG.spread + 10000);
    expect(mug()).toBeTruthy();
    expect(mockMugBreak).not.toHaveBeenCalled();
    await away.unmount();
    const still = await render(<ThemeProvider reducedMotion><SittingCat width={104} mug={{ visit: 1, active: true, base: 6 }} /></ThemeProvider>);
    await step(MUG.first + MUG.spread + 10000);
    expect(mug()).toBeTruthy();
    expect(paw()).toBeNull();
    expect(mockMugBreak).not.toHaveBeenCalled();
    await still.unmount();
  });

  it("falls as a real thing: the rendered tumble follows the cat's nudge, frame by frame, and a pat only rocks the still mug", () => {
    const size = 104 * MUG.size;
    const w = 104;
    // At rest, and rocked by a pat (a few degrees either way): the still picture, frame 0.
    expect(tumbleFrame([0, 0, 0], size)).toBe(0);
    expect(tumbleFrame([0, 0, 8], size)).toBe(0);
    expect(tumbleFrame([0, 0, -5], size)).toBe(0);
    // The nudge, as SittingCat plays it: the slide (to -0.12 then -0.2 of the cat's width), the tip (to -80 degrees), the drop (1.2 widths).
    const along = [[-w * 0.03, 0, 0], [-w * 0.09, 0, 0], [-w * 0.12, 0, -2], [-w * 0.13, w * 0.03, -16], [-w * 0.15, w * 0.15, -42], [-w * 0.17, w * 0.36, -80], [-w * 0.19, w * 0.65, -80], [-w * 0.2, w * 1.02, -80], [-w * 0.2, w * 1.2, -80]];
    const frames = along.map((f) => tumbleFrame(f, size));
    // Never backwards, never skipping more than two, from the first frames to the last.
    for (let i = 1; i < frames.length; i += 1) {
      expect(frames[i]).toBeGreaterThanOrEqual(frames[i - 1]);
      expect(frames[i] - frames[i - 1]).toBeLessThanOrEqual(2);
    }
    expect(frames[0]).toBeLessThanOrEqual(1);
    expect(frames[frames.length - 1]).toBe(TUMBLE.count - 1);
    expect(new Set(frames).size).toBeGreaterThanOrEqual(7);
    // The sheet holds every frame, and the nudge's shares add up to its last one.
    expect(TUMBLE.columns * TUMBLE.rows).toBe(TUMBLE.count);
    expect(KNOCK.shove + KNOCK.tip + KNOCK.fall).toBe(TUMBLE.count - 1);
    // The mug's size and its nudge are SittingCat's.
    expect(KNOCK.slide).toBeCloseTo(0.12 / MUG.size, 6);
    expect(KNOCK.drop).toBeCloseTo(1.2 / MUG.size, 6);
  });

  it("is only on home: no mug without one", async () => {
    const view = await render(<SittingCat width={104} />);
    expect(mug()).toBeNull();
    await view.unmount();
  });
});
