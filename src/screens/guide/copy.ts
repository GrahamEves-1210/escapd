// The guide's words (docs/DESIGN.md 04, Steps and Tappable elements), in plain
// language (photos, no film or darkroom words) and as friendly tips. The steps
// paraphrase the photo plan in src/capture/slots.ts (photos 1 to 4) and the
// review screen's tips; the camera's title and subtitle then echo them.

export interface GuideStep {
  /** One line of ref.type.stepTitle (Bold 22) in the 317 column; two at most. */
  title: string;
  /** At most two lines of ref.type.stepBody (Regular 22) in the 317 column. */
  body: string;
}

export const STEPS: readonly GuideStep[] = [
  { title: "Start at the doorway", body: "One wide photo. Get the floor and two walls in." },
  { title: "Work around the room", body: "The far corner, then the busiest wall. Let photos overlap." },
  { title: "Get one close view", body: "A desk, shelf, or table. Small things make good clues." },
  { title: "Just the room", body: "Leave out people, mail, and screens. Lights on, hold steady." },
];

export const LAST_STEP = STEPS.length - 1;

/**
 * Where the player is, for screen readers only (the reference shows no step
 * count): announced when the screen opens and after every step change, and
 * the step button's accessibility hint.
 */
export const stepAnnouncement = (step: number) => `Step ${step + 1} of ${STEPS.length}`;

export const COPY = {
  next: "Next",
  openCamera: "Open the camera",
  // The X: like the last step, it continues to the camera.
  skip: "Skip to the camera",
  // The access check when the guide was opened directly (one non-rotating
  // thinking line, after ~1 s), and its error.
  checkingLines: ["Getting the camera ready"],
  checkingLabel: "Checking access",
  checkError: "Couldn't connect. Try again.",
} as const;
