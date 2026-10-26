// The capture flow's colours by role (MODES_PROMPT.md Part 2: "capture →
// light table → darkroom, all tinted to the mode"): the photo guide (04),
// the camera permission (03), the camera (02),
// the review screen (07) and the build wait (06), all read through
// useCapturePalette(), never ref.color directly, so one place decides how a
// mode tints them.
//
// In the shell (no mode) every role is the colour these screens had before
// the modes, so they look exactly as they did. Inside a mode (openCapture({
// genre }) sets it) the roles come from that mode's theme (useModeTheme()):
// - grounds: the camera, review and build wait sit on the mode's `surface`
//   (where the shell's #101010 was), the guide and every well (the
//   viewfinder, the counter, the zoom track) on its `ground` (the shell's
//   black), so the shell's one step between them stays;
// - raised controls on `raised`, text in `ink` and `inkMuted`, edges `rim`;
// - the primary button (03's pill, 04's step button, and the same pill on
//   07 and 06) in `accent` with `accentInk`;
// - stamps (06's BUILDING / CASE READY), the counter's current numeral and
//   the camera's way-on ring in `stamp`;
// - 03's white paper sheet becomes the mode's dark sheet (`surface` over
//   `ground`, its panel `raised`, the phone drawn in `ground`).
// Photos take the mode's baked treatment through TreatedImage (`genre`).
// Neutral instrument greys (the shutter disk, the × halo, the framing grid,
// the warning amber) stay as they are in every mode.
import type { Genre } from "@/lib/puzzle-types";
import { useModeTheme } from "@/game/mode";
import { ref, type ModeTheme } from "@/theme/tokens";

export interface CapturePalette {
  /** The mode whose photo treatment the flow shows; null in the shell (photos as they are). */
  readonly genre: Genre | null;
  /**
   * True in the shell: 03 is pushr's white paper (dark status bar glyphs, the
   * kit's paper pills and thinking line, the grey haze). False in a mode,
   * where 03 is the mode's dark sheet.
   */
  readonly paper: boolean;

  // The dark screens (02, 04, 06, 07).
  /** The flat ground of the camera, the review screen and the build wait. */
  readonly page: string;
  /** The guide's ground and the wells: the empty viewfinder, the counter pill, the zoom track, an image's well. */
  readonly well: string;
  /** Raised controls: square buttons, the zoom thumb, tip discs, loading tiles, notes. */
  readonly raised: string;
  readonly ink: string;
  readonly inkMuted: string;
  /** 1 pt edges: tiles, the strip's photos, the stamp in the shell. */
  readonly rim: string;
  /** The square header buttons' 1 pt rim. */
  readonly squareRim: string;
  /** The zoom segment's thumb. */
  readonly thumb: string;
  /** The shutter ring and the last photo's frame (02's near-black rims). */
  readonly frame: string;
  /** The primary button's fill and its label. */
  readonly primary: string;
  readonly onPrimary: string;
  /** Stamp text (06's BUILDING / CASE READY) and its edge. */
  readonly stamp: string;
  readonly stampRim: string;
  /** The counter's current numeral. */
  readonly lit: string;
  /** The camera's way-on ring round the last photo (MIN_PLATES or more). */
  readonly cue: string;

  // 04 · Photo guide.
  /** The instruction under each step's title. */
  readonly guideBody: string;
  /** The glass close disc's fill and its X: a light disc with a dark glyph. */
  readonly closeFill: string;
  readonly closeGlyph: string;

  // 03 · Camera permission.
  readonly sheetGround: string;
  readonly sheet: string;
  /** The illustration panel across the sheet's top, and the phone's open screen. */
  readonly panel: string;
  /** The title. */
  readonly sheetInk: string;
  /** The body and the notice. */
  readonly sheetMuted: string;
  /** The notice's Warning glyph. */
  readonly noticeGlyph: string;
  /** The phone outline, and the lights drawn on it (at the panel's opacities). */
  readonly phone: string;
  readonly phoneLight: string;
}

const C = ref.color;

/** The shell: the reference look's colours, exactly as these screens had them. */
const SHELL: CapturePalette = {
  genre: null,
  paper: true,
  page: C.ground,
  well: C.void,
  raised: C.raised,
  ink: C.textPrimary,
  inkMuted: C.textSecondary,
  rim: C.rim,
  squareRim: ref.layout.camera.squareRim,
  thumb: ref.button.segment.thumbFill,
  frame: C.well,
  // The guide's dark hairline pill (ref.button.ghost; ModePill draws the kit's own PillButton in the shell).
  primary: ref.button.ghost.fill,
  onPrimary: ref.button.ghost.label,
  stamp: C.textLabel,
  stampRim: C.rim,
  lit: C.textPrimary,
  cue: ref.layout.camera.cue.color,
  guideBody: ref.layout.guide.bodyText,
  closeFill: ref.button.dismissGlass.fill,
  closeGlyph: ref.button.dismissGlass.glyph,
  sheetGround: C.paper,
  sheet: C.paper,
  panel: C.panel,
  sheetInk: C.inkDisplay,
  sheetMuted: C.inkMuted,
  noticeGlyph: C.raised,
  phone: C.inkDisplay,
  phoneLight: C.illustrationBevel,
};

function fromTheme(theme: ModeTheme): CapturePalette {
  return {
    genre: theme.genre,
    paper: false,
    page: theme.surface,
    well: theme.ground,
    raised: theme.raised,
    ink: theme.ink,
    inkMuted: theme.inkMuted,
    rim: theme.rim,
    squareRim: theme.rim,
    thumb: theme.raised,
    frame: theme.ground,
    primary: theme.accent,
    onPrimary: theme.accentInk,
    stamp: theme.stamp,
    stampRim: theme.stamp,
    lit: theme.stamp,
    cue: theme.stamp,
    guideBody: theme.inkMuted,
    // Still a light disc with a dark X, in the mode's muted ink (4.5:1 or more against its ground).
    closeFill: theme.inkMuted,
    closeGlyph: theme.ground,
    sheetGround: theme.ground,
    sheet: theme.surface,
    panel: theme.raised,
    sheetInk: theme.ink,
    sheetMuted: theme.inkMuted,
    noticeGlyph: theme.ink,
    phone: theme.ground,
    phoneLight: theme.inkMuted,
  };
}

const MODES = new Map<ModeTheme, CapturePalette>();

/** The capture flow's colours for a theme: the shell's own, or the mode's. One object per theme, so styles built from it stay stable. */
export function capturePalette(theme: ModeTheme): CapturePalette {
  if (theme.genre === null) return SHELL;
  let palette = MODES.get(theme);
  if (!palette) {
    palette = fromTheme(theme);
    MODES.set(theme, palette);
  }
  return palette;
}

/** The capture flow's colours in the active mode (the shell's when there is none). */
export function useCapturePalette(): CapturePalette {
  return capturePalette(useModeTheme());
}
