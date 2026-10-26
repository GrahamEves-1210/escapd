/// <reference types="node" />
// A mode's first-time intro (/mode/intro/<genre>), round 6: the mode's screen
// with its case list is gone; the intro stays, under the banner of the mode's
// drawn cover, and its button is the photo guide's pill in the mode's accent,
// which starts the mode's first case (openCapture).
import { StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { router } from "expo-router";
import { getAnimatedStyle } from "react-native-reanimated";
import { openCapture } from "@/capture/openCapture";
import { getMode, setMode } from "@/game/mode";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import { introKey } from "../introSeen";
import { ModeIntro } from "../ModeIntro";

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});
jest.mock("@/capture/openCapture", () => ({ openCapture: jest.fn() }));
jest.mock("@/components/noir/TreatedImage", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    TreatedImage: (props: Record<string, unknown>) =>
      createElement(View, { testID: props.testID, photo: { source: props.source, genre: props.genre, cacheKey: props.cacheKey, maxEdge: props.maxEdge } }),
  };
});
// Drawing the covers is src/screens/hub/art's business: here it records which mode's cover shows.
jest.mock("@/screens/hub/art/ModeCover", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return { ModeCover: (props: Record<string, unknown>) => createElement(View, { testID: props.testID, cover: { genre: props.genre } }) };
});
const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const capture = jest.mocked(openCapture);
const hidden = { includeHiddenElements: true } as const;
const L = ref.layout.mode;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

async function renderIntro(genre: "crime_scene" | "paranormal", { reducedMotion = false } = {}) {
  await render(
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <ThemeProvider reducedMotion={reducedMotion}>
        <ModeIntro genre={genre} />
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
  await act(async () => {});
}

beforeEach(async () => {
  jest.clearAllMocks();
  setMode(null);
  jest.mocked(router.canGoBack).mockReturnValue(true);
  capture.mockResolvedValue("guide");
  await AsyncStorage.clear();
});

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const animatedStyleOf = getAnimatedStyle as unknown as (node: unknown) => { opacity?: number };
/** The buttons and headings in tree order, which is reading and focus order, by name. */
const readingOrder = () =>
  screen.container
    .queryAll((node) => typeof node.type === "string" && ["button", "header"].includes(node.props.accessibilityRole))
    .map((node) => node.props.accessibilityLabel ?? String(node.props.children));
/** Scrolls the intro to `y`. */
const scrollTo = (testID: string, y: number) =>
  fireEvent.scroll(screen.getByTestId(testID), { nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 393, height: 1600 }, layoutMeasurement: { width: 393, height: 852 } } });

describe("A mode's intro: its pieces", () => {
  it("is all in the mode's palette under its drawn cover (never a photo), with the camera's back square; and it sets the mode", async () => {
    await renderIntro("crime_scene");
    const theme = modeThemes.crime_scene;
    expect(getMode()).toBe("crime_scene");
    const back = button("Back");
    expect(styleOf(back)).toMatchObject({
      width: ref.button.square.size,
      height: ref.button.square.size,
      borderRadius: ref.button.square.radius,
      backgroundColor: theme.raised,
      borderColor: theme.rim,
    });
    expect(styleOf(screen.getByText("Find the killer"))).toMatchObject({ ...L.type.tagline, color: theme.inkMuted });
    // The banner: the mode's drawn cover, decorative; no photo anywhere.
    expect(screen.getByTestId("mode-banner-art", hidden).props.cover).toEqual({ genre: "crime_scene" });
    expect(screen.getByTestId("mode-banner-art", hidden).props.photo).toBeUndefined();
    expect(screen.container.queryAll((node) => (node.props as { photo?: unknown }).photo !== undefined)).toHaveLength(0);
    expect(screen.getByTestId("mode-banner", hidden).props.accessibilityElementsHidden).toBe(true);
  });

  it("goes back, or home when there is nothing to go back to, with the press haptic", async () => {
    await renderIntro("paranormal");
    await userEvent.setup().press(button("Back"));
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalledTimes(1);
    jest.mocked(router.canGoBack).mockReturnValue(false);
    await fireEvent.press(button("Back"));
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("backs the status bar and the back square in the ground once the steps scroll under them; clear at rest, on the art", async () => {
    const theme = modeThemes.crime_scene;
    await renderIntro("crime_scene");
    // Over the content (zIndex), its backing decorative and in the mode's ground, down to under the square.
    expect(styleOf(screen.getByTestId("mode-header"))).toMatchObject({ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 });
    const backing = screen.getByTestId("mode-header-backing", hidden);
    expect(backing.props.accessibilityElementsHidden).toBe(true);
    expect(backing.props.pointerEvents).toBe("none");
    expect(styleOf(screen.getByTestId("mode-header-ground", hidden))).toMatchObject({
      backgroundColor: theme.ground,
      height: L.top + ref.button.square.size + L.header.below,
    });
    // At rest the square sits on the banner; the backing is solid by the time the banner's foot reaches it.
    const covered = L.banner - (L.top + ref.button.square.size + L.header.below);
    expect(animatedStyleOf(backing).opacity).toBe(0);
    await act(async () => scrollTo("mode-intro-scroll", covered - L.header.fade));
    expect(animatedStyleOf(screen.getByTestId("mode-header-backing", hidden)).opacity).toBe(0);
    await act(async () => scrollTo("mode-intro-scroll", covered - L.header.fade / 2));
    expect(animatedStyleOf(screen.getByTestId("mode-header-backing", hidden)).opacity).toBeCloseTo(0.5);
    await act(async () => scrollTo("mode-intro-scroll", covered + 400));
    expect(animatedStyleOf(screen.getByTestId("mode-header-backing", hidden)).opacity).toBe(1);
  });
});

describe("A mode's first-time intro", () => {
  it("crime scene: the briefing, the mode's name, three steps (evidence, alibis, arrest) and Take the case, in the mode's palette", async () => {
    await renderIntro("crime_scene");
    const theme = modeThemes.crime_scene;
    expect(getMode()).toBe("crime_scene");
    expect(styleOf(screen.getByTestId("mode-intro"))).toMatchObject({ backgroundColor: theme.ground });
    expect(screen.getByText("Briefing")).toBeTruthy();
    expect(styleOf(screen.getByRole("header", { name: "Crime Scene" }))).toMatchObject({ ...theme.display, color: theme.ink });
    expect([1, 2, 3].map((n) => screen.getByTestId(`mode-intro-step-${n}`).props.accessibilityLabel)).toEqual([
      "Step 1 of 3. Search the scene. Every clue is evidence. Some break a suspect's alibi.",
      "Step 2 of 3. Check the alibis. Open Suspects: who says what, and whose story no longer holds.",
      "Step 3 of 3. Make the arrest. Name the killer, the motive and the method. A wrong call costs you time.",
    ]);
    // Arabic numerals in the mode's display face, in its stamp colour.
    expect(styleOf(screen.getByText("1", hidden))).toMatchObject({ fontFamily: theme.display.fontFamily, color: theme.stamp });
    // Its button: the photo guide's pill (ModePill "ghost") in the mode's accent, at the guide's height, radius and type.
    expect(styleOf(button("Take the case"))).toMatchObject({ backgroundColor: theme.accent, borderRadius: ref.radius.round, minHeight: ref.button.ghost.height });
    expect(styleOf(screen.getByText("Take the case"))).toMatchObject({ ...ref.type.headline, color: theme.accentInk });
  });

  it("paranormal: before you go in; find the anomalies, feel the presence grow, banish it; Step inside", async () => {
    await renderIntro("paranormal");
    expect(screen.getByText("Before you go in")).toBeTruthy();
    expect(screen.getByText("Find the anomalies")).toBeTruthy();
    expect(screen.getByText("Feel the presence grow")).toBeTruthy();
    expect(screen.getByText("Banish it")).toBeTruthy();
    expect(button("Step inside")).toBeTruthy();
  });

  it("reads Back first, then the name, the steps and Step inside; the header backs the top once the steps scroll under it", async () => {
    await renderIntro("paranormal");
    expect(readingOrder()).toEqual(["Back", modeThemes.paranormal.name, "Step inside"]);
    const steps = screen.getAllByLabelText(/^Step \d of 3\./).map((node) => node.props.testID);
    expect(steps).toEqual(["mode-intro-step-1", "mode-intro-step-2", "mode-intro-step-3"]);
    // Back before the first step in the tree.
    const tree = screen.container.queryAll((node) => typeof node.type === "string" && (node.props.testID === "mode-intro-back" || node.props.testID === "mode-intro-step-1"));
    expect(tree.map((node) => node.props.testID)).toEqual(["mode-intro-back", "mode-intro-step-1"]);
    expect(animatedStyleOf(screen.getByTestId("mode-header-backing", hidden)).opacity).toBe(0);
    await act(async () => scrollTo("mode-intro-scroll", L.banner));
    expect(animatedStyleOf(screen.getByTestId("mode-header-backing", hidden)).opacity).toBe(1);
  });

  it("Start remembers it for this mode only and starts the mode's first case in its place; Back leaves without remembering", async () => {
    await renderIntro("paranormal");
    await fireEvent.press(button("Back"));
    expect(router.back).toHaveBeenCalled();
    expect(await AsyncStorage.getItem(introKey("paranormal"))).toBeNull();

    let finish: () => void = () => {};
    capture.mockReturnValueOnce(new Promise((resolve) => (finish = () => resolve("guide"))));
    await userEvent.setup().press(button("Step inside"));
    expect(mockFeedback.press).toHaveBeenCalled();
    expect(await AsyncStorage.getItem(introKey("paranormal"))).toBe("1");
    expect(await AsyncStorage.getItem(introKey("crime_scene"))).toBeNull();
    // openCapture with the mode, in the intro's place (back from the guide returns home): no mode screen.
    expect(capture).toHaveBeenCalledWith({ genre: "paranormal", replace: true, signal: expect.any(AbortSignal) });
    expect(button("Step inside").props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.getByTestId("mode-intro-start-spinner", hidden)).toBeTruthy();
    await act(async () => finish());
    expect(button("Step inside").props.accessibilityState).toMatchObject({ busy: false });
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("carries on to /capture when the access check can't run", async () => {
    capture.mockRejectedValueOnce(new Error("Network request failed"));
    await renderIntro("crime_scene");
    await fireEvent.press(button("Take the case"));
    await act(async () => {});
    expect(router.replace).toHaveBeenCalledWith("/capture");
  });
});
