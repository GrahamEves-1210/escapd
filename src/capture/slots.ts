// Photo instructions for a room (the code still calls each photo a plate; the
// player only ever sees "photo"). The player stands in the middle of the room
// and turns all the way round, a photo at each stop, so together the photos
// go the whole way round (docs/DESIGN.md 02 and 04). How many photos and how
// far each turn is come from the lens (src/capture/turn.ts); the stops are
// slots, in order, clockwise from the first photo, and each photo's name and
// turn prompt follow from its stop.
//
// Counts match private.app_config: at least 3, at most 6 (the storage trigger
// refuses a 7th). The roll aims at its plan's count (src/capture/turn.ts:
// 5 on 0.5x, 6 on 1x), the full turn; MAX_PLATES is only the server's cap.
// `numeral` is what the player sees for each photo: Arabic numerals, on the
// camera's counter and everywhere else.
export const MIN_PLATES = 3;
export const MAX_PLATES = 6;

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

/** Compass names round the player, every 45 degrees clockwise from the start. */
const VIEW_NAMES = ["Front", "Front right", "Right", "Back right", "Behind", "Back left", "Left", "Front left"] as const;

/** A stop within this of 180 degrees is "Halfway round": facing away from photo 1. */
const HALFWAY = 20;

/** A view's name from its stop: "Start" for photo 1, otherwise the nearest compass name. */
function viewName(deg: number, index: number): string {
  if (index === 0) return "Start";
  return VIEW_NAMES[Math.round((((deg % 360) + 360) % 360) / 45) % VIEW_NAMES.length];
}

function turnWords(deg: number, index: number, count: number): Pick<PlatePrompt, "title" | "detail"> {
  if (index === 0) return { title: "Start here", detail: "Stand in the middle. Face any wall." };
  if (index === count - 1) return { title: "Last turn", detail: "After this one, you're back at the start." };
  if (index === 1) return { title: "Turn right a little", detail: OVERLAP };
  if (Math.abs(deg - 180) <= HALFWAY) return { title: "Halfway round", detail: "You're facing away from photo 1." };
  return deg < 180 ? { title: "Keep turning", detail: OVERLAP } : { title: "Nearly round", detail: OVERLAP };
}

/**
 * The prompts for a roll's stops (the plan's, src/capture/turn.ts), one per
 * photo in slot order. Six photos 60 apart: Start · Front right · Back right ·
 * Behind · Back left · Front left, turning "Start here" · "Turn right a
 * little" · "Keep turning" · "Halfway round" · "Nearly round" · "Last turn".
 * Five 72 apart: Start · Right · Back right · Back left · Left, turning
 * "Start here" · "Turn right a little" · "Keep turning" · "Nearly round" ·
 * "Last turn".
 */
export function platePrompts(stops: readonly number[]): PlatePrompt[] {
  return stops.map((deg, i) => ({ numeral: String(i + 1), name: viewName(deg, i), ...turnWords(deg, i, stops.length) }));
}

/** This slot's prompt; past the last, the last one's (the camera once every photo is taken). */
export function promptFor(index: number, prompts: readonly PlatePrompt[]): PlatePrompt {
  return prompts[Math.min(Math.max(index, 0), prompts.length - 1)];
}

/**
 * A photo out of turn: a retake, an open slot left by a removed photo, or the
 * next slot when the player isn't standing at the photo before it (the camera
 * was reopened, photos came from the library, or the last one was removed).
 * The turn prompts ("Turn right a little") only work from the photo before,
 * so this names the view and places it by its neighbours round the circle
 * (photo 1 sits between the last and 2). With `filled` (which slots hold a
 * photo) it names only neighbours that exist: between both, right of the one
 * before or left of the one after; without it, or with neither, both.
 */
export function placePrompt(index: number, prompts: readonly PlatePrompt[], filled?: readonly boolean[]): { title: string; detail: string } {
  const count = prompts.length;
  const at = Math.min(Math.max(index, 0), count - 1);
  // Named by its number, never "Left" or "Behind".
  const name = `Photo ${prompts[at].numeral}`;
  const beforeAt = (at - 1 + count) % count;
  const afterAt = (at + 1) % count;
  const before = prompts[beforeAt].numeral;
  const after = prompts[afterAt].numeral;
  const hasBefore = filled?.[beforeAt] === true;
  const hasAfter = filled?.[afterAt] === true;
  if (hasBefore && !hasAfter) return { title: name, detail: `From the middle, face photo ${before}'s view, then turn right a little.` };
  if (hasAfter && !hasBefore) return { title: name, detail: `From the middle, face photo ${after}'s view, then turn left a little.` };
  return { title: name, detail: `From the middle, aim between photos ${before} and ${after}.` };
}
