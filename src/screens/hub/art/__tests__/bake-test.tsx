import type { ReactElement } from "react";
import { PixelRatio, StyleSheet } from "react-native";
import { getAnimatedStyle } from "react-native-reanimated";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as skia from "@shopify/react-native-skia";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import { bakeCover, clearCovers, peekCover } from "../bake";
import { drawCover } from "../draw";
import { ModeCover } from "../ModeCover";

// The drawing is the covers' own business: here it only records what it was asked to draw.
jest.mock("../draw", () => ({ drawCover: jest.fn() }));

const draw = jest.mocked(drawCover);
const mock = (skia as unknown as {
  __skia: { draws: { op: string; surface: number; sx?: number; sy?: number }[]; surfaces: { width: number; height: number }[]; typefaces: string[]; reset(): void };
}).__skia;
const hidden = { includeHiddenElements: true } as const;
const CARD = { w: 343, h: 201.5, scale: 3 };

const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
const animatedStyleOf = getAnimatedStyle as unknown as (node: unknown) => { opacity?: number };
/** What the cover's canvas draws: its one <Image>'s props. */
const drawn = () => {
  const [image] = screen.container.queryAll((node) => (node.type as unknown) === "SkiaImage");
  return image?.props as Record<string, unknown> | undefined;
};
/** A frame's worth of time. */
const frame = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(16);
  });

function renderCover(ui: ReactElement, reducedMotion = false) {
  return render(<ThemeProvider reducedMotion={reducedMotion}>{ui}</ThemeProvider>);
}

/** Lays the cover's frame out at the card's size. */
async function layout(testID = "cover", size: { w: number; h: number } = CARD) {
  await fireEvent(screen.getByTestId(testID, hidden), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: size.w, height: size.h } } });
}

beforeEach(() => {
  clearCovers();
  mock.reset();
  draw.mockClear();
  jest.spyOn(PixelRatio, "get").mockReturnValue(CARD.scale);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("bakeCover", () => {
  it("draws the mode's cover once, at the frame's size in pixels, on a canvas scaled to points, with the grotesk", async () => {
    const image = await bakeCover("noir", CARD);
    expect(image).not.toBeNull();
    expect(draw).toHaveBeenCalledTimes(1);
    const [lib, , genre, theme, size, fonts] = draw.mock.calls[0];
    expect(lib).toBe(skia);
    expect(genre).toBe("noir");
    expect(theme).toBe(modeThemes.noir);
    // 343 x 201.5 pt at 3x: 1029 x 605 px (rounded), drawn in points.
    expect(mock.surfaces[0]).toMatchObject({ width: 1029, height: 605 });
    expect(size).toEqual({ w: 1029 / 3, h: 605 / 3, scale: 3 });
    expect(mock.draws[0]).toMatchObject({ op: "scale", sx: 3, sy: 3 });
    // Archivo ExtraBold, the police tape's face.
    expect(fonts.grotesk).toMatchObject({ kind: "typeface" });
    expect(mock.typefaces).toHaveLength(1);
  });

  it("keeps each cover: a second request for the same mode and size doesn't draw again; another size or mode does", async () => {
    const first = await bakeCover("crime_scene", CARD);
    // Two at once share one bake.
    const [again, twin] = await Promise.all([bakeCover("crime_scene", CARD), bakeCover("crime_scene", { ...CARD })]);
    expect(again).toBe(first);
    expect(twin).toBe(first);
    expect(peekCover("crime_scene", CARD)).toBe(first);
    expect(draw).toHaveBeenCalledTimes(1);

    await bakeCover("crime_scene", { ...CARD, h: 260 });
    await bakeCover("paranormal", CARD);
    await bakeCover("crime_scene", { ...CARD, scale: 2 });
    expect(draw).toHaveBeenCalledTimes(4);
    // The typeface is loaded once for every cover.
    expect(mock.typefaces).toHaveLength(1);
  });

  it("bakes nothing for an empty frame, and tries again after a failed bake", async () => {
    expect(await bakeCover("noir", { w: 0, h: 200, scale: 3 })).toBeNull();
    expect(draw).not.toHaveBeenCalled();

    draw.mockImplementationOnce(() => {
      throw new Error("drawing failed");
    });
    expect(await bakeCover("noir", CARD)).toBeNull();
    expect(peekCover("noir", CARD)).toBeUndefined();
    expect(await bakeCover("noir", CARD)).not.toBeNull();
    expect(draw).toHaveBeenCalledTimes(2);
  });
});

describe("ModeCover", () => {
  it("shows the mode's surface until it is laid out and baked, then fades the cover in on ref.motion.treatment", async () => {
    jest.useFakeTimers();
    await renderCover(<ModeCover genre="paranormal" testID="cover" />);
    const frame = screen.getByTestId("cover", hidden);
    expect(styleOf(frame)).toMatchObject({ backgroundColor: modeThemes.paranormal.surface, overflow: "hidden" });
    // Decorative.
    expect(frame.props.accessibilityElementsHidden).toBe(true);
    expect(frame.props.importantForAccessibility).toBe("no-hide-descendants");
    // Nothing is baked before the frame has a size.
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(draw).not.toHaveBeenCalled();
    expect(drawn()).toBeUndefined();

    await layout();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(draw).toHaveBeenCalledTimes(1);
    const cover = screen.getByTestId("cover-cover", hidden);
    expect(drawn()).toMatchObject({ image: peekCover("paranormal", CARD), x: 0, y: 0, width: CARD.w, height: CARD.h, fit: "cover" });
    expect(animatedStyleOf(cover).opacity).toBe(0);
    await act(async () => {
      jest.advanceTimersByTime(ref.motion.treatment.duration / 2);
    });
    const mid = animatedStyleOf(cover).opacity!;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    await act(async () => {
      jest.advanceTimersByTime(ref.motion.treatment.duration);
    });
    expect(animatedStyleOf(cover).opacity).toBe(1);
  });

  it("under reduced motion the cover is simply there once baked", async () => {
    jest.useFakeTimers();
    await renderCover(<ModeCover genre="noir" testID="cover" />, true);
    await layout();
    await frame();
    expect(drawn()).toBeDefined();
    expect(animatedStyleOf(screen.getByTestId("cover-cover", hidden)).opacity).toBe(1);
  });

  it("shows a cover baked before straight away, with no fade, and never draws it again", async () => {
    await bakeCover("crime_scene", CARD);
    jest.useFakeTimers();
    await renderCover(<ModeCover genre="crime_scene" testID="cover" />);
    await layout();
    await frame();
    const cover = screen.getByTestId("cover-cover", hidden);
    expect(animatedStyleOf(cover).opacity).toBe(1);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it("keeps the cover it has while a new size bakes, then swaps it in", async () => {
    jest.useFakeTimers();
    await renderCover(<ModeCover genre="noir" testID="cover" />, true);
    await layout();
    await frame();
    const before = peekCover("noir", CARD);
    expect(drawn()).toMatchObject({ image: before, height: CARD.h });
    await layout("cover", { w: CARD.w, h: 300 });
    // Still the first size's cover, drawn to cover the new frame.
    expect(drawn()).toMatchObject({ image: before, height: 300, fit: "cover" });
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    const after = peekCover("noir", { ...CARD, h: 300 });
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
    expect(drawn()).toMatchObject({ image: after, height: 300 });
    expect(draw).toHaveBeenCalledTimes(2);
  });
});
