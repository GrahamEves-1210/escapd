// Photo instructions for a room (the code still calls each photo a plate; the
// player only ever sees "photo"). The player stands in the middle of the room
// and turns all the way round, a photo at each stop, so together the photos
// go the whole way round (docs/DESIGN.md 02 and 04). How far each turn is
// comes from the lens (src/capture/turn.ts); the stops are slots, in order,
// clockwise from the first photo.
//
// Counts match private.app_config: at least 3, at most 6 (the storage trigger
// refuses a 7th), and the camera aims at all 6, the full turn. `numeral` is
// what the player sees for each photo: Arabic numerals, on the camera's
// counter and everywhere else.
export const MIN_PLATES = 3;
export const MAX_PLATES = 6;
export const RECOMMENDED_PLATES = MAX_PLATES;

export interface PlatePrompt {
  numeral: string;
  /** Where the photo looks, from where the player stands: the review screen's tile name. */
  name: string;
  /** The camera's title while this photo is next: what to do. */
  title: string;
  /** The camera's grey line under it. */
  detail: string;
}

const OVERLAP = "Keep part of the last photo in view.";

export const PLATE_PROMPTS: readonly PlatePrompt[] = [
  { numeral: "1", name: "Start", title: "Start here", detail: "Stand in the middle. Face any wall." },
  { numeral: "2", name: "Front right", title: "Turn right a little", detail: OVERLAP },
  { numeral: "3", name: "Back right", title: "Keep turning", detail: OVERLAP },
  { numeral: "4", name: "Behind", title: "Halfway round", detail: "You're facing away from photo 1." },
  { numeral: "5", name: "Back left", title: "Nearly round", detail: OVERLAP },
  { numeral: "6", name: "Front left", title: "Last turn", detail: "After this one, you're back at the start." },
];

export function promptFor(index: number): PlatePrompt {
  return PLATE_PROMPTS[Math.min(Math.max(index, 0), PLATE_PROMPTS.length - 1)];
}

/**
 * Retaking (or filling) one photo out of order: the turn prompts no longer
 * apply, so the camera names the view and where to aim, between the photos
 * either side of it round the circle (photo 1 sits between 6 and 2).
 */
export function retakePrompt(index: number): { title: string; detail: string } {
  const { name } = promptFor(index);
  const at = PLATE_PROMPTS.indexOf(promptFor(index));
  const count = PLATE_PROMPTS.length;
  const before = PLATE_PROMPTS[(at - 1 + count) % count].numeral;
  const after = PLATE_PROMPTS[(at + 1) % count].numeral;
  return { title: name, detail: `From the middle, aim between photos ${before} and ${after}.` };
}
