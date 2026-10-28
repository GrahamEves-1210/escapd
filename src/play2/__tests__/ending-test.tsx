// The way out (Ending.tsx): a headline in the mode's voice that never repeats
// the ending's own text, the beats (the door gets its moment before the light
// floods), the last page in the mode's glow (the book's last line, a fleuron
// and "The End", a page number), the button off the bottom edge.
import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import { PAYOFF_TYPE } from "@/theme/payoff";
import { ENDING, Ending, endingHeadline, endingLight, pageNumber } from "../Ending";

jest.mock("@shopify/react-native-skia", () => {
  const base = jest.requireActual("../../../jest/skia-mock");
  const { createElement } = jest.requireActual("react");
  const host = (name: string) => (props: Record<string, unknown>) => createElement(name, props, props.children);
  return { ...base, Circle: host("SkiaCircle"), RadialGradient: host("SkiaRadialGradient"), vec: (x: number, y: number) => ({ x, y }) };
});

const mockFeedback = { unlock: jest.fn(), solved: jest.fn(), tick: jest.fn() };
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
    await act(() => jest.advanceTimersByTime(ENDING.lightAt + ENDING.light));
    expect(mockFeedback.solved).toHaveBeenCalledTimes(1);
    expect(ENDING.lightAt).toBeGreaterThanOrEqual(1000);
    expect(screen.getByTestId("v2-ending-headline").props.children).toBe(endingHeadline("noir", "The lock gives. Case closed."));
    expect(screen.getByText("The lock gives. Case closed.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("v2-ending-done"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("sets the headline in the mode's face, and keeps the button off the bottom edge", async () => {
    await render(<ThemeProvider reducedMotion><Ending text="" genre="paranormal" onDone={() => {}} /></ThemeProvider>);
    expect(flat(screen.getByTestId("v2-ending-headline"))).toMatchObject({ fontFamily: modeThemes.paranormal.display.fontFamily });
    expect(flat(screen.getByTestId("v2-ending-words")).paddingBottom).toBeGreaterThanOrEqual(ref.space.lg);
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

  it("is lit in each mode's glow, its words and The End readable on it", () => {
    for (const genre of ["noir", "crime_scene", "paranormal"] as const) {
      const light = endingLight(genre);
      expect(light.ink).toBe(modeThemes[genre].ground);
      expect(contrast(light.ink, light.wash)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(light.accent, light.wash)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ends as a book does: the last line, a fleuron and The End, a page number", async () => {
    await render(<ThemeProvider reducedMotion><Ending text="The lock gives." genre="crime_scene" onDone={() => {}} /></ThemeProvider>);
    expect(flat(screen.getByTestId("v2-ending-text"))).toMatchObject(PAYOFF_TYPE.lastLarge);
    expect(screen.getByLabelText("The End")).toBeTruthy();
    expect(screen.getByText("Chapter the last")).toBeTruthy();
    expect(screen.getByText(`· ${pageNumber("The lock gives.")} ·`, { includeHiddenElements: true })).toBeTruthy();
    expect(pageNumber("The lock gives.")).toBe(pageNumber("The lock gives."));
  });
});
