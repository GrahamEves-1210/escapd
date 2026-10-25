import type { ReactElement } from "react";
import { AccessibilityInfo, BackHandler, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { createGestureController, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { router, useNavigation } from "expo-router";
import { markCaptureGuideSeen } from "@/capture/guideSeen";
import { openCapture, type CaptureDestination } from "@/capture/openCapture";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { color, motion, radius, ref, space, type } from "@/theme/tokens";
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

const hidden = { includeHiddenElements: true } as const;
const navigation = { setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) };
type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
let backHandlers: BackListener[] = [];

const TITLES = ["Start at the doorway", "Work around the room", "Get one close view", "Keep the case private"];

const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
/** How Reanimated's jest renderer reports an animated colour: "#C89D54" as "rgba(200, 157, 84, 1)". */
const rgba = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 1)`;
};
type Drawn = { props: { style?: unknown; jestAnimatedStyle?: { value: Record<string, unknown> } } };
/** A node's style as drawn now: its last render's style with Reanimated's live animated values on top. */
const drawnStyle = (node: Drawn) => ({ ...styleOf(node), ...node.props.jestAnimatedStyle?.value });
/** The step button's drawn fill, edge and label colours (the kit pill's surface layer and label). */
function stepButtonColours() {
  const button = screen.getByTestId("guide-step-button");
  const [surface, label] = button.children as unknown as Drawn[];
  return { fill: drawnStyle(surface).backgroundColor, edge: drawnStyle(surface).borderColor, label: drawnStyle(label).color };
}

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

describe("photo guide: first run", () => {
  it("opens on step 1 with the stamp, title, body, Next and a Close that skips the guide", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    const stamp = screen.getByLabelText("Before you shoot. Step 1 of 4");
    expect(stamp.props.children).toBe("BEFORE YOU SHOOT  ·  1 OF 4");
    expect(titleOnScreen(0)).toBeTruthy();
    expect(screen.getByText("One wide plate. Get the floor and two walls in.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip the guide" })).toBeTruthy();
    // iOS swipe-back stays on for step 1 only.
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    // The art, its mount and its plate label are decorative.
    expect(screen.getByTestId("guide-art", hidden).props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("is in the play screen's look: a centred brass stamp, a Playfair title, a Jakarta body, and the X in the text colour", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    expect(styleOf(screen.getByLabelText("Before you shoot. Step 1 of 4"))).toMatchObject({
      ...type.stamp,
      color: color.accent,
      textAlign: "center",
    });
    expect(styleOf(screen.getByRole("header", { name: TITLES[0] }))).toMatchObject({ ...type.narrativeTitle, color: color.text });
    expect(styleOf(screen.getByText("One wide plate. Get the floor and two walls in."))).toMatchObject({
      ...type.body,
      color: color.textSecondary,
    });
    // The light table's top bar: a 48 round live IconButton.
    expect(styleOf(screen.getByTestId("guide-close"))).toMatchObject({ width: 48, height: 48, borderRadius: radius.round });
    // The silk still and the grain lie under a canvas root, with no light pool anywhere.
    expect(JSON.stringify(screen.toJSON())).not.toContain("RadialGradient");
  });

  it("sets each step's drawing on a walnut film-plate mount with a brass plate label", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    const G = ref.layout.guide;
    expect(styleOf(screen.getByTestId("guide-mount", hidden))).toMatchObject({
      backgroundColor: color.surface,
      borderWidth: G.hairline,
      borderColor: color.hairline,
      borderRadius: radius.mount,
      padding: G.mount.pad,
      width: G.plate.width + (G.hairline + G.mount.pad) * 2,
    });
    expect(styleOf(screen.getByTestId("guide-plate", hidden))).toMatchObject({
      backgroundColor: color.canvas,
      borderRadius: radius.image,
      overflow: "hidden",
      width: G.plate.width,
      height: G.plate.height,
    });
    // The plate's rim: the light table's 1 pt edge.
    const plate = screen.getByTestId("guide-plate", hidden);
    const rims = (plate.children as unknown as { props: { style?: unknown } }[]).filter((c) => styleOf(c).borderColor === color.rim);
    expect(rims).toHaveLength(1);
    expect(styleOf(rims[0])).toMatchObject({ borderWidth: G.hairline, borderRadius: radius.image });
    // SceneView's plate label, in brass mono.
    expect(styleOf(screen.getByText("ESCAPD 400  ·  STEP I", hidden))).toMatchObject({ ...type.stamp, color: color.accent });
    await next();
    expect(screen.getByText("ESCAPD 400  ·  STEP II", hidden)).toBeTruthy();
    expect(screen.queryByText("ESCAPD 400  ·  STEP I", hidden)).toBeNull();
  });

  it("shows Next as the walnut brass pill on steps 1-3 and Open the camera as the brass primary on step 4", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    expect(stepButtonColours()).toEqual({
      fill: rgba(color.raised),
      edge: ref.button.brass.secondary.border,
      label: rgba(color.text),
    });
    await next();
    await next();
    expect(stepButtonColours().fill).toBe(rgba(color.raised));
    await next();
    await act(() => jest.advanceTimersByTime(ref.motion.control.duration * 2));
    expect(stepButtonColours()).toEqual({ fill: rgba(color.accent), edge: undefined, label: rgba(color.onAccent) });
    // The brass label type.
    expect(styleOf(screen.getByText("Open the camera"))).toMatchObject({ ...type.control });
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
    expect(screen.getByLabelText("Before you shoot. Step 2 of 4")).toBeTruthy();
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

  it("Close skips to the camera, marked seen, carrying the route's params, and only once", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{ from: "hub" }} />);
    await fireEvent.press(screen.getByRole("button", { name: "Skip the guide" }));
    await fireEvent.press(screen.getByRole("button", { name: "Skip the guide" }));
    expect(markCaptureGuideSeen).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/capture", params: { from: "hub" } });
  });

  it("ignores a Close tap during a step transition, without dimming anything", async () => {
    await renderGuide(<PhotoGuide replay={false} carry={{}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Next" }));
    const close = screen.getByRole("button", { name: "Skip the guide" });
    expect(close.props.accessibilityState?.disabled).toBeFalsy();
    expect(styleOf(close).opacity).toBeUndefined();
    await fireEvent.press(close);
    expect(router.replace).not.toHaveBeenCalled();
    await settle();
    await fireEvent.press(screen.getByRole("button", { name: "Skip the guide" }));
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
    // The base device's block: a one-line title, 4, a two-line body.
    const block = type.narrativeTitle.lineHeight + space.xs + type.body.lineHeight * 2;
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

describe("photo guide: replay", () => {
  async function toLastStep() {
    await next();
    await next();
    await next();
  }

  it("Close returns to the hub and marks the guide seen", async () => {
    await renderGuide(<PhotoGuide replay carry={{}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Close the guide" }));
    expect(markCaptureGuideSeen).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
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
    // Further taps are ignored while it checks.
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(button);
    expect(openCapture).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("guide-checking", hidden)).toBeNull();
    await act(() => jest.advanceTimersByTime(ref.layout.guide.thinkingDelay));
    expect(screen.getByTestId("guide-checking").props.accessibilityLabel).toBe("Checking access");
    // The warm thinking line: the live caption type.
    expect(styleOf(screen.getAllByText("Checking the file", hidden)[0])).toMatchObject({ ...type.caption });
    expect(router.replace).not.toHaveBeenCalled();
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
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("Couldn't reach the darkroom. Try again.");
    // On dark ground the words are the secondary tone and the icon carries the warning colour.
    expect(styleOf(screen.getByText("Couldn't reach the darkroom. Try again."))).toMatchObject({
      ...type.caption,
      color: color.textSecondary,
    });
    expect(screen.getByTestId("guide-check-error-icon", hidden).props.importantForAccessibility).toBe("no-hide-descendants");
    expect(screen.getByTestId("phosphor-react-native-warning-regular", hidden).props).toMatchObject({
      color: color.warning,
      width: ref.layout.guide.errorIcon,
    });
    expect(screen.getByRole("button", { name: "Open the camera" }).props.accessibilityState).toMatchObject({ busy: false });
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
    await fireEvent.press(screen.getByRole("button", { name: "Close the guide" }));
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
