// The way out (Ending.tsx): a headline in the mode's voice that never repeats
// the ending's own text, the beats (the door gets its moment before the light
// floods, then settles round the letter), the reply letter in the mode's
// faces (src/play2/letters: the ending's text, "The End", a page number), the
// button off the bottom edge.
import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import { LETTER_FONT } from "@/theme/payoff";
import { caseLabel } from "@/render/victory";
import { ENDING, Ending, endingHeadline, endingLight, runningHead } from "../Ending";
import { MOMENT } from "../letters/Moments";

jest.mock("@shopify/react-native-skia", () => {
  const base = jest.requireActual("../../../jest/skia-mock");
  const { createElement } = jest.requireActual("react");
  const host = (name: string) => (props: Record<string, unknown>) => createElement(name, props, props.children);
  const names = ["Circle", "RadialGradient", "Path", "Rect", "Line", "Shadow", "FractalNoise", "ColorMatrix", "BlurMask", "LinearGradient"];
  return { ...base, ...Object.fromEntries(names.map((n) => [n, host(`Skia${n}`)])), vec: (x: number, y: number) => ({ x, y }) };
});

const mockFeedback = { unlock: jest.fn(), solved: jest.fn(), tick: jest.fn(), stamp: jest.fn(), candleOut: jest.fn(), doorOut: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const flat = (node: { props: Record<string, unknown> }) => StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.useRealTimers());

describe("endingHeadline", () => {
  it("speaks in each mode's voice", () => {
    const heads = (["noir", "crime_scene", "paranormal"] as const).map((g) => endingHeadline(g, ""));
    expect(new Set(heads).size).toBe(3);
    expect(heads).not.toContain("You're out.");
  });

  it("never says what the ending's text already says", () => {
    const first = endingHeadline("noir", "");
    expect(endingHeadline("noir", `The lock gives. ${first}`)).not.toBe(first);
    expect(endingHeadline("paranormal", "The room goes still; it lets you go.")).not.toBe("It lets you go.");
  });
});

describe("Ending", () => {
  it("gives the door its moment, then the light, then the lines; done goes on", async () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    await render(<Ending text="The lock gives. Case closed." genre="noir" onDone={onDone} />);
    expect(mockFeedback.unlock).toHaveBeenCalledTimes(1);
    // The close-up underneath shows first: the ending fades up after `appear`.
    expect(screen.getByTestId("v2-ending")).toHaveAnimatedStyle({ opacity: 0 });
    await act(() => jest.advanceTimersByTime(ENDING.appear + ENDING.fade + 20));
    expect(screen.getByTestId("v2-ending")).toHaveAnimatedStyle({ opacity: 1 });
    expect(mockFeedback.solved).not.toHaveBeenCalled();
    expect(screen.getByTestId("v2-ending-settle")).toHaveAnimatedStyle({ opacity: 0 });
    await act(() => jest.advanceTimersByTime(ENDING.lightAt + ENDING.light));
    expect(mockFeedback.solved).toHaveBeenCalledTimes(1);
    expect(ENDING.lightAt).toBeGreaterThanOrEqual(1000);
    // The headline's last two words held together (no lone word on its last line).
    expect(screen.getByTestId("v2-ending-headline").props.children.replace(/\u00a0/g, " ")).toBe(endingHeadline("noir", "The lock gives. Case closed."));
    expect(screen.getByTestId("v2-ending-text").props.accessibilityLabel).toBe("The lock gives. Case closed.");
    // The light settles round the letter.
    await act(() => jest.advanceTimersByTime(ENDING.settle + 400));
    expect(screen.getByTestId("v2-ending-settle")).toHaveAnimatedStyle({ opacity: 1 });
    await fireEvent.press(screen.getByTestId("v2-ending-done"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("sets the headline in the letter's face (never Playfair), and keeps the button off the bottom edge", async () => {
    const faces = { noir: LETTER_FONT.typewriter, crime_scene: LETTER_FONT.formHeavy, paranormal: LETTER_FONT.fellItalic } as const;
    for (const genre of ["noir", "crime_scene", "paranormal"] as const) {
      const view = await render(<ThemeProvider reducedMotion><Ending text="The lock gives." genre={genre} onDone={() => {}} /></ThemeProvider>);
      const head = flat(screen.getByTestId("v2-ending-headline"));
      expect(head.fontFamily).toBe(faces[genre]);
      expect(head.lineHeight).toBeGreaterThanOrEqual(head.fontSize as number);
      expect(JSON.stringify(view.toJSON())).not.toMatch(/Playfair/);
      await view.unmount();
    }
    await render(<ThemeProvider reducedMotion><Ending text="" genre="paranormal" onDone={() => {}} /></ThemeProvider>);
    expect(flat(screen.getByTestId("v2-ending-words")).paddingBottom).toBeGreaterThanOrEqual(ref.space.lg);
  });
});

// The moment between the door and the letter (letters/Moments.tsx).
describe("the moment", () => {
  it.each([["noir", "doorOut"], ["crime_scene", "stamp"], ["paranormal", "candleOut"]] as const)("%s: its own moment, its sound on its beat, before the case is solved's", async (genre, sound) => {
    jest.useFakeTimers();
    await render(<Ending text="The lock gives." genre={genre} onDone={() => {}} />);
    expect(screen.getByTestId(`v2-ending-moment-${genre}`, { includeHiddenElements: true })).toBeTruthy();
    await act(() => jest.advanceTimersByTime(ENDING.lightAt));
    expect(mockFeedback[sound]).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(ENDING.light - 10));
    expect(mockFeedback[sound]).toHaveBeenCalledTimes(1);
    expect(mockFeedback.solved).not.toHaveBeenCalled();
    // The letter waits for it: nothing of the reply shows until the moment is over.
    expect(screen.getByTestId("v2-ending-settle")).toHaveAnimatedStyle({ opacity: 0 });
    for (const beat of Object.values({ ...MOMENT.noir, ...MOMENT.crime_scene, ...MOMENT.paranormal }).flat()) if (typeof beat === "number" && beat <= 1) expect(beat).toBeGreaterThanOrEqual(0);
  });

  it("is left out with reduced motion: the light comes up and the letter is there", async () => {
    await render(<ThemeProvider reducedMotion><Ending text="The lock gives." genre="crime_scene" onDone={() => {}} /></ThemeProvider>);
    expect(screen.queryByTestId("v2-ending-moment-crime_scene", { includeHiddenElements: true })).toBeNull();
    expect(mockFeedback.stamp).not.toHaveBeenCalled();
  });
});

describe("the last page", () => {
  const lum = (c: string) => {
    const n = parseInt(c.slice(1, 7), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it("floods in each mode's glow, then settles to the mode's dark with the glow pooled in it", () => {
    for (const genre of ["noir", "crime_scene", "paranormal"] as const) {
      const light = endingLight(genre);
      expect(light.desk).toBe(modeThemes[genre].ground);
      expect(light.pool).toBe(modeThemes[genre].glow);
      // The flood is bright: the wash is far lighter than the dark it settles to.
      expect(contrast(light.wash, light.desk)).toBeGreaterThanOrEqual(7);
    }
  });

  it("ends as the correspondence does: the ending's text, The End, the cat on the letter, the mode's pill", async () => {
    await render(<ThemeProvider reducedMotion><Ending text="The lock gives." genre="crime_scene" onDone={() => {}} /></ThemeProvider>);
    expect(flat(screen.getByTestId("v2-ending-text"))).toMatchObject({ fontFamily: LETTER_FONT.report });
    expect(flat(screen.getByTestId("v2-ending-text")).fontSize).toBeGreaterThanOrEqual(16);
    expect(screen.getByLabelText("The End")).toBeTruthy();
    expect(screen.getByLabelText(/^The black cat/)).toBeTruthy();
    expect(screen.queryByText(/chapter/i)).toBeNull();
    // No page number: a letter isn't a book's page.
    expect(screen.queryByText(/^\u00b7 \d+ \u00b7$/, { includeHiddenElements: true })).toBeNull();
    // The one action is the mode's primary pill.
    expect(flat(screen.getByTestId("v2-ending-done"))).toMatchObject({ backgroundColor: modeThemes.crime_scene.accent });
  });
});

describe("the running head", () => {
  it("is the series line and the case's number, never an invented title", async () => {
    expect(runningHead("noir")).toBe("A Detective Noir Mystery");
    expect(runningHead("paranormal", "room-1")).toBe(`A Moonlit Mystery \u00b7 ${caseLabel("room-1")}`);
    await render(<Ending text="The lock gives." genre="crime_scene" roomId="room-2" onDone={() => {}} />);
    expect(screen.getByTestId("v2-ending-head").props.accessibilityLabel).toBe(`A True Crime Club Mystery \u00b7 ${caseLabel("room-2")}`);
  });
});
