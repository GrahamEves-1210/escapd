// The guide's words (docs/DESIGN.md 04, Steps and Tappable elements). The
// steps paraphrase the plate plan in src/capture/slots.ts (plates I to IV) and
// the light table's checklist; the camera's title and subtitle then echo them.

export interface GuideStep {
  /** At most 24 characters: one line at the 317 column. */
  title: string;
  /** At most 70 characters: two lines at the 317 column. */
  body: string;
}

export const STEPS: readonly GuideStep[] = [
  { title: "Start at the doorway", body: "One wide plate. Get the floor and two walls in." },
  { title: "Work around the room", body: "The far corner, then the busiest wall. Let plates overlap." },
  { title: "Get one close view", body: "A desk, shelf, or table. Small things make good clues." },
  { title: "Keep the case private", body: "No people, mail, or lit screens. Lights on, hold steady." },
];

export const LAST_STEP = STEPS.length - 1;

/** The mono step stamp, e.g. "BEFORE YOU SHOOT  ·  1 OF 4" (two spaces each side of the dot). */
export const stampText = (step: number) => `BEFORE YOU SHOOT  ·  ${step + 1} OF ${STEPS.length}`;

/** What a screen reader hears for the stamp. */
export const stampLabel = (step: number) => `Before you shoot. Step ${step + 1} of ${STEPS.length}`;

/** Announced when the screen opens and after every step change. */
export const stepAnnouncement = (step: number) => `Step ${step + 1} of ${STEPS.length}`;

export const COPY = {
  next: "Next",
  openCamera: "Open the camera",
  // Close: a first run skips the guide to the camera; a replay returns to the hub.
  skip: "Skip the guide",
  close: "Close the guide",
  // Replay wait (one non-rotating thinking line, after ~1 s) and Replay error.
  checkingLines: ["Checking the file"],
  checkingLabel: "Checking access",
  checkError: "Couldn't reach the darkroom. Try again.",
} as const;
