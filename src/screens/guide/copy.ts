// The guide's words (docs/DESIGN.md 04, Steps and Tappable elements), in plain
// language (photos, no film or darkroom words) and as friendly tips. The steps
// teach the 360 in src/capture/slots.ts (stand in the middle, turn a little
// between photos, all the way round) and the review screen's tips; the
// camera's prompts and its turn dial then echo them.

export interface GuideStep {
  /** One line of ref.type.stepTitle (Bold 22) in the 317 column; two at most. */
  title: string;
  /** At most two lines of ref.type.stepBody (Regular 22) in the 317 column. */
  body: string;
}

export const STEPS: readonly GuideStep[] = [
  { title: "Stand in the middle", body: "Face any wall and take the first photo." },
  { title: "Turn right, shoot again", body: "Turn a little. Keep part of the last photo in view." },
  { title: "All the way round", body: "The camera shows each turn until you're back at the start." },
  { title: "Just the room", body: "Keep faces out of the shot. Lights on, hold steady." },
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
  skip: "Back to the menu",
  // The access check when the guide was opened directly (one non-rotating
  // thinking line, after ~1 s), and its error.
  checkingLines: ["Getting the camera ready"],
  checkingLabel: "Checking access",
  checkError: "Couldn't connect. Try again.",
} as const;
