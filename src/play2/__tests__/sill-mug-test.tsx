// Home's mug, by the sitting cat: steaming on the sill; once a visit (never in its first moments) the cat pats it and knocks it off,
// a second after it leaves the sill the crash, the cat runs off and comes back; the mug stays gone that visit, back on the next.
// Not under reduced motion, and never while home isn't in front.
import { act, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { MUG, SittingCat } from "../SittingCat";

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

  it("is only on home: no mug without one", async () => {
    const view = await render(<SittingCat width={104} />);
    expect(mug()).toBeNull();
    await view.unmount();
  });
});
