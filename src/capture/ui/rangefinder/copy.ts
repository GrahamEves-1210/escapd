// 02 · Camera: the words on the camera and its accessibility labels
// (docs/DESIGN.md 02), in plain language: photos, Arabic numerals, "Review
// your photos"; no film or darkroom words. Pure functions of the photos taken,
// so the screen and its tests share one source. The photo prompts themselves
// live in src/capture/slots.ts.
import { MAX_PLATES, MIN_PLATES, promptFor } from "@/capture/slots";
import type { LibraryImportProgress } from "@/capture/useLibraryImport";

export const COPY = {
  close: "Close the camera",
  cancelRetake: "Cancel retake",
  // Taking a photo the player removed (an open slot on the review screen).
  cancelFill: "Back to your photos",
  library: "Choose photos from your library",
  libraryRetake: "Choose a photo instead",
  fullTitle: "6 photos is the most a case takes",
  fullDetail: "Review your photos.",
  privacy: "Keep people, mail, and screens out of the shot.",
  captureError: "That photo didn't take. Try again.",
  mountError: "The camera didn't start.",
  flash: "Flash",
  grid: "Framing grid",
  lens: "Lens",
  ultraWide: "Ultra-wide lens",
  mainLens: "Main lens",
  // Once's segment: "0.5" and "1.0", the chosen one followed by an xmark
  // (drawn); the iOS large-content viewer names it with " ×" (U+00D7).
  ultraWideLabel: "0.5",
  mainLensLabel: "1.0",
  lensMark: " ×",
  // A disabled shutter at 6 photos: it names the action without claiming a photo.
  shutterFull: "Take a photo",
} as const;

/**
 * `index` is the slot about to be taken (zero-based): the first open slot
 * outside retake mode (MAX_PLATES once all 6 are filled), the retaken slot in
 * it. `filling`: retake mode on a slot the player emptied (a first take).
 * `taken`: photos filled now (defaults to `index`, as with no open slots).
 */
export interface RollPosition {
  index: number;
  retake: boolean;
  filling?: boolean;
  taken?: number;
}

const isFull = ({ index, retake }: RollPosition) => !retake && index >= MAX_PLATES;
const takenOf = (at: RollPosition) => at.taken ?? Math.min(at.index, MAX_PLATES);

/** Header title and subtitle: the photo's prompt, or the lines once 6 are taken. No "Retake." prefix: the counter carries it. */
export function promptCopy(at: RollPosition): { title: string; detail: string } {
  if (isFull(at)) return { title: COPY.fullTitle, detail: COPY.fullDetail };
  const { title, detail } = promptFor(at.index);
  return { title, detail };
}

/**
 * The counter: which numeral is current (the photo about to be taken; 6 once
 * 6 are taken; the retaken photo, alone, in retake mode), plus the full
 * sentence for screen readers.
 */
export function counterCopy(at: RollPosition): { current: number; numeral: string; solo: boolean; accessibilityLabel: string } {
  const current = Math.min(at.index, MAX_PLATES - 1);
  const { numeral } = promptFor(current);
  if (at.retake) return { current, numeral, solo: true, accessibilityLabel: `${at.filling ? "Taking" : "Retaking"} photo ${numeral}.` };
  if (isFull(at)) return { current, numeral, solo: false, accessibilityLabel: `${takenOf(at)} of ${MAX_PLATES} photos taken. That's the most a case takes.` };
  return { current, numeral, solo: false, accessibilityLabel: `Next: photo ${numeral}. ${takenOf(at)} of ${MAX_PLATES} photos taken.` };
}

/** "Take photo 3, The busiest wall"; "Retake photo 2, Opposite corner" in retake mode. */
export function shutterLabel(at: RollPosition): string {
  if (isFull(at)) return COPY.shutterFull;
  const { numeral, title } = promptFor(at.index);
  return `${at.retake && !at.filling ? "Retake" : "Take"} photo ${numeral}, ${title}`;
}

const photos = (count: number) => `${count} ${count === 1 ? "photo" : "photos"}`;

/**
 * The last-photo thumbnail: the review screen ("Photos"). From MIN_PLATES it
 * also says the case is ready to build; "Cancel retake" in retake mode.
 */
export function lastPlateLabel(plateCount: number, retake: boolean, filling = false): string {
  if (retake) return filling ? COPY.cancelFill : COPY.cancelRetake;
  return plateCount >= MIN_PLATES
    ? `Review your photos, ${photos(plateCount)} taken. Ready to build.`
    : `Review your photos, ${photos(plateCount)} taken`;
}

/** The library error line follows the failure count; the photos that worked have been added. */
export function libraryError(failed: number): string {
  return failed === 1 ? "One photo couldn't be used." : `${failed} photos couldn't be used.`;
}

export interface ThinkingCopy {
  /** The visible line: real progress only. */
  line: string;
  /** The fixed status for screen readers, not re-announced on each count. */
  accessibilityLabel: string;
  /** The longest line this wait can show, so the box never resizes. */
  sizeTo?: readonly string[];
}

/**
 * The busy wait's thinking line. A capture, a single library pick or any
 * retake: "Preparing photo 3". Two or more picks: "Preparing photo 2 of 4",
 * counted from the import's real progress.
 */
export function thinkingCopy(progress: LibraryImportProgress | null, numeral: string): ThinkingCopy {
  if (progress && progress.total > 1) {
    const { total } = progress;
    const current = Math.min(progress.done + 1, total);
    return {
      line: `Preparing photo ${current} of ${total}`,
      accessibilityLabel: `Preparing ${total} photos`,
      sizeTo: [`Preparing photo ${total} of ${total}`],
    };
  }
  const line = `Preparing photo ${numeral}`;
  return { line, accessibilityLabel: line };
}
