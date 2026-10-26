import { useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { createGestureController, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { useSharedValue } from "react-native-reanimated";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { ScenePager, loopDelta, wheelOrder, wrapIndex } from "../ScenePager";

const mockFeedback = {
  tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(),
  paper: jest.fn(), pickup: jest.fn(), wrongCode: jest.fn(), unlock: jest.fn(), stamp: jest.fn(), solved: jest.fn(),
  shutter: jest.fn(), typewriter: jest.fn(),
};
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const WH = ref.layout.play.wheel;
const G = ref.layout.play.pager;
const W = 393;
const hidden = { includeHiddenElements: true } as const;

type Animated = { opacity?: number; transform?: Record<string, number | string>[] };
const animated = (testID: string, nth = 0): Animated =>
  (screen.getAllByTestId(testID, hidden)[nth].props.jestAnimatedStyle as { value?: Animated } | undefined)?.value ?? {};
const translateX = (testID: string, nth = 0) => Number(animated(testID, nth).transform?.find((t) => "translateX" in t)?.translateX ?? 0);
/** Where a wheel slot's thumbnail sits, `d` views off centre round the drum. */
const drumX = (d: number) => WH.drum * Math.sin((d * WH.step * Math.PI) / 180);

const advance = (ms: number) => act(async () => {
  jest.advanceTimersByTime(ms);
});

/** One frame: Reanimated's mappers run on the next animation frame. */
const frame = () => advance(16);

const onChange = jest.fn();

function Host({ count, start, disabled }: { count: number; start: number; disabled?: boolean }) {
  const [index, setIndex] = useState(start);
  const pageable = useSharedValue(true);
  return (
    <ScenePager
      count={count}
      index={index}
      onIndexChange={(i) => {
        onChange(i);
        setIndex(i);
      }}
      marked={[]}
      pageable={pageable}
      disabled={disabled}
      renderPage={(i, active) => <View testID={active ? `photo-${i}-active` : `photo-${i}`} />}
      renderThumb={(i) => <View testID={`thumb-photo-${i}`} />}
    />
  );
}

async function renderPager(count: number, start = 0, { reducedMotion = false, disabled = false } = {}) {
  await render(
    <GestureHandlerRootView>
      <ThemeProvider reducedMotion={reducedMotion}>
        <Host count={count} start={start} disabled={disabled} />
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
  await fireEvent(screen.getByTestId("scene-pager"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: W, height: 540 } } });
  await frame();
}

const value = () => screen.getByTestId("view-wheel").props.accessibilityValue.text as string;
const act11y = (actionName: string) => fireEvent(screen.getByTestId("view-wheel"), "accessibilityAction", { nativeEvent: { actionName } });
/** The photo in a wheel slot (left, current, right ...). */
const thumbIn = (slot: string) => {
  const ids = within(screen.getByTestId(`view-wheel-${slot}`, hidden)).getAllByTestId(/^view-thumb-\d+(-current)?$/, hidden);
  return Number(/view-thumb-(\d+)/.exec(ids[0].props.testID)![1]);
};

/** A swipe: down, `dx` sideways at `velocityX`, then (unless `hold`) up. */
async function swipe(dx: number, { velocityX = 0, hold = false } = {}) {
  const pan = createGestureController(getByGestureTestId("scene-swipe"));
  await act(() => {
    pan.begin({ translationX: 0, velocityX: 0 });
    pan.activate({ translationX: Math.sign(dx) * (G.activeOffset + 1), velocityX });
    pan.update({ translationX: dx, velocityX });
    if (!hold) pan.end({ translationX: dx, velocityX });
  });
  await frame();
  return pan;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("the loop's arithmetic", () => {
  it("wraps indices and takes the shortest way round", () => {
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(loopDelta(2, 0, 3)).toBe(1);
    expect(loopDelta(0, 2, 3)).toBe(-1);
    expect(loopDelta(0, 1, 2)).toBe(1);
  });

  it("orders the wheel far left, left, current, right, far right, round the loop", () => {
    expect(wheelOrder(0, 3)).toEqual([1, 2, 0, 1, 2]);
    expect(wheelOrder(2, 3)).toEqual([0, 1, 2, 0, 1]);
    expect(wheelOrder(0, 2)).toEqual([0, 1, 0, 1, 0]);
  });
});

describe("ScenePager: round the loop", () => {
  it("goes from the last view to the first with a swipe, the first sliding in from the right with no jump", async () => {
    await renderPager(3, 2);
    // View 1 is mounted beside view 3, one page to its right.
    expect(screen.getByTestId("photo-2-active")).toBeTruthy();
    expect(translateX("scene-page-0")).toBe(W);
    expect(translateX("scene-page-1")).toBe(-W);
    // Mid-swipe: the row follows the finger, view 1 half in.
    const pan = await swipe(-W / 2, { hold: true });
    expect(translateX("scene-page-0")).toBeCloseTo(W / 2, 3);
    expect(translateX("scene-page-2")).toBeCloseTo(-W / 2, 3);
    await act(() => pan.end({ translationX: -W / 2, velocityX: 0 }));
    await frame();
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    // It settles onto view 1, always moving the same way: no snap-back.
    const seen: number[] = [];
    for (let t = 0; t < G.maxDuration + 64; t += 16) {
      seen.push(translateX("scene-page-0"));
      await advance(16);
    }
    for (let k = 1; k < seen.length; k++) expect(seen[k]).toBeLessThanOrEqual(seen[k - 1] + 0.001);
    expect(translateX("scene-page-0")).toBeCloseTo(0, 3);
    expect(screen.getByTestId("photo-0-active")).toBeTruthy();
    expect(value()).toBe("1 of 3");
  });

  it("goes from the first view back to the last with a swipe the other way", async () => {
    await renderPager(3, 0);
    expect(translateX("scene-page-2")).toBe(-W);
    await swipe(W * 0.6);
    await advance(G.maxDuration + 32);
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(translateX("scene-page-2")).toBeCloseTo(0, 3);
    expect(value()).toBe("3 of 3");
  });

  it("wraps the accessibility actions both ways", async () => {
    await renderPager(3, 2);
    await act11y("increment");
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(value()).toBe("1 of 3");
    await act11y("decrement");
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(value()).toBe("3 of 3");
    expect(mockFeedback.tick).toHaveBeenCalledTimes(2);
  });

  it("with two views, the other one is on both sides and either swipe reaches it", async () => {
    await renderPager(2, 0);
    expect(thumbIn("left")).toBe(1);
    expect(thumbIn("right")).toBe(1);
    expect(screen.getAllByTestId("photo-1", hidden)).toHaveLength(2);
    await swipe(-W * 0.6);
    await advance(G.maxDuration + 32);
    expect(onChange).toHaveBeenLastCalledWith(1);
    await swipe(-W * 0.6);
    await advance(G.maxDuration + 32);
    expect(onChange).toHaveBeenLastCalledWith(0);
    await swipe(W * 0.6);
    await advance(G.maxDuration + 32);
    expect(onChange).toHaveBeenLastCalledWith(1);
    await act11y("increment");
    expect(value()).toBe("1 of 2");
    expect(thumbIn("current")).toBe(0);
  });

  it("with one view nothing loops: no wheel, and a swipe resists and comes back", async () => {
    await renderPager(1, 0);
    expect(screen.queryByTestId("view-wheel")).toBeNull();
    expect(screen.getAllByTestId(/^scene-page-/, hidden)).toHaveLength(1);
    const pan = await swipe(-100, { hold: true });
    expect(translateX("scene-page-0")).toBeCloseTo(-100 * G.edgeResistance, 3);
    await act(() => pan.end({ translationX: -100, velocityX: 0 }));
    await advance(G.maxDuration + 32);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("doesn't step while disabled", async () => {
    await renderPager(3, 0, { disabled: true });
    await act11y("increment");
    await fireEvent.press(screen.getByTestId("view-wheel-next"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ScenePager: the thumbnail wheel", () => {
  it("shows the view in view in the middle, its neighbours round the loop either side, larger in the middle and dimmer outside", async () => {
    await renderPager(4, 0);
    expect(thumbIn("current")).toBe(0);
    expect(thumbIn("left")).toBe(3);
    expect(thumbIn("right")).toBe(1);
    expect(thumbIn("far-left")).toBe(2);
    expect(thumbIn("far-right")).toBe(2);
    // The thumbnail is the page's own photo (the caller's renderThumb).
    expect(within(screen.getByTestId("view-wheel-left")).getByTestId("thumb-photo-3")).toBeTruthy();
    const scaleOf = (slot: string) => Number(animated(`view-wheel-${slot}`).transform?.find((t) => "scale" in t)?.scale);
    expect(translateX("view-wheel-current")).toBeCloseTo(0, 5);
    expect(translateX("view-wheel-left")).toBeCloseTo(-drumX(1), 3);
    expect(translateX("view-wheel-right")).toBeCloseTo(drumX(1), 3);
    expect(scaleOf("current")).toBe(1);
    expect(scaleOf("right")).toBeCloseTo(WH.neighbourScale, 5);
    expect(animated("view-wheel-right").transform).toContainEqual({ rotateY: `${WH.step * WH.tilt}deg` });
    expect(animated("view-wheel-far-right").opacity).toBe(0);
  });

  it("turns with the finger, on the swipe's own position, before the page settles", async () => {
    await renderPager(3, 0);
    await swipe(-W / 4, { hold: true });
    // A quarter of the way to view 2: the drum is a quarter step round.
    expect(translateX("view-wheel-current")).toBeCloseTo(-drumX(0.25), 3);
    expect(translateX("view-wheel-right")).toBeCloseTo(drumX(0.75), 3);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("goes to a neighbour when it is tapped, round the loop", async () => {
    await renderPager(3, 0);
    await fireEvent.press(screen.getByTestId("view-wheel-previous"));
    expect(onChange).toHaveBeenLastCalledWith(2);
    await advance(G.maxDuration + 32);
    expect(thumbIn("current")).toBe(2);
    expect(thumbIn("right")).toBe(0);
    expect(translateX("view-wheel-current")).toBeCloseTo(0, 3);
    await fireEvent.press(screen.getByTestId("view-wheel-next"));
    expect(onChange).toHaveBeenLastCalledWith(0);
    // The tap strips are big enough to hit, and the middle is left to the photo.
    expect(((WH.span - WH.width) / 2)).toBeGreaterThanOrEqual(ref.hit.min);
  });

  it("under Reduce Motion, neither the pages nor the drum follow the finger; the wheel just updates", async () => {
    await renderPager(3, 0, { reducedMotion: true });
    // A thumbnail is only ever at rest, a whole number of views round the drum.
    const rest = [-2, -1, 0, 1, 2].map(drumX);
    const pan = await swipe(-(G.reducedSwipe + 1), { hold: true });
    expect(translateX("scene-page-0")).toBe(0);
    expect(translateX("view-wheel-current")).toBe(0);
    await act(() => pan.end({ translationX: -(G.reducedSwipe + 1), velocityX: 0 }));
    await frame();
    expect(onChange).toHaveBeenLastCalledWith(1);
    // Every frame the drum is at rest: no turn between.
    for (let t = 0; t < motion.reducedFade + 64; t += 8) {
      for (const slot of ["left", "current", "right"]) {
        const x = translateX(`view-wheel-${slot}`);
        expect(rest.some((r) => Math.abs(r - x) < 0.001)).toBe(true);
      }
      await advance(8);
    }
    expect(thumbIn("current")).toBe(1);
    expect(translateX("view-wheel-current")).toBeCloseTo(0, 5);
    expect(translateX("scene-page-1")).toBeCloseTo(0, 5);
  });
});
