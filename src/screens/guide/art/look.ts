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

/** One margin note per step, in her hand. */
export const NOTES: readonly string[] = ["any wall is fine!", "a little overlap helps", "nearly there...", "the cat waits outside"];

/** The note: its size, where it sits on the art box (from its top right), and its lean. */
export const NOTE = { fontSize: 18, lineHeight: 22, top: -6, right: -18, turn: "6deg", maxWidth: 120 } as const;
