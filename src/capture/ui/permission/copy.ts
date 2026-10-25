// 03 · Camera permission copy, exactly as docs/DESIGN.md writes it. Sentence
// case throughout; every control label starts with a verb.

/** The sheet's two copy sets. A switch between them crossfades the text. */
export type PermissionCopyKey = "default" | "denied";

export const PERMISSION_COPY: Record<PermissionCopyKey, { title: string; body: string; action: string }> = {
  default: {
    // The space in "the camera" is a non-breaking space (U+00A0), so the
    // title sets as "Let ESCAPD use / the camera" and never strands "camera".
    title: "Let ESCAPD use the camera",
    body:
      "You'll photograph three to six views of one room. Each photo is re-encoded on your phone first, so its location never leaves it. Nothing is sent until you develop the case.",
    action: "Allow the camera",
  },
  denied: {
    title: "The camera is off",
    body: "ESCAPD can't ask again from here. Turn on Camera for ESCAPD in Settings, or choose photos you've already taken.",
    action: "Open Settings",
  },
};

export const COPY = {
  /** The back arrow's accessibility labels (02's labels). */
  close: "Close the camera",
  cancelRetake: "Cancel retake",
  /** Quiet buttons. */
  choosePhotos: "Choose photos instead",
  choosePhoto: "Choose a photo instead",
  lightTable: "Go to the light table",
  /** Checking past ~1 s: the line and its accessibility label. */
  checking: "Opening the rangefinder",
  /** Library busy: the container's fixed label, and the real progress line. */
  busyLabel: "Re-encoding your photos",
  busyLine: (current: number, total: number) => `Re-encoding photo ${current} of ${total}`,
  /** Library partial (fewer than 3 plates on the roll). */
  partial: (plates: number) => `${plates} ${plates === 1 ? "plate" : "plates"} on the roll. A case needs at least three.`,
  libraryError: "One of those photos couldn't be used. Try another.",
  requestError: "The camera didn't answer. Try again.",
} as const;
