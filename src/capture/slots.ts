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

/** The turn prompts' detail where neighbours overlap (0.5x); the camera words 1x's turn edge to edge instead. */
export const OVERLAP_DETAIL = "Keep part of the last photo in view.";
const OVERLAP = OVERLAP_DETAIL;

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
 * A photo out of turn: a retake, an open slot left by a removed photo, or the
 * next slot when the player isn't standing at the photo before it (the camera
 * was reopened, photos came from the library, or the last one was removed).
 * The turn prompts ("Turn right a little") only work from the photo before,
 * so this names the view and places it by its neighbours round the circle
 * (photo 1 sits between 6 and 2). With `filled` (which slots hold a photo) it
 * names only neighbours that exist: between both, right of the one before or
 * left of the one after; without it, or with neither, both.
 */
export function placePrompt(index: number, filled?: readonly boolean[]): { title: string; detail: string } {
  const { name } = promptFor(index);
  const at = PLATE_PROMPTS.indexOf(promptFor(index));
  const count = PLATE_PROMPTS.length;
  const beforeAt = (at - 1 + count) % count;
  const afterAt = (at + 1) % count;
  const before = PLATE_PROMPTS[beforeAt].numeral;
  const after = PLATE_PROMPTS[afterAt].numeral;
  const hasBefore = filled?.[beforeAt] === true;
  const hasAfter = filled?.[afterAt] === true;
  if (hasBefore && !hasAfter) return { title: name, detail: `From the middle, face photo ${before}'s view, then turn right a little.` };
  if (hasAfter && !hasBefore) return { title: name, detail: `From the middle, face photo ${after}'s view, then turn left a little.` };
  return { title: name, detail: `From the middle, aim between photos ${before} and ${after}.` };
}
