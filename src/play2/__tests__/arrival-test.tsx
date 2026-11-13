// The brief's arrival (Brief.tsx, letters/Envelope.tsx): the letter comes in
// the mode's envelope; she opens it (its own sound, then the paper's) and the
// letter is out in under a second and a half; a touch while it opens has it
// out at once; it happens once a case; with reduced motion, not at all.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ARRIVAL_MS, Brief } from "../Brief";
import { ENVELOPE } from "../letters/Envelope";

jest.mock("@shopify/react-native-skia", () => {
  const base = jest.requireActual("../../../jest/skia-mock");
  const { createElement } = jest.requireActual("react");
  const host = (name: string) => (props: Record<string, unknown>) => createElement(name, props, props.children);
  const names = ["Path", "Rect", "Circle", "Line", "Shadow", "FractalNoise", "ColorMatrix", "BlurMask", "LinearGradient"];
  return { ...base, ...Object.fromEntries(names.map((n) => [n, host(`Skia${n}`)])), vec: (x: number, y: number) => ({ x, y }) };
});
// The cat is its own suite's (its tail runs on a frame callback the test renderer's clock can't carry through a second render).
jest.mock("../letters/LetterCat", () => ({ LetterCat: () => null, CAT_ASPECT: 1 }));

const mockFeedback = { waxCrack: jest.fn(), stringOff: jest.fn(), paperFold: jest.fn(), paper: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const def = (mode: "noir" | "crime_scene" | "paranormal") => ({ mode, objective: "Find every piece and walk out through the door." });

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("Brief: the arrival", () => {
  const flush = () => act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it.each(["noir", "crime_scene", "paranormal"] as const)("%s: lies in its envelope until she opens it; then the letter, Begin, and it is remembered", async (mode) => {
    const onBegin = jest.fn();
    await render(<Brief def={def(mode)} roomId="room-9" onBegin={onBegin} />);
    await flush();
    // Nothing to read yet, and no way on: only the envelope (a button to a screen reader; no words on screen).
    expect(screen.getByTestId("v2-brief-envelope").props.accessibilityLabel).toBe("Open the envelope");
    expect(screen.queryByTestId("brief-context")).toBeNull();
    expect(screen.queryByTestId("v2-brief-begin")).toBeNull();
    // She opens it: under a second and a half later the letter lies there and the envelope is gone.
    await fireEvent.press(screen.getByTestId("v2-brief-envelope"));
    expect(ARRIVAL_MS).toBeLessThan(1500);
    await act(() => jest.advanceTimersByTime(ARRIVAL_MS + 60));
    expect(screen.queryByTestId("v2-brief-envelope")).toBeNull();
    expect(screen.getByTestId("brief-context")).toBeTruthy();
    expect(await AsyncStorage.getItem("escapd.v2.brief.opened.room-9")).toBe("1");
    // Its own sound as it opens (the wax, the string, the flap), then the paper's as the letter comes out.
    expect((mode === "paranormal" ? mockFeedback.waxCrack : mode === "crime_scene" ? mockFeedback.stringOff : mockFeedback.paperFold)).toHaveBeenCalledTimes(1);
    expect(mockFeedback.paper).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId("v2-brief-begin"));
    await act(() => jest.advanceTimersByTime(400));
    expect(onBegin).toHaveBeenCalledTimes(1);
    // Come back to the same case before beginning it: the letter lies there already.
    await render(<Brief def={def(mode)} roomId="room-9" onBegin={onBegin} />);
    await flush();
    expect(screen.queryByTestId("v2-brief-envelope")).toBeNull();
    expect(screen.getByTestId("brief-context")).toBeTruthy();
  });

  it("a touch while it opens has the letter out at once", async () => {
    await render(<Brief def={def("noir")} roomId="room-8" onBegin={() => {}} />);
    await flush();
    await fireEvent.press(screen.getByTestId("v2-brief-envelope"));
    await act(() => jest.advanceTimersByTime(100));
    expect(screen.getByTestId("v2-brief-envelope")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("v2-brief-envelope"));
    expect(screen.queryByTestId("v2-brief-envelope")).toBeNull();
    expect(screen.getByTestId("brief-context")).toBeTruthy();
  });

  it("with reduced motion there is no envelope: the letter lies there", async () => {
    await render(<ThemeProvider reducedMotion><Brief def={def("noir")} roomId="room-7" onBegin={() => {}} /></ThemeProvider>);
    expect(screen.queryByTestId("v2-brief-envelope")).toBeNull();
    expect(screen.getByTestId("brief-context")).toBeTruthy();
  });
});

describe("the envelope's frames", () => {
  it("fit their sheet, and the letter's way out lies inside the envelope", () => {
    expect(ENVELOPE.frames).toBeLessThanOrEqual(ENVELOPE.columns * ENVELOPE.rows);
    expect(ENVELOPE.mouth).toBeLessThan(ENVELOPE.foot);
    expect(ENVELOPE.left).toBeLessThan(ENVELOPE.right);
  });
});
