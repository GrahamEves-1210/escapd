// The capture flow's palette (src/capture/ui/palette.ts): the shell keeps
// every colour these screens had before the modes; a mode's palette comes
// from its theme only; every text pairing it creates reads at 4.5:1 or more
// (3:1 for the non-text edges it relies on).
import { renderHook, act } from "@testing-library/react-native";
import { setMode, GENRES } from "@/game/mode";
import { modeThemes, ref, shellTheme } from "@/theme/tokens";
import { capturePalette, useCapturePalette } from "../palette";

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("capture palette", () => {
  it("keeps the shell as the capture screens were before the modes, with 03's sheet dark", () => {
    const shell = capturePalette(shellTheme);
    expect(shell).toMatchObject({
      genre: null,
      paper: false,
      page: ref.color.ground,
      well: ref.color.void,
      raised: ref.color.raised,
      ink: ref.color.textPrimary,
      inkMuted: ref.color.textSecondary,
      rim: ref.color.rim,
      squareRim: ref.layout.camera.squareRim,
      thumb: ref.button.segment.thumbFill,
      frame: ref.button.shutter.ringFill,
      primary: ref.button.ghost.fill,
      onPrimary: ref.button.ghost.label,
      stamp: ref.color.textLabel,
      lit: ref.color.textPrimary,
      cue: ref.layout.camera.cue.color,
      guideBody: ref.layout.guide.bodyText,
      closeFill: ref.button.dismissGlass.fill,
      closeGlyph: ref.button.dismissGlass.glyph,
      sheetGround: ref.color.void,
      sheet: ref.color.ground,
      panel: ref.color.raised,
      sheetInk: ref.color.textPrimary,
      sheetMuted: ref.color.textSecondary,
      phone: ref.color.void,
      phoneLight: ref.color.textSecondary,
    });
    // The shell's primary is the photo guide's own pill everywhere (round 6).
    expect(shell.primary).toBe(ref.button.ghost.fill);
  });

  it.each(GENRES)("takes %s's colours from its theme only", (genre) => {
    const theme = modeThemes[genre];
    const palette = capturePalette(theme);
    expect(palette).toMatchObject({
      genre,
      paper: false,
      page: theme.surface,
      well: theme.ground,
      raised: theme.raised,
      ink: theme.ink,
      inkMuted: theme.inkMuted,
      primary: theme.accent,
      onPrimary: theme.accentInk,
      stamp: theme.stamp,
      lit: theme.stamp,
      cue: theme.stamp,
      sheetGround: theme.ground,
      sheet: theme.surface,
      panel: theme.raised,
      sheetInk: theme.ink,
      sheetMuted: theme.inkMuted,
    });
    // One object per theme, so styles built from it stay stable.
    expect(capturePalette(theme)).toBe(palette);
  });

  it.each(GENRES)("reads at 4.5:1 or more wherever %s's capture flow sets text", (genre) => {
    const p = capturePalette(modeThemes[genre]);
    const text: [string, string, string][] = [
      ["ink on page", p.ink, p.page],
      ["muted ink on page", p.inkMuted, p.page],
      ["ink on the guide's ground", p.ink, p.well],
      ["guide body on its ground", p.guideBody, p.well],
      ["ink on raised", p.ink, p.raised],
      ["muted ink on the clock well", p.inkMuted, p.well],
      ["label on the primary button", p.onPrimary, p.primary],
      ["stamp on page", p.stamp, p.page],
      ["counter numeral on its well", p.lit, p.well],
      ["X on the close disc", p.closeGlyph, p.closeFill],
      ["sheet title", p.sheetInk, p.sheet],
      ["sheet body", p.sheetMuted, p.sheet],
    ];
    for (const [name, fg, bg] of text) expect({ name, ok: contrast(fg, bg) >= 4.5 }).toEqual({ name, ok: true });
    // Edges that carry meaning on their own: the way-on ring against its
    // frame, the close disc against its ground. (The primary button is named
    // by its label, 4.5:1 on its fill; crime scene's deep red fill sits at
    // about 2.5:1 on its ground, the user's chosen range.)
    expect(contrast(p.cue, p.frame)).toBeGreaterThanOrEqual(3);
    expect(contrast(p.closeFill, p.well)).toBeGreaterThanOrEqual(3);
  });

  it("follows the active mode", async () => {
    const { result } = await renderHook(() => useCapturePalette());
    expect(result.current.genre).toBeNull();
    await act(() => setMode("crime_scene"));
    expect(result.current).toBe(capturePalette(modeThemes.crime_scene));
    await act(() => setMode(null));
    expect(result.current).toBe(capturePalette(shellTheme));
  });
});
