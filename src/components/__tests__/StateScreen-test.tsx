import { StyleSheet, Text } from "react-native";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { StateActions, StateScreen } from "../StateScreen";

const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const S = ref.layout.state;
const hidden = { includeHiddenElements: true } as const;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
const LIVE = (node: { props: Record<string, unknown> }) => node.props.accessibilityLiveRegion === "polite";

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("StateScreen", () => {
  it("loading: the kit's thinking line carries the title as its status, with no spinner and no second live region", async () => {
    await act(() => render(<ThemeProvider reducedMotion><StateScreen loading title="Opening the case" /></ThemeProvider>));
    const line = screen.getByTestId("state-loading");
    expect(line.props).toMatchObject({ accessibilityLabel: "Opening the case", accessibilityLiveRegion: "polite" });
    // Shown once, in the still grey (the sizers carry no colour).
    const drawn = screen.queryAllByText("Opening the case", hidden).filter((n) => styleOf(n).color === ref.motion.thinking.shimmer.still);
    expect(drawn).toHaveLength(1);
    expect(screen.container.queryAll((n) => n.type === "ActivityIndicator")).toHaveLength(0);
    expect(screen.container.queryAll((n) => n.type === "View" && LIVE(n))).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("an error: the glyph in a void well, the title and body in the reference type, in one polite region", async () => {
    await act(() =>
      render(
        <ThemeProvider reducedMotion>
          <StateScreen title="You're offline" body="Your progress is saved." icon={<Text testID="glyph">!</Text>} />
        </ThemeProvider>,
      ),
    );
    expect(styleOf(screen.getByTestId("state-screen"))).toMatchObject({ backgroundColor: ref.color.ground });
    expect(styleOf(screen.getByTestId("state-icon"))).toMatchObject({ width: S.well.size, backgroundColor: S.well.fill, borderColor: S.well.rimColor });
    expect(screen.getByTestId("glyph")).toBeTruthy();
    expect(styleOf(screen.getByText("You're offline"))).toMatchObject({ ...ref.type.title, color: ref.color.textPrimary });
    expect(styleOf(screen.getByText("Your progress is saved."))).toMatchObject({ ...ref.type.subtitle, color: ref.color.textSecondary });
    const regions = screen.container.queryAll((n) => n.type === "View" && LIVE(n));
    expect(regions).toHaveLength(1);
  });

  it("primary is 07's white bar and secondary a quiet text button; both press through", async () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    await act(() =>
      render(
        <ThemeProvider reducedMotion>
          <StateScreen title="The case didn't open" primary={{ label: "Try again", onPress: onPrimary }} secondary={{ label: "Back", onPress: onSecondary }} />
        </ThemeProvider>,
      ),
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual(["Try again", "Back"]);
    expect(styleOf(buttons[0])).toMatchObject({ backgroundColor: S.bar.fill, minHeight: S.bar.height, borderRadius: S.bar.radius });
    expect(styleOf(screen.getByText("Try again"))).toMatchObject({ color: S.bar.label });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(buttons[0]);
    await user.press(buttons[1]);
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("both buttons give a light press on press-in; an action can ask for a thud", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await act(() =>
      render(
        <ThemeProvider reducedMotion>
          <StateScreen title="The case didn't open" primary={{ label: "Try again", onPress: jest.fn() }} secondary={{ label: "Back", onPress: jest.fn() }} />
        </ThemeProvider>,
      ),
    );
    await user.press(screen.getByRole("button", { name: "Try again" }));
    await user.press(screen.getByRole("button", { name: "Back" }));
    expect(mockFeedback.press).toHaveBeenCalledTimes(2);

    jest.clearAllMocks();
    await act(() =>
      render(
        <ThemeProvider reducedMotion>
          <StateActions bottom={0} primary={{ label: "Open the case", onPress: jest.fn(), haptic: "thud" }} />
        </ThemeProvider>,
      ),
    );
    await user.press(screen.getByRole("button", { name: "Open the case" }));
    expect(mockFeedback.thud).toHaveBeenCalledTimes(1);
    expect(mockFeedback.press).not.toHaveBeenCalled();
  });
});
