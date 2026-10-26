// A stamp's word is text, so it keeps text's contrast as it is drawn, not
// only as its colour is defined: the stamp colour at every opacity on the
// way up from the word (the stamp's own, its fade-in, the word's), blended
// over the fills a stamp sits on. 11 pt CONTRADICTED is small text (4.5:1)
// on a suspect card or an Accuse radio card (raised) and on the mode's
// ground; 34 pt GUILTY and CASE CLOSED are large text (3:1).
import type { ReactElement } from "react";
import { StyleSheet } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import type { Genre } from "@/lib/puzzle-types";
import { GENRES, setMode } from "@/game/mode";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import { Stamp } from "../Stamp";

type Rgb = [number, number, number];
type Node = ReturnType<typeof screen.getByText>;

function rgba(hex: string): { rgb: Rgb; alpha: number } {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!m) throw new Error(`not a hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as Rgb, alpha: m[2] ? parseInt(m[2], 16) / 255 : 1 };
}

const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const blend = (fg: Rgb, bg: Rgb, alpha: number) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as Rgb;

/** Every opacity a host view or text applies on the way up from `node`, animated values included. */
function drawnOpacity(node: Node): number {
  let opacity = 1;
  for (let n: Node | null = node; n; n = n.parent) {
    if (typeof n.type !== "string") continue;
    const animated = (n.props.jestAnimatedStyle as { value?: { opacity?: number } } | undefined)?.value?.opacity;
    const own = StyleSheet.flatten(n.props.style)?.opacity;
    opacity *= typeof animated === "number" ? animated : typeof own === "number" ? own : 1;
  }
  return opacity;
}

/** The word's colour, as drawn over `fill`. */
function drawnOver(word: Node, fill: string): number {
  const { rgb, alpha } = rgba(StyleSheet.flatten(word.props.style).color as string);
  const bg = rgba(fill).rgb;
  return contrast(blend(rgb, bg, alpha * drawnOpacity(word)), bg);
}

async function stamp(genre: Genre, element: ReactElement, { reduced = false } = {}) {
  setMode(genre);
  return render(<ThemeProvider reducedMotion={reduced}>{element}</ThemeProvider>);
}

afterEach(() => {
  setMode(null);
  jest.useRealTimers();
});

describe("Stamp: the word's contrast as drawn", () => {
  it.each(GENRES)("%s: CONTRADICTED (small) reads at 4.5:1 on a card's raised fill and on the ground", async (genre) => {
    const theme = modeThemes[genre];
    await stamp(genre, <Stamp text="Contradicted" testID="s" />);
    const word = screen.getByText("Contradicted");
    expect(drawnOpacity(word)).toBe(1);
    expect(drawnOver(word, theme.raised)).toBeGreaterThanOrEqual(4.5);
    expect(drawnOver(word, theme.ground)).toBeGreaterThanOrEqual(4.5);
    expect(drawnOver(word, theme.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GENRES)("%s: GUILTY and CASE CLOSED (large) read at 3:1 at rest", async (genre) => {
    const theme = modeThemes[genre];
    await stamp(genre, <Stamp text="Guilty" size="large" testID="s" />);
    const word = screen.getByText("Guilty");
    expect(drawnOver(word, theme.raised)).toBeGreaterThanOrEqual(3);
    expect(drawnOver(word, theme.ground)).toBeGreaterThanOrEqual(3);
  });

  it.each([false, true])("a slammed stamp lands at full strength (reduced motion: %s)", async (reduced) => {
    jest.useFakeTimers();
    const theme = modeThemes.crime_scene;
    const onLanded = jest.fn();
    await stamp("crime_scene", <Stamp text="Guilty" size="large" slam delay={0} onLanded={onLanded} testID="s" />, { reduced });
    await act(() => jest.advanceTimersByTime(ref.layout.play.stamp.slam * 4));
    expect(screen.getByTestId("s")).toHaveAnimatedStyle({ opacity: 1 });
    expect(drawnOver(screen.getByText("Guilty"), theme.raised)).toBeGreaterThanOrEqual(4.5);
  });

  it("inks only the frame: the frame is short of solid, in the stamp colour, the word is not", async () => {
    const theme = modeThemes.crime_scene;
    const S = ref.layout.play.stamp;
    await stamp("crime_scene", <Stamp text="Contradicted" testID="s" />);
    expect(StyleSheet.flatten(screen.getByTestId("s-frame").props.style)).toMatchObject({
      borderColor: theme.stamp,
      borderWidth: S.border,
      opacity: S.opacity,
    });
    expect(StyleSheet.flatten(screen.getByText("Contradicted").props.style)).toMatchObject({ color: theme.stamp });
    expect(drawnOpacity(screen.getByText("Contradicted"))).toBe(1);
  });
});
