// The shared state screen: loading, offline, error and access states. Round 6:
// its actions are the photo guide's foot (StateActions: the guide's pill, then
// a quiet text button, in the reading column), and it reads the mode's theme
// itself (the shell's is the reference look).
import { StyleSheet, Text } from "react-native";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { setMode } from "@/game/mode";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import { StateActions, StateScreen } from "../StateScreen";

const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const S = ref.layout.state;
const hidden = { includeHiddenElements: true } as const;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
const LIVE = (node: { props: Record<string, unknown> }) => node.props.accessibilityLiveRegion === "polite";
type Node = ReturnType<typeof screen.getByTestId>;
/** The kit's ghost pill (the shell's) draws its 1 pt hairline on an inner layer. */
const ghostEdges = (pill: Node) =>
  pill.queryAll((n) => n.type === "View" && styleOf(n).borderColor === ref.button.ghost.border && styleOf(n).borderWidth === ref.button.ghost.borderWidth);

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

  it("an error: the glyph in a void well (the shell's ground), the title and body in the reference type, in one polite region", async () => {
    await act(() =>
      render(
        <ThemeProvider reducedMotion>
          <StateScreen title="You're offline" body="Your progress is saved." icon={<Text testID="glyph">!</Text>} />
        </ThemeProvider>,
      ),
    );
    expect(styleOf(screen.getByTestId("state-screen"))).toMatchObject({ backgroundColor: ref.color.ground });
    expect(styleOf(screen.getByTestId("state-icon"))).toMatchObject({
      width: S.well.size,
      backgroundColor: ref.color.void,
      borderWidth: S.well.rim,
      borderColor: S.well.rimColor,
    });
    expect(screen.getByTestId("glyph")).toBeTruthy();
    expect(styleOf(screen.getByText("You're offline"))).toMatchObject({ ...ref.type.title, color: ref.color.textPrimary });
    expect(styleOf(screen.getByText("Your progress is saved."))).toMatchObject({ ...ref.type.subtitle, color: ref.color.textSecondary });
    const regions = screen.container.queryAll((n) => n.type === "View" && LIVE(n));
    expect(regions).toHaveLength(1);
  });

  it("primary is the photo guide's pill and secondary a quiet text button, in the guide's foot; both press through", async () => {
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
    // In the shell, the guide's own dark hairline pill (ref.button.ghost): 52 tall, the full column, the headline label.
    expect(styleOf(buttons[0])).toMatchObject({ minHeight: ref.button.ghost.height, alignSelf: "stretch" });
    expect(ghostEdges(buttons[0])).toHaveLength(1);
    expect(styleOf(screen.getByText("Try again"))).toMatchObject({ ...ref.type.headline });
    // The quiet text button under it: no fill, no edge, 48 tall across the column.
    expect(styleOf(buttons[1])).toMatchObject({ minHeight: ref.button.quiet.height, alignSelf: "stretch" });
    expect(ghostEdges(buttons[1])).toHaveLength(0);
    expect(styleOf(screen.getByText("Back"))).toMatchObject({ ...ref.type.headline });
    // The guide's foot: its reading column, the pill `pad` under the column, the quiet button `gap` under the pill,
    // the foot ref.space.ctaBottom over the (here zero) safe area.
    expect(styleOf(screen.getByTestId("state-actions"))).toMatchObject({
      paddingTop: S.footer.pad,
      paddingHorizontal: ref.space.reading,
      gap: S.footer.gap,
      paddingBottom: ref.space.ctaBottom,
    });
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

  it("with no actions, keeps only the bottom safe area", async () => {
    await act(() => render(<ThemeProvider reducedMotion><StateScreen title="You're offline" /></ThemeProvider>));
    expect(screen.queryByTestId("state-actions")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("StateScreen inside a mode", () => {
  const theme = modeThemes.paranormal;
  beforeEach(() => setMode("paranormal"));
  afterEach(() => setMode(null));

  it("reads the mode's theme itself: its surface, ink, muted ink, the well in its ground, the pill in its accent", async () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    await act(() =>
      render(
        <ThemeProvider reducedMotion>
          <StateScreen
            title="The case didn't open"
            body="Your progress is saved."
            icon={<Text testID="glyph">!</Text>}
            primary={{ label: "Try again", onPress: onPrimary }}
            secondary={{ label: "Back", onPress: onSecondary }}
          />
        </ThemeProvider>,
      ),
    );
    expect(styleOf(screen.getByTestId("state-screen")).backgroundColor).toBe(theme.surface);
    expect(styleOf(screen.getByTestId("state-icon"))).toMatchObject({ backgroundColor: theme.ground, borderColor: S.well.rimColor });
    expect(styleOf(screen.getByText("The case didn't open")).color).toBe(theme.ink);
    expect(styleOf(screen.getByText("Your progress is saved.")).color).toBe(theme.inkMuted);
    // The guide's pill as the mode's primary button (exactly as the guide's "Next"), the quiet button in the mode's ink.
    const [pill, quiet] = screen.getAllByRole("button");
    expect(styleOf(pill)).toMatchObject({ backgroundColor: theme.accent, minHeight: ref.button.ghost.height, borderRadius: ref.radius.round });
    expect(styleOf(screen.getByText("Try again")).color).toBe(theme.accentInk);
    expect(styleOf(quiet).backgroundColor).toBeUndefined();
    expect(styleOf(screen.getByText("Back")).color).toBe(theme.ink);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(pill);
    await user.press(quiet);
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
    expect(mockFeedback.press).toHaveBeenCalledTimes(2);
  });
});
