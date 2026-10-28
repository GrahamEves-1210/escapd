// The way out (Ending.tsx): a headline in the mode's voice that never repeats
// the ending's own text, the beats (the door gets its moment before the light
// floods), the lines centred over the button, the button off the bottom edge.
import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import { ENDING, Ending, endingHeadline } from "../Ending";

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
