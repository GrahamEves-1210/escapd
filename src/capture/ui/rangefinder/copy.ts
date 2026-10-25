// 02 · Camera: the words on the rangefinder and its accessibility labels
// (docs/DESIGN.md 02). Pure functions of the roll, so the screen and its tests
// share one source. Plate prompts themselves live in src/capture/slots.ts.
import { MAX_PLATES, MIN_PLATES, promptFor } from "@/capture/slots";
import type { LibraryImportProgress } from "@/capture/useLibraryImport";

export const COPY = {
  close: "Close the camera",
  cancelRetake: "Cancel retake",
  library: "Choose photos from your library",
  libraryRetake: "Choose a photo instead",
  fullTitle: "Six plates is a full roll",
  fullDetail: "Continue to the light table.",
  privacy: "Keep people, mail, and lit screens out of frame.",
  captureError: "That plate didn't take. Try again.",
  mountError: "The camera didn't start.",
  flash: "Flash",
  grid: "Framing grid",
  lens: "Lens",
  ultraWide: "Ultra-wide lens",
  mainLens: "Main lens",
  // The "×" (U+00D7) always shows, so nothing reflows when the lens changes.
  ultraWideLabel: "0.5×",
  mainLensLabel: "1×",
  // A disabled shutter on a full roll: it names the action without claiming a plate.
  shutterFull: "Take a plate",
  counterPlate: "PLATE",
  counterFull: "FULL",
  counterRetake: "RETAKE",
} as const;

/**
 * `index` is the plate about to be taken (zero-based): the plate count outside
 * retake mode (MAX_PLATES when the roll is full), the retaken plate in it.
 */
export interface RollPosition {
  index: number;
  retake: boolean;
}

const isFull = ({ index, retake }: RollPosition) => !retake && index >= MAX_PLATES;

/** Header title and subtitle: the plate prompt, or the full-roll lines. No "Retake." prefix: the counter carries it. */
export function promptCopy(at: RollPosition): { title: string; detail: string } {
  if (isFull(at)) return { title: COPY.fullTitle, detail: COPY.fullDetail };
  const { title, detail } = promptFor(at.index);
  return { title, detail };
}

/** The 72 counter window: a mono label over the Roman numeral, plus the full sentence for screen readers. */
export function counterCopy(at: RollPosition): { label: string; numeral: string; accessibilityLabel: string } {
  const { numeral } = promptFor(at.index);
  if (at.retake) return { label: COPY.counterRetake, numeral, accessibilityLabel: `Retaking plate ${numeral}.` };
  if (isFull(at)) return { label: COPY.counterFull, numeral, accessibilityLabel: `Roll full. ${at.index} of ${MAX_PLATES} plates taken.` };
  return { label: COPY.counterPlate, numeral, accessibilityLabel: `Next: plate ${numeral}. ${at.index} of ${MAX_PLATES} plates taken.` };
}

/** "Take plate III, The busiest wall"; "Retake plate II, Opposite corner" in retake mode. */
export function shutterLabel(at: RollPosition): string {
  if (isFull(at)) return COPY.shutterFull;
  const { numeral, title } = promptFor(at.index);
  return `${at.retake ? "Retake" : "Take"} plate ${numeral}, ${title}`;
}

const plates = (count: number) => `${count} ${count === 1 ? "plate" : "plates"}`;

/** The last-plate thumbnail: the light table, with the continue wording from MIN_PLATES; "Cancel retake" in retake mode. */
export function lastPlateLabel(plateCount: number, retake: boolean): string {
  if (retake) return COPY.cancelRetake;
  return plateCount >= MIN_PLATES
    ? `Continue to the light table, ${plates(plateCount)}`
    : `Open the light table, ${plates(plateCount)}`;
}

/** The library error line follows the failure count; the photos that worked have joined the roll. */
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
 * retake: "Preparing plate III". Two or more picks: "Preparing photo 2 of 4",
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
  const line = `Preparing plate ${numeral}`;
  return { line, accessibilityLabel: line };
}
