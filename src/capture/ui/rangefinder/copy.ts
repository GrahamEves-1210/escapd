// 02 · Camera: the words on the camera and its accessibility labels
// (docs/DESIGN.md 02), in plain language: photos, Arabic numerals, "Review
// your photos"; no film or darkroom words. Pure functions of the photos taken
// and the roll's prompts (one per photo in its plan: 5 on 0.5x, 6 on 1x), so
// the screen and its tests share one source. The photo prompts themselves
// live in src/capture/slots.ts: the 360's turns, or in retake mode the view
// and where to aim.
import { MIN_PLATES, OVERLAP_DETAIL, placePrompt, promptFor, type PlatePrompt } from "@/capture/slots";
import type { LibraryImportProgress } from "@/capture/useLibraryImport";

export const COPY = {
  close: "Close the camera",
  cancelRetake: "Cancel retake",
  // Taking a photo the player removed (an open slot on the review screen).
  cancelFill: "Back to your photos",
  library: "Choose photos from your library",
  libraryRetake: "Choose a photo instead",
  // Every photo in the plan taken (5 on 0.5x, 6 on 1x).
  fullTitle: "All the way round",
  fullDetail: "Review your photos.",
  privacy: "Keep faces out of the shot.",
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
  // A disabled shutter once every photo is taken: it names the action without claiming a photo.
  shutterFull: "Take a photo",
  // The turn dial: announced once a turn is far enough (the light tick's words).
  turnReached: "Far enough. Take the photo.",
  // On 1x six photos 60 degrees apart only just meet (src/capture/turn.ts):
  // the turn prompts' detail says so instead of asking for overlap.
  edgeDetail: "Start where the last photo ended.",
  // On 1x where the phone has 0.5: a note on the feed pointing to it.
  lensNote: "On 1.0 the photos only just meet. Switch to 0.5 to overlap them.",
} as const;

/**
 * `index` is the slot about to be taken (zero-based): the first open slot
 * outside retake mode (the plan's count once every photo is in), the retaken
 * slot in it. `prompts`: the roll's, one per photo in its plan. `filling`: retake mode on a slot the player emptied (a first take).
 * `taken`: photos filled now (defaults to `index`, as with no open slots).
 * `inTurn` (default true): the player stands at the photo before this one,
 * having just taken it, so the turn prompts apply; false places the photo by
 * its neighbours instead (`filled`: which slots hold a photo). `edgeToEdge`:
 * the lens's photos only just meet (1x), so the turn can't keep part of the
 * last photo in view.
 */
export interface RollPosition {
  index: number;
  prompts: readonly PlatePrompt[];
  retake: boolean;
  filling?: boolean;
  taken?: number;
  inTurn?: boolean;
  filled?: readonly boolean[];
  edgeToEdge?: boolean;
}

const isFull = ({ index, retake, prompts }: RollPosition) => !retake && index >= prompts.length;
const takenOf = (at: RollPosition) => at.taken ?? Math.min(at.index, at.prompts.length);

/**
 * Header title and subtitle: the photo's turn prompt, or the lines once every
 * photo in the plan is taken. In retake mode, and whenever the player isn't standing at the photo
 * before (`inTurn` false), the turn prompts don't apply, so it names the view
 * and where to aim ("Back right" / "From the middle, aim between photos 2 and
 * 4."). No "Retake." prefix: the counter carries it.
 */
export function promptCopy(at: RollPosition): { title: string; detail: string } {
  if (isFull(at)) return { title: COPY.fullTitle, detail: COPY.fullDetail };
  if (at.retake || at.inTurn === false) return placePrompt(at.index, at.prompts, at.filled);
  const { title, detail } = promptFor(at.index, at.prompts);
  return { title, detail: at.edgeToEdge && detail === OVERLAP_DETAIL ? COPY.edgeDetail : detail };
}

/**
 * The turn dial's words: "Photo 2 of 5" for the photo about to be taken (the
 * retaken one in retake mode), "5 of 5 taken" once all are, counted against
 * the plan. Its screen-reader label adds when a turn has gone far enough.
 */
export function turnCopy(at: RollPosition, reached: boolean): { line: string; accessibilityLabel: string } {
  const shots = at.prompts.length;
  if (isFull(at)) {
    const line = `${takenOf(at)} of ${shots} taken`;
    return { line, accessibilityLabel: `${line}, all the way round.` };
  }
  const line = `Photo ${promptFor(at.index, at.prompts).numeral} of ${shots}`;
  return { line, accessibilityLabel: reached ? `${line}. ${COPY.turnReached}` : `${line}.` };
}

/**
 * The counter: which numeral is current (the photo about to be taken; the
 * last once every photo is taken; the retaken photo, alone, in retake mode),
 * plus the full sentence for screen readers, counted against the plan.
 */
export function counterCopy(at: RollPosition): { current: number; numeral: string; solo: boolean; accessibilityLabel: string } {
  const shots = at.prompts.length;
  const current = Math.min(at.index, shots - 1);
  const { numeral } = promptFor(current, at.prompts);
  if (at.retake) return { current, numeral, solo: true, accessibilityLabel: `${at.filling ? "Taking" : "Retaking"} photo ${numeral}.` };
  if (isFull(at)) return { current, numeral, solo: false, accessibilityLabel: `${takenOf(at)} of ${shots} photos taken. That's all the way round.` };
  return { current, numeral, solo: false, accessibilityLabel: `Next: photo ${numeral}. ${takenOf(at)} of ${shots} photos taken.` };
}

/** "Take photo 3, Keep turning"; "Retake photo 2, Front right" in retake mode (the view's name). */
export function shutterLabel(at: RollPosition): string {
  if (isFull(at)) return COPY.shutterFull;
  const { numeral } = promptFor(at.index, at.prompts);
  return `${at.retake && !at.filling ? "Retake" : "Take"} photo ${numeral}, ${promptCopy(at).title}`;
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
