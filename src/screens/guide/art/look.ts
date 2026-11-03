// The photo guide's small delights (docs/ART_DIRECTION.md: cute but clear,
// nothing cluttered): a soft pool of the theme's glow behind each drawing, as
// if lit by her lamp, and a short handwritten note in the theme's sweet
// colour beside it, leaning as if scribbled in the margin. The notes are
// flavour only (the title and body carry each step), so screen readers skip
// them with the drawing.

/** The glow behind the drawing: its radius as a share of the art box's width, and its stops. */
export const GLOW = {
  r: 0.95,
  stops: [
    { offset: 0, opacity: 0.16 },
    { offset: 0.55, opacity: 0.06 },
    { offset: 1, opacity: 0 },
  ],
} as const;

/**
 * One margin note per step, in her hand, broken into its lines here: no line
 * is left to the text layout, whose measure of the handwriting can come up a
 * glyph short on a phone and cut the end off ("the cat waits outsi").
 */
export const NOTES: readonly string[] = ["any wall is fine!", "a little overlap\nhelps", "nearly there...", "the cat waits\noutside"];

/**
 * The note: its size, where it sits on the art box (from its top right), its
 * lean, and its box: a fixed `width` with `pad` to spare at the right for the
 * hand's overhang, wider than its longest line ("a little overlap", about
 * 112 at 18), shrinking to `minScale` before anything is cut.
 */
export const NOTE = { fontSize: 18, lineHeight: 22, top: -6, right: -18, turn: "6deg", width: 136, pad: 6, lines: 2, minScale: 0.8, maxFontScale: 1.2 } as const;
