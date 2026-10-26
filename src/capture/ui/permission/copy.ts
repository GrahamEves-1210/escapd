// 03 · Camera permission copy, in plain language (photos, "build the case";
// no film or darkroom words, nothing alarming). Written
// in sentence case, which is what screen readers hear; the screen sets every
// visible line in lowercase, as the reference does (textTransform for text,
// lowercased strings for the drawn thinking lines). Every control label starts
// with a verb.

/** The sheet's two copy sets. A switch between them crossfades the text. */
export type PermissionCopyKey = "default" | "denied";

export const PERMISSION_COPY: Record<PermissionCopyKey, { title: string; body: string; action: string }> = {
  default: {
    // The space in "the camera" is a non-breaking space (U+00A0), so the
    // title sets as "let escapd use / the camera" and never strands "camera".
    title: "Let ESCAPD use the camera",
    body:
      "You'll take 3 to 6 photos of one room. Each photo's location is removed on your phone first, and nothing is sent until you build the case.",
    action: "Allow the camera",
  },
  denied: {
    title: "The camera is off",
    body: "ESCAPD can't ask again from here. Turn on Camera for ESCAPD in Settings, or choose photos you've already taken.",
    action: "Open Settings",
  },
};

export const COPY = {
  /** Quiet buttons. */
  choosePhotos: "Choose photos instead",
  choosePhoto: "Choose a photo instead",
  lightTable: "Review your photos",
  /** Checking past ~1 s: the line and its accessibility label. */
  checking: "Opening the camera",
  /** Library busy: the container's fixed label, and the real progress line. */
  busyLabel: "Preparing your photos",
  busyLine: (current: number, total: number) => `Preparing photo ${current} of ${total}`,
  /** Library partial (fewer than 3 photos taken). */
  partial: (photos: number) => `${photos} ${photos === 1 ? "photo" : "photos"} taken. A case needs at least 3.`,
  libraryError: "One of those photos couldn't be used. Try another.",
  requestError: "The camera didn't answer. Try again.",
} as const;
