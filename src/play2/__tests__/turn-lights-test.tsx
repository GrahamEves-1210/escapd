// Turning to another photo: the next photo is loaded before it's needed
// (transitions/Preload), and every turn goes dark and the torch catches on the
// next photo once it's there (transitions/TurnLights).
import { act, render, screen } from "@testing-library/react-native";
import { Image } from "expo-image";
import { StyleSheet } from "react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Neighbours, PHOTO_CACHE, knownAspect, neighbourViews, rememberAspect } from "../transitions/Preload";
import { TURN_LIGHTS, TurnLights } from "../transitions/TurnLights";
import { LIGHTS } from "../transitions/LightsOn";

const HIDDEN = { includeHiddenElements: true } as const;
const advance = (ms: number) => act(async () => {
  jest.advanceTimersByTime(ms);
});
const opacityOf = (testID: string) =>
  ((screen.getByTestId(testID).props.jestAnimatedStyle as { value?: { opacity?: number } } | undefined)?.value?.opacity ?? 1);

describe("the photos either side", () => {
  it("are the next and the previous, round the room", () => {
    expect(neighbourViews(0, 3)).toEqual([1, 2]);
    expect(neighbourViews(2, 3)).toEqual([0, 1]);
    expect(neighbourViews(0, 2)).toEqual([1]);
    expect(neighbourViews(0, 1)).toEqual([]);
  });

  it("remembers a photo's shape once anything has loaded it, by its key or its uri", () => {
    expect(knownAspect({ uri: "https://x/never.jpg" })).toBeNull();
    rememberAspect({ uri: "https://x/signed?t=1" }, "photo-7", 1200, 1600);
    expect(knownAspect({ uri: "https://x/signed?t=2" }, "photo-7")).toBeCloseTo(0.75, 9);
    rememberAspect({ uri: "https://x/b.jpg" }, undefined, 1600, 900);
    expect(knownAspect({ uri: "https://x/b.jpg" })).toBeCloseTo(16 / 9, 9);
  });

  it("keeps the photo in view and its neighbours loaded, out of sight at the room's size, in memory; fetches the rest once", async () => {
    const prefetch = jest.spyOn(Image, "prefetch").mockResolvedValue(true);
    const sources = [0, 1, 2, 3, 4].map((i) => ({ uri: `https://x/p${i}.jpg` }));
    const size = { width: 390, height: 693 };
    await render(<Neighbours sources={sources} view={0} keyOf={(i) => `k${i}`} size={size} />);
    const hidden = screen.getByTestId("v2-neighbours", HIDDEN);
    expect(StyleSheet.flatten(hidden.props.style)).toMatchObject({ opacity: 0 });
    expect(hidden.props.pointerEvents).toBe("none");
    expect(hidden.props.accessibilityElementsHidden).toBe(true);
    for (const i of [4, 0, 1]) expect(screen.getByTestId(`v2-neighbour-${i}`, HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId("v2-neighbour-2", HIDDEN)).toBeNull();
    // Every other photo of the room into the cache, the neighbours first; once each.
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch.mock.calls[0][0]).toEqual(["https://x/p1.jpg", "https://x/p4.jpg", "https://x/p0.jpg", "https://x/p2.jpg", "https://x/p3.jpg"]);
    expect(prefetch.mock.calls[0][1]).toBe(PHOTO_CACHE);
    await act(() => screen.rerender(<Neighbours sources={sources} view={1} keyOf={(i) => `k${i}`} size={size} />));
    expect(prefetch).toHaveBeenCalledTimes(1);
    prefetch.mockRestore();
  });
});

describe("a turn: dark, then the torch catches on the next photo", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("goes dark, waits in the dark for the photo, then flickers up as from the brief", async () => {
    const onDone = jest.fn();
    await render(<TurnLights ready={false} onDone={onDone} />);
    expect(screen.getByTestId("v2-turn-lights").props.pointerEvents).toBe("none");
    await advance(TURN_LIGHTS.down + 400);
    expect(opacityOf("v2-turn-lights")).toBe(1);
    expect(onDone).not.toHaveBeenCalled();
    // The photo is there: catch, dip, up.
    await act(() => screen.rerender(<TurnLights ready onDone={onDone} />));
    await advance(TURN_LIGHTS.dark + 16);
    await advance(LIGHTS.catch + LIGHTS.dip + LIGHTS.up + 40);
    expect(opacityOf("v2-turn-lights")).toBe(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("with the photo already there (preloaded), the whole turn is about half a second", async () => {
    const onDone = jest.fn();
    await render(<TurnLights ready onDone={onDone} />);
    await advance(TURN_LIGHTS.down + TURN_LIGHTS.dark + LIGHTS.catch + LIGHTS.dip + LIGHTS.up + 30);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(TURN_LIGHTS.down + TURN_LIGHTS.dark + LIGHTS.catch + LIGHTS.dip + LIGHTS.up).toBeLessThanOrEqual(520);
  });

  it("never waits in the dark longer than it must: a photo that won't come, it lights anyway", async () => {
    const onDone = jest.fn();
    await render(<TurnLights ready={false} onDone={onDone} />);
    await advance(TURN_LIGHTS.wait + TURN_LIGHTS.dark + LIGHTS.catch + LIGHTS.dip + LIGHTS.up + 60);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("turned again before the light was up, it starts in the dark", async () => {
    await render(<TurnLights ready={false} fromDark onDone={() => {}} />);
    expect(opacityOf("v2-turn-lights")).toBe(1);
  });

  it("is nothing with reduced motion: the next photo is simply there", async () => {
    const onDone = jest.fn();
    await render(<ThemeProvider reducedMotion><TurnLights ready={false} onDone={onDone} /></ThemeProvider>);
    expect(screen.queryByTestId("v2-turn-lights")).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
