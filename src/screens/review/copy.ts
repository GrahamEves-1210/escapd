// The review screen's words (/capture/review, titled "Photos"), in plain
// language: photos, "Build the case", Arabic numerals; no film or darkroom
// words, nothing alarming, AI never mentioned. Tips read as friendly advice.
import type { RetakeReason, SetIssue } from "@/capture/failure";
import type { PlatePrompt } from "@/capture/slots";

export const COPY = {
  back: "Back",
  backLabel: "Back to the camera",
  title: "Photos",
  heading: "Your photos",
  caption: (count: number, max: number) => `${count} of ${max}. Retake anything dark, blurred, or too close to read the room.`,
  add: "Add a photo",
  hint: "Tap a photo to retake it",
  // A flagged photo's reason, under its label (and in its tile's label).
  reasons: {
    person: "Someone's in this shot",
    private_text: "Mail, a document, or a screen is readable",
    person_private_text: "Someone's in this shot, and some text is readable",
    unreadable: "This photo couldn't be read",
    general: "May show a person or something private",
  } satisfies Record<RetakeReason, string>,
  // A slot the player emptied.
  openTile: "Take this photo",
  // A failure about the whole set, as a note at the top when the build sent the player back.
  issues: {
    too_few_objects: "The case needs a little more to work with. Add a close view of a desk, shelf, or table, then build again.",
    didnt_come_together: "The case didn't come together from these photos. Clear photos from different corners help.",
    couldnt_use: "These photos couldn't be used. Try photos that leave out people, documents, and screens.",
    photo_missing: "A photo didn't come through. Retake it or choose another, then build again.",
  } satisfies Record<SetIssue, string>,
  checksTitle: "Before you build",
  checks: ["Keep people out of the shot.", "Tuck away mail, documents, and screens.", "Turn the lights on and hold steady."],
  privacy: "Your photos are only used to build your case. No one else sees them.",
  develop: "Build the case",
  flaggedHelp: "Retake the marked photos, then build the case.",
  tooFew: (min: number) => `Take at least ${min} photos to build the case.`,
} as const;

/**
 * The label over a tile: "1 · From the doorway". The last word is held to the
 * one before it (a no-break space), so a two-line label breaks as the
 * reference's do ("1 · From / the doorway"), never leaving a lone short word.
 */
export const plateLabel = (prompt: PlatePrompt) => `${prompt.numeral} · ${prompt.title.replace(/ (\S+)$/, " $1")}`;
/** The same label for screen readers, which read "·" badly. */
export const plateLabelSpoken = (prompt: PlatePrompt) => `Photo ${prompt.numeral}, ${prompt.title}`;
export const retakeLabel = (prompt: PlatePrompt) => `Retake photo ${prompt.numeral}`;
export const removeLabel = (prompt: PlatePrompt) => `Remove photo ${prompt.numeral}`;
/** An open slot's tile: "Take photo 2, Opposite corner. This photo is open." */
export const fillLabel = (prompt: PlatePrompt) => `Take photo ${prompt.numeral}, ${prompt.title}. This photo is open.`;
