import type { ReactElement } from "react";
import { AccessibilityInfo, BackHandler, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { createGestureController, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { router, useNavigation } from "expo-router";
import { markCaptureGuideSeen } from "@/capture/guideSeen";
import { openCapture, type CaptureDestination } from "@/capture/openCapture";
import { setMode } from "@/game/mode";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { color, modeThemes, motion, ref } from "@/theme/tokens";
import { STEPS } from "../copy";
import { PhotoGuide } from "../PhotoGuide";
import { swipeStep } from "../swipe";

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    router: { replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useNavigation: jest.fn(),
    useFocusEffect: (effect: () => undefined | (() => void)) => useEffect(effect, [effect]),
  };
});
jest.mock("@/capture/openCapture", () => ({ openCapture: jest.fn() }));
jest.mock("@/capture/guideSeen", () => ({ markCaptureGuideSeen: jest.fn(() => Promise.resolve()) }));
// Stable spies, so a test can see which haptic a moment gave.
const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const hidden = { includeHiddenElements: true } as const;
const navigation = { setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };
type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
let backHandlers: BackListener[] = [];

const TITLES = ["Stand in the middle", "Turn right, shoot again", "All the way round", "Just the room"];

const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
type Node = ReturnType<typeof screen.getByTestId>;
/** Host views under `root` (the whole screen by default) whose flattened style matches. */
const viewsWhere = (match: (style: Record<string, unknown>) => boolean, root: Node = screen.container as Node) =>
  root.queryAll((node) => node.type === "View" && match(styleOf(node)));
/** The step pill's hairline surface: the kit's ghost pill draws its 1 pt edge on an inner layer. */
const pillEdges = () => viewsWhere((s) => s.borderColor === ref.button.ghost.border && s.borderWidth === ref.button.ghost.borderWidth);
/** Every drawn focus ring: the kit's 2 pt ring in ref.focus.color (brass). */
const focusRings = () => viewsWhere((s) => s.borderColor === ref.focus.color && s.borderWidth === ref.focus.width);
/** The kit ring's reach outside its control: the 2 offset plus the 2 width. */
const RING = ref.focus.offset + ref.focus.width;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(useNavigation).mockReturnValue(navigation as never);
  jest.mocked(router.canGoBack).mockReturnValue(true);
  backHandlers = [];
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
    backHandlers.push(handler);
    return { remove: () => (backHandlers = backHandlers.filter((h) => h !== handler)) };
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Lets a step crossfade run to its end. */
async function settle(duration: number = motion.sceneCrossfade) {
  await act(() => jest.advanceTimersByTime(duration * 2));
}

async function next() {
  await fireEvent.press(screen.getByRole("button", { name: "Next" }));
  await settle();
}

async function pressBack() {
  let handled: boolean | undefined;
  await act(() => {
    handled = backHandlers[backHandlers.length - 1]?.({ type: "hardwareBackPress", timeStamp: 0 });
  });
  return handled;
}

const titleOnScreen = (step: number) => screen.queryByRole("header", { name: TITLES[step] });
/** Drawn copies of a step's title, hidden or not, leaving out the always-present (invisible) sizer copy. */
const drawnTitles = (step: number) => screen.queryAllByText(TITLES[step], hidden).length - 1;

/** The app's root layout provides the gesture root. */
function renderGuide(ui: ReactElement) {
  return render(<GestureHandlerRootView style={StyleSheet.absoluteFill}>{ui}</GestureHandlerRootView>);
}

describe("photo guide: after openCapture's check (every new room)", () => {
  it("opens on step 1 with the title, body, Next and a Close that skips the guide, and no step label on screen", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    expect(titleOnScreen(0)).toBeTruthy();
    expect(screen.getByText("Face any wall and take the first photo.")).toBeTruthy();
    // The reference shows no step count: screen readers get it from the button's hint.
    expect(screen.queryByText(/OF 4|of 4/, hidden)).toBeNull();
    expect(screen.getByRole("button", { name: "Next" }).props.accessibilityHint).toBe("Step 1 of 4");
    expect(screen.getByRole("button", { name: "Skip to the camera" })).toBeTruthy();
    // iOS swipe-back stays on for step 1 only.
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    // The drawing is decorative.
    expect(screen.getByTestId("guide-art", hidden).props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("is in Apple Health's look: pure black, a bold white title over a regular grey body in the system font, in the 38 gutters", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    const title = screen.getByRole("header", { name: TITLES[0] });
    expect(styleOf(title)).toMatchObject({ ...ref.type.stepTitle, color: ref.color.textPrimary });
    expect(styleOf(title).fontFamily).toBeUndefined();
    expect(styleOf(screen.getByText("Face any wall and take the first photo."))).toMatchObject({
      ...ref.type.stepBody,
      color: ref.layout.guide.bodyText,
      marginTop: ref.layout.guide.titleGap,
    });
    expect(styleOf(title.parent as Node).paddingHorizontal).toBe(ref.space.reading);
    // No silk, grain, glow or brass.
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).not.toContain("RadialGradient");
    expect(tree).not.toContain(color.accent);
  });

  it("closes from the capture flow's square at the top left, as the review, the build wait and the mode intro", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    const SQ = ref.button.square;
    const close = screen.getByTestId("guide-close");
    expect(styleOf(close)).toMatchObject({ width: SQ.size, height: SQ.size, borderRadius: SQ.radius, backgroundColor: ref.color.raised });
    const icon = ref.layout.camera.headerIcon;
    expect(screen.getByTestId(`phosphor-react-native-x-${icon.weight}`, hidden).props).toMatchObject({ color: ref.color.textPrimary, width: icon.size });
    let header = close.parent as Node;
    while (header && styleOf(header).paddingHorizontal === undefined) header = header.parent as Node;
    expect(styleOf(header)).toMatchObject({ paddingHorizontal: ref.layout.camera.edge, justifyContent: "flex-start" });
  });

  it("sets the drawing alone on the black ground, at the art box's full size, with no mount or frame", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    const G = ref.layout.guide;
    expect(styleOf(screen.getByTestId("guide-art-box", hidden))).toMatchObject({ width: G.art.width, height: G.art.height });
    // The only edged views are the close square's.
    expect(viewsWhere((s) => s.borderWidth !== undefined && s.borderColor !== ref.layout.camera.squareRim)).toHaveLength(0);
  });

  it("shows the same raised primary pill on every step in the shell, never the dark hairline one: Next on steps 1-3, Open the camera on step 4", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    const pill = () => screen.getByTestId("guide-step-button");
    expect(styleOf(pill()).minHeight).toBe(ref.button.primary.height);
    expect(pillEdges()).toHaveLength(0);
    expect(styleOf(screen.getByText("Next"))).toMatchObject({ ...ref.type.ctaLabel });
    await next();
    expect(screen.getByRole("button", { name: "Next" }).props.accessibilityHint).toBe("Step 2 of 4");
    await next();
    await next();
    expect(screen.getByRole("button", { name: "Open the camera" }).props.accessibilityHint).toBe("Step 4 of 4");
    expect(pillEdges()).toHaveLength(0);
    expect(styleOf(pill()).minHeight).toBe(ref.button.primary.height);
    expect(styleOf(screen.getByText("Open the camera"))).toMatchObject({ ...ref.type.ctaLabel });
  });

  it("draws the brass focus ring round the disc and the pill while they have focus", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    expect(focusRings()).toHaveLength(0);
    const close = screen.getByRole("button", { name: "Skip to the camera" });
    await fireEvent(close, "focus");
    expect(focusRings()).toHaveLength(1);
    expect(styleOf(focusRings()[0])).toMatchObject({ borderRadius: ref.radius.round, top: -RING, left: -RING, right: -RING, bottom: -RING });
    await fireEvent(close, "blur");
    expect(focusRings()).toHaveLength(0);
    const button = screen.getByRole("button", { name: "Next" });
    await fireEvent(button, "focus", { nativeEvent: {} });
    expect(focusRings()).toHaveLength(1);
    expect(styleOf(focusRings()[0]).borderRadius).toBe(ref.radius.round);
    await fireEvent(button, "blur", { nativeEvent: {} });
    expect(focusRings()).toHaveLength(0);
  });

  it("Next crossfades to the next step, ignores taps mid-transition, then focuses the title and announces the step", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Next" }));
    // Mid-transition: the old step is still fading out, hidden from screen readers.
    expect(drawnTitles(0)).toBe(1);
    expect(titleOnScreen(0)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Next" }));
    await settle();
    expect(titleOnScreen(1)).toBeTruthy();
    expect(drawnTitles(0)).toBe(0);
    expect(titleOnScreen(2)).toBeNull();
    expect(screen.getByRole("button", { name: "Next" }).props.accessibilityHint).toBe("Step 2 of 4");
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    // Focus goes to the new title, then the step is announced.
    expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenLastCalledWith(expect.anything(), "focus");
    expect(AccessibilityInfo.announceForAccessibilityWithOptions).toHaveBeenLastCalledWith("Step 2 of 4", { queue: true });
  });

  it("focuses the title and announces step 1 once the screen's opening transition ends", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    const [event, listener] = navigation.addListener.mock.calls.at(-1) as unknown as [string, (e: { data: { closing: boolean } }) => void];
    expect(event).toBe("transitionEnd");
    await act(() => listener({ data: { closing: false } }));
    expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledWith(expect.anything(), "focus");
    expect(AccessibilityInfo.announceForAccessibilityWithOptions).toHaveBeenLastCalledWith("Step 1 of 4", { queue: true });
  });

  it("turns the button into Open the camera on step 4, which marks the guide seen and replaces to /capture", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    await next();
    await next();
    await next();
    expect(titleOnScreen(3)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Open the camera" }));
    expect(markCaptureGuideSeen).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/capture", params: {} });
    expect(jest.mocked(markCaptureGuideSeen).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(router.replace).mock.invocationCallOrder[0],
    );
    expect(openCapture).not.toHaveBeenCalled();
  });

  it("the X skips to the camera, marked shown for the room, carrying the route's params, and only once", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{ from: "hub" }} />);
    await fireEvent.press(screen.getByRole("button", { name: "Skip to the camera" }));
    await fireEvent.press(screen.getByRole("button", { name: "Skip to the camera" }));
    expect(markCaptureGuideSeen).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/capture", params: { from: "hub" } });
  });

  it("ignores a Close tap during a step transition, without dimming anything", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Next" }));
    const close = screen.getByRole("button", { name: "Skip to the camera" });
    expect(close.props.accessibilityState?.disabled).toBeFalsy();
    expect(styleOf(close).opacity).toBeUndefined();
    await fireEvent.press(close);
    expect(router.replace).not.toHaveBeenCalled();
    await settle();
    await fireEvent.press(screen.getByRole("button", { name: "Skip to the camera" }));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("Android back goes to the previous step, then leaves to the opener without marking the guide seen", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    await next();
    await expect(pressBack()).resolves.toBe(true);
    await settle();
    expect(titleOnScreen(0)).toBeTruthy();
    await expect(pressBack()).resolves.toBe(true);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(markCaptureGuideSeen).not.toHaveBeenCalled();
  });

  it("Android back from step 1 with no history replaces to the hub", async () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    await expect(pressBack()).resolves.toBe(true);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("a committed swipe moves between steps; a right swipe on step 1 and a left swipe on step 4 do nothing", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    const swipe = createGestureController(getByGestureTestId("guide-swipe"));
    const release = async (translationX: number, velocityX: number) => {
      await act(() => {
        swipe.begin({ translationX: 0, velocityX: 0 });
        swipe.activate({ translationX, velocityX });
        swipe.end({ translationX, velocityX });
      });
      await settle();
    };
    await release(ref.layout.guide.swipe.commitDistance, 0);
    expect(titleOnScreen(0)).toBeTruthy();
    await release(-ref.layout.guide.swipe.commitDistance, 0);
    expect(titleOnScreen(1)).toBeTruthy();
    // Too short and too slow: nothing.
    await release(-(ref.layout.guide.swipe.commitDistance - 1), -(ref.layout.guide.swipe.commitVelocity - 1));
    expect(titleOnScreen(1)).toBeTruthy();
    await release(-ref.layout.guide.swipe.activeOffsetX * 2, -ref.layout.guide.swipe.commitVelocity);
    expect(titleOnScreen(2)).toBeTruthy();
    await release(-ref.layout.guide.swipe.commitDistance, 0);
    expect(titleOnScreen(3)).toBeTruthy();
    await release(-ref.layout.guide.swipe.commitDistance, 0);
    expect(titleOnScreen(3)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    await release(ref.layout.guide.swipe.commitDistance, 0);
    expect(titleOnScreen(2)).toBeTruthy();
  });

  it("scrolls the title and body only when large text overflows, so at rest it is no focus stop", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    // The base device's block: a one-line title, the 3 gap, a two-line body.
    const block = ref.type.stepTitle.lineHeight + ref.layout.guide.titleGap + ref.type.stepBody.lineHeight * 2;
    const text = () => screen.getByTestId("guide-text");
    expect(text().props.scrollEnabled).toBe(false);
    await fireEvent(text(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: ref.layout.guide.art.width, height: block } } });
    await fireEvent(text(), "contentSizeChange", ref.layout.guide.art.width, block);
    expect(text().props.scrollEnabled).toBe(false);
    await fireEvent(text(), "contentSizeChange", ref.layout.guide.art.width, block * 2);
    expect(text().props.scrollEnabled).toBe(true);
  });

  // Halfway between reducedFade (140) and sceneCrossfade (200).
  const BETWEEN = (motion.reducedFade + motion.sceneCrossfade) / 2;

  it("the crossfade runs motion.sceneCrossfade", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Next" }));
    await act(() => jest.advanceTimersByTime(BETWEEN));
    expect(drawnTitles(0)).toBe(1);
    await settle();
    expect(drawnTitles(0)).toBe(0);
  });

  it("under reduced motion the crossfade is a motion.reducedFade", async () => {
    await renderGuide(
      <ThemeProvider reducedMotion>
        <PhotoGuide replay={false} carry={{}} />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Next" }));
    await act(() => jest.advanceTimersByTime(BETWEEN));
    expect(drawnTitles(0)).toBe(0);
    expect(titleOnScreen(1)).toBeTruthy();
  });
});

describe("photo guide: haptics", () => {
  it("ticks once per step change, by Next or a swipe, and never on a step that doesn't move", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    expect(mockFeedback.tick).not.toHaveBeenCalled();
    await next();
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    const swipe = createGestureController(getByGestureTestId("guide-swipe"));
    const release = async (translationX: number) => {
      await act(() => {
        swipe.begin({ translationX: 0, velocityX: 0 });
        swipe.activate({ translationX, velocityX: 0 });
        swipe.end({ translationX, velocityX: 0 });
      });
      await settle();
    };
    // A tap mid-transition is ignored, and so is its haptic.
    await fireEvent.press(screen.getByRole("button", { name: "Next" }));
    await fireEvent.press(screen.getByRole("button", { name: "Next" }));
    await settle();
    expect(mockFeedback.tick).toHaveBeenCalledTimes(2);
    await release(-ref.layout.guide.swipe.commitDistance);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(3);
    // A left swipe on step 4 moves nothing: no tick.
    await release(-ref.layout.guide.swipe.commitDistance);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(3);
  });

  it("presses lightly on the close disc", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole("button", { name: "Skip to the camera" }));
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/capture", params: {} });
  });
});

describe("photo guide: opened directly (?replay=1)", () => {
  async function toLastStep() {
    await next();
    await next();
    await next();
  }

  it("the X continues to the camera too, through the access check, never back to the hub", async () => {
    jest.mocked(openCapture).mockReturnValue(new Promise(() => {}));
    await renderGuide(<PhotoGuide replay carry={{}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Skip to the camera" }));
    expect(markCaptureGuideSeen).toHaveBeenCalledTimes(1);
    expect(openCapture).toHaveBeenCalledWith({ replace: true, skipGuide: true, signal: expect.any(AbortSignal) });
    expect(router.back).not.toHaveBeenCalled();
    // A second tap while it checks starts nothing more.
    await fireEvent.press(screen.getByRole("button", { name: "Skip to the camera" }));
    expect(openCapture).toHaveBeenCalledTimes(1);
  });

  it("Open the camera marks the guide seen, then runs the access check, busy, with the thinking line only past 1 s", async () => {
    jest.mocked(openCapture).mockReturnValue(new Promise(() => {}));
    await renderGuide(<PhotoGuide replay carry={{}} />);
    await toLastStep();
    await fireEvent.press(screen.getByRole("button", { name: "Open the camera" }));
    expect(markCaptureGuideSeen).toHaveBeenCalledTimes(1);
    expect(openCapture).toHaveBeenCalledWith({ replace: true, skipGuide: true, signal: expect.any(AbortSignal) });
    expect(jest.mocked(markCaptureGuideSeen).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(openCapture).mock.invocationCallOrder[0]);
    const button = screen.getByRole("button", { name: "Open the camera" });
    expect(button.props.accessibilityState).toMatchObject({ busy: true });
    // The kit pill's busy state: the label stays, the small spinner in its colour at the right.
    expect(within(button).getByText("Open the camera")).toBeTruthy();
    expect(screen.getByTestId("guide-step-button-spinner", hidden).props.color).toBe(ref.button.ghost.label);
    // Further taps are ignored while it checks.
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(button);
    expect(openCapture).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("guide-checking", hidden)).toBeNull();
    await act(() => jest.advanceTimersByTime(ref.layout.guide.thinkingDelay));
    expect(screen.getByTestId("guide-checking").props.accessibilityLabel).toBe("Checking access");
    // The thinking line in the system font's meta style.
    expect(styleOf(screen.getAllByText("Getting the camera ready", hidden)[0])).toMatchObject({ ...ref.type.meta });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("reserves the longer label's height, so the label swap on step 4 never moves the text above", async () => {
    await renderGuide(<PhotoGuide replay carry={{}} />);
    const button = () => screen.getByTestId("guide-step-button");
    const slot = () => styleOf(button().parent as Node);
    // The shell's step button: the kit's primary pill and its label type.
    const P = ref.button.primary;
    const label = ref.type.ctaLabel;
    // One label line at the default size: the pill's own height.
    expect(slot().minHeight).toBe(P.height);
    // Larger text wraps the longer label (measured by the hidden sizer) to two lines.
    const lines = label.lineHeight * 2;
    await fireEvent(screen.getByText("Open the camera", hidden), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 229, height: lines } } });
    // Its lines plus the pill's padding above and below.
    expect(slot().minHeight).toBe(lines + P.height - label.lineHeight);
  });

  it("a failed check shows the error line and a live button; a retry clears it and checks again", async () => {
    let fail: (reason: unknown) => void = () => {};
    jest.mocked(openCapture).mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    await renderGuide(<PhotoGuide replay carry={{}} />);
    await toLastStep();
    await fireEvent.press(screen.getByRole("button", { name: "Open the camera" }));
    await act(async () => fail(new Error("offline")));
    const error = screen.getByTestId("guide-check-error");
    // Not an accessibility element (on Android that would make it a focus stop
    // between Close and the button): the text reads itself and is announced.
    expect(error.props.accessible).toBeUndefined();
    expect(error.props.accessibilityLiveRegion).toBe("polite");
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("Couldn't connect. Try again.");
    // On dark ground the words are the secondary tone and the icon carries the warning colour.
    expect(styleOf(screen.getByText("Couldn't connect. Try again."))).toMatchObject({
      ...ref.type.meta,
      color: ref.color.textSecondary,
    });
    expect(screen.getByTestId("guide-check-error-icon", hidden).props.importantForAccessibility).toBe("no-hide-descendants");
    expect(screen.getByTestId("phosphor-react-native-warning-regular", hidden).props).toMatchObject({
      color: color.warning,
      width: ref.layout.guide.errorIcon,
    });
    const live = screen.getByRole("button", { name: "Open the camera" });
    expect(live.props.accessibilityState).toMatchObject({ busy: false });
    expect(screen.queryByTestId("guide-step-button-spinner", hidden)).toBeNull();
    expect(within(live).getByText("Open the camera")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Open the camera" }));
    expect(screen.queryByTestId("guide-check-error")).toBeNull();
    expect(openCapture).toHaveBeenCalledTimes(2);
  });

  it("once the check has navigated, the thinking line stops and the leaving guide ignores Close, back and Open the camera", async () => {
    let navigated: (destination: CaptureDestination | null) => void = () => {};
    jest.mocked(openCapture).mockImplementation(
      () =>
        new Promise((resolve) => {
          navigated = resolve;
        }),
    );
    await renderGuide(<PhotoGuide replay carry={{}} />);
    await toLastStep();
    await fireEvent.press(screen.getByRole("button", { name: "Open the camera" }));
    await act(() => jest.advanceTimersByTime(ref.layout.guide.thinkingDelay));
    expect(screen.getByTestId("guide-checking")).toBeTruthy();
    // openCapture has replaced the route (the camera here) and returns.
    await act(async () => navigated("capture"));
    expect(screen.queryByTestId("guide-checking", hidden)).toBeNull();
    expect(screen.queryByTestId("guide-check-error", hidden)).toBeNull();
    const button = screen.getByRole("button", { name: "Open the camera" });
    expect(button.props.accessibilityState).toMatchObject({ busy: true });
    // A Close tap during the exit fade would otherwise go back from the screen just opened.
    await fireEvent.press(screen.getByRole("button", { name: "Skip to the camera" }));
    await expect(pressBack()).resolves.toBe(true);
    await settle();
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(button);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(titleOnScreen(3)).toBeTruthy();
    expect(openCapture).toHaveBeenCalledTimes(1);
  });

  it("going back a step during the check drops it", async () => {
    let signal: AbortSignal | undefined;
    jest.mocked(openCapture).mockImplementation((options) => {
      signal = options?.signal;
      return new Promise(() => {});
    });
    await renderGuide(<PhotoGuide replay carry={{}} />);
    await toLastStep();
    await fireEvent.press(screen.getByRole("button", { name: "Open the camera" }));
    await expect(pressBack()).resolves.toBe(true);
    await settle();
    expect(signal?.aborted).toBe(true);
    expect(titleOnScreen(2)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).props.accessibilityState).toMatchObject({ busy: false });
  });
});

describe("photo guide: inside a mode", () => {
  const theme = modeThemes.noir;
  beforeEach(() => setMode("noir"));
  afterEach(() => setMode(null));

  it("takes the mode's ground, ink and muted ink", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    expect(styleOf(screen.getByTestId("guide-root")).backgroundColor).toBe(theme.ground);
    expect(styleOf(screen.getByRole("header", { name: TITLES[0] }))).toMatchObject({ ...ref.type.stepTitle, color: theme.ink });
    expect(styleOf(screen.getByText("Face any wall and take the first photo.")).color).toBe(theme.inkMuted);
  });

  it("draws the close square in the mode's raised fill, rim and ink", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    expect(styleOf(screen.getByTestId("guide-close"))).toMatchObject({ backgroundColor: theme.raised, borderColor: theme.rim });
    const icon = ref.layout.camera.headerIcon;
    expect(screen.getByTestId(`phosphor-react-native-x-${icon.weight}`, hidden).props.color).toBe(theme.ink);
  });

  it("makes the step button the mode's primary button, the same 52 pill, and every step still works", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{ retake: "2" }} />);
    const button = screen.getByTestId("guide-step-button");
    expect(styleOf(button)).toMatchObject({ backgroundColor: theme.accent, minHeight: ref.button.ghost.height, borderRadius: ref.radius.round });
    expect(styleOf(screen.getByText("Next")).color).toBe(theme.accentInk);
    expect(pillEdges()).toHaveLength(0);
    await next();
    await next();
    await next();
    expect(mockFeedback.tick).toHaveBeenCalledTimes(3);
    await fireEvent.press(screen.getByRole("button", { name: "Open the camera" }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/capture", params: { retake: "2" } });
  });

  it("shows the replay check's busy spinner in the accent's ink, and its error line in the muted ink", async () => {
    let fail: (e: Error) => void = () => {};
    jest.mocked(openCapture).mockReturnValue(new Promise<CaptureDestination>((_, reject) => (fail = reject)));
    await renderGuide(<PhotoGuide replay carry={{}} />);
    await next();
    await next();
    await next();
    await fireEvent.press(screen.getByRole("button", { name: "Open the camera" }));
    expect(screen.getByTestId("guide-step-button-spinner", hidden).props.color).toBe(theme.accentInk);
    await act(async () => fail(new Error("offline")));
    expect(styleOf(screen.getByText("Couldn't connect. Try again.")).color).toBe(theme.inkMuted);
    expect(screen.getByTestId("phosphor-react-native-warning-regular", hidden).props.color).toBe(color.warning);
  });
});

describe("swipeStep", () => {
  const S = ref.layout.guide.swipe;
  it("commits on distance or velocity: left is next, right is previous", () => {
    expect(swipeStep(-S.commitDistance, 0)).toBe(1);
    expect(swipeStep(S.commitDistance, 0)).toBe(-1);
    expect(swipeStep(-1, -S.commitVelocity)).toBe(1);
    expect(swipeStep(1, S.commitVelocity)).toBe(-1);
    expect(swipeStep(-(S.commitDistance - 1), -(S.commitVelocity - 1))).toBe(0);
  });
});

describe("photo guide: the 360", () => {
  it("teaches standing in the middle and turning all the way round, then keeping the shots private and steady", () => {
    expect(STEPS.map((step) => step.title)).toEqual(["Stand in the middle", "Turn right, shoot again", "All the way round", "Just the room"]);
    expect(STEPS[1].body).toBe("Turn a little. Keep part of the last photo in view.");
    expect(STEPS[2].body).toBe("The camera shows each turn until you're back at the start.");
    expect(STEPS[3].body).toBe("Keep faces out of the shot. Lights on, hold steady.");
    // No spot-by-spot photos, no darkroom words.
    expect(JSON.stringify(STEPS)).not.toMatch(/doorway|corner|busiest|close view|plate|develop|darkroom/i);
  });
});
