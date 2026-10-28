// The review screen's words (/capture/review, "Your photos"), in plain
// language: photos, "Build the case", Arabic numerals; no film or darkroom
// words, nothing alarming, AI never mentioned. Tips read as friendly advice.
// The photos are one turn round the room (src/capture/slots.ts): each tile is
// named by where it looks from the middle ("Front right"), the camera's
// numeral before it.
import type { RetakeReason, SetIssue } from "@/capture/failure";
import type { PlatePrompt } from "@/capture/slots";

export const COPY = {
  backLabel: "Back to the camera",
  title: "Your photos",
  /**
   * The header's grey meta line, under the title (the camera's plate detail).
   * "photos", not "taken": some may have been chosen from the library.
   */
  count: (count: number, max: number) => `${count} of ${max} photos`,
  /** The same for screen readers, with the header. */
  countSpoken: (count: number, max: number) => `${count} of ${max} photos`,
  lead: "Retake anything dark or blurred. Together they should go all the way round.",
  /** The lead with no photos yet: nothing to retake. */
  leadEmpty: "No photos yet. Stand in the middle of the room and take them turning all the way round.",
  add: "Add a photo",
  hint: "Tap a photo to retake it",
  // A flagged photo's reason, under its name (and in its tile's label).
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
    too_few_objects:
      "The case needs a little more to work with. Turn the lights on and retake from the middle of the room. If a photo is open, use it for a close view of a busy desk or shelf.",
    didnt_come_together: "The case didn't come together from these photos. Clear photos, turning all the way round the room, help.",
    couldnt_use: "These photos couldn't be used. Try photos that leave out people, documents, and screens.",
    photo_missing: "A photo didn't come through. Retake it or choose another, then build again.",
  } satisfies Record<SetIssue, string>,
  checksTitle: "Before you build",
  checks: ["Stand in the middle and turn all the way round.", "Keep faces out of the shot.", "Turn the lights on and hold steady."],
  privacy: "Your photos are only used to build your case. No one else sees them.",
  develop: "Build the case",
  flaggedHelp: "Retake the marked photos, then build the case.",
  tooFew: (min: number) => `Take at least ${min} photos to build the case.`,
} as const;

/**
 * A photo's name under its tile: where it looks, "Front right", after its
 * numeral. The last word is held to the one before it (a no-break space), so
 * a name that wraps never leaves a lone short word.
 */
export const plateName = (prompt: PlatePrompt) => prompt.name.replace(/ (\S+)$/, " $1");
/** The photo's label for screen readers, which read a lone numeral badly. */
export const plateLabelSpoken = (prompt: PlatePrompt) => `Photo ${prompt.numeral}, ${prompt.name}`;
export const retakeLabel = (prompt: PlatePrompt) => `Retake photo ${prompt.numeral}`;
export const removeLabel = (prompt: PlatePrompt) => `Remove photo ${prompt.numeral}`;
/** An open slot's tile: "Take photo 2, Front right. This photo is open." */
export const fillLabel = (prompt: PlatePrompt) => `Take photo ${prompt.numeral}, ${prompt.name}. This photo is open.`;
