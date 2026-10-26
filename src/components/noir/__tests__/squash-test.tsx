import type { ReactElement } from "react";
import { Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { setMode } from "@/game/mode";
import { ModePill } from "@/capture/ui/ModePill";
import { PillButton } from "../PillButton";
import { SquashPressable } from "../squash";

// Haptics with stable spies (the full shape, as jest/setup.js).
const mockFeedback = {
  tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(),
  paper: jest.fn(), pickup: jest.fn(), wrongCode: jest.fn(), unlock: jest.fn(), stamp: jest.fn(), solved: jest.fn(),
  shutter: jest.fn(), typewriter: jest.fn(),
};
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const J = ref.motion.juice.press;
/** The squash's current scale: Reanimated's Jest copy of the animated style on the pressable. */
const scaleOf = (testID: string) => {
  const animated = screen.getByTestId(testID).props.jestAnimatedStyle as { value?: { transform?: { scale?: number }[] } } | undefined;
  return animated?.value?.transform?.[0]?.scale ?? 1;
};
// Long enough for the press-in timing and the release spring to settle.
const settle = () => act(() => jest.advanceTimersByTime(1000));

function renderIn(ui: ReactElement, reducedMotion = false) {
  return render(<ThemeProvider reducedMotion={reducedMotion}>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  setMode(null);
});
afterEach(() => {
  jest.useRealTimers();
  setMode(null);
});

describe("press-in squash", () => {
  it("the kit's pill sinks to the juice scale while pressed and springs home on release, with its haptic", async () => {
    await renderIn(<PillButton label="Take the case" onPress={() => {}} testID="pill" />);
    expect(scaleOf("pill")).toBe(1);
    await fireEvent(screen.getByTestId("pill"), "pressIn");
    await settle();
    expect(scaleOf("pill")).toBeCloseTo(J.scale, 3);
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByTestId("pill"), "pressOut");
    await settle();
    expect(scaleOf("pill")).toBeCloseTo(1, 3);
  });

  it("under reduced motion nothing scales, but the haptic stays", async () => {
    await renderIn(<PillButton label="Take the case" onPress={() => {}} testID="pill" />, true);
    await fireEvent(screen.getByTestId("pill"), "pressIn");
    await settle();
    expect(scaleOf("pill")).toBe(1);
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
  });

  it("a busy pill doesn't squash", async () => {
    await renderIn(<PillButton label="Building" busy onPress={() => {}} testID="pill" />);
    await fireEvent(screen.getByTestId("pill"), "pressIn");
    await settle();
    expect(scaleOf("pill")).toBe(1);
  });

  it("a pill in a mode squashes the same way, beside its pressed opacity", async () => {
    setMode("crime_scene");
    await renderIn(<ModePill label="Accuse" onPress={() => {}} testID="pill" />);
    await fireEvent(screen.getByTestId("pill"), "pressIn");
    await settle();
    expect(scaleOf("pill")).toBeCloseTo(J.scale, 3);
  });

  it("SquashPressable passes { pressed } to a function style and children, and takes its own scale", async () => {
    await renderIn(
      <SquashPressable squash={J.panel} testID="row" style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
        {({ pressed }) => <Text>{pressed ? "down" : "up"}</Text>}
      </SquashPressable>,
    );
    expect(screen.getByText("up")).toBeTruthy();
    await fireEvent(screen.getByTestId("row"), "pressIn");
    await settle();
    expect(screen.getByText("down")).toBeTruthy();
    expect(screen.getByTestId("row")).toHaveStyle({ opacity: 0.5 });
    expect(scaleOf("row")).toBeCloseTo(J.panel, 3);
    await fireEvent(screen.getByTestId("row"), "pressOut");
    expect(screen.getByText("up")).toBeTruthy();
  });

  it("squash={false} never scales", async () => {
    await renderIn(<SquashPressable squash={false} testID="still"><Text>Still</Text></SquashPressable>);
    await fireEvent(screen.getByTestId("still"), "pressIn");
    await settle();
    expect(scaleOf("still")).toBe(1);
  });
});
