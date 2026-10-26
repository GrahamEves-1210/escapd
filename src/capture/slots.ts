// Photo instructions for a room (the code still calls each photo a plate; the
// player only ever sees "photo"). Counts match private.app_config: at least
// 3, at most 6, and the camera aims at 4. `numeral` is what the player sees
// for each photo: Arabic numerals, on the camera's counter and everywhere else.
export const MIN_PLATES = 3;
export const MAX_PLATES = 6;
export const RECOMMENDED_PLATES = 4;

export interface PlatePrompt {
  numeral: string;
  title: string;
  detail: string;
}

export const PLATE_PROMPTS: readonly PlatePrompt[] = [
  { numeral: "1", title: "From the doorway", detail: "Wide. Include the floor and two walls." },
  { numeral: "2", title: "Opposite corner", detail: "Overlap the first photo." },
  { numeral: "3", title: "The busiest wall", detail: "The wall with the most objects." },
  { numeral: "4", title: "A close view", detail: "A desk, shelf, or table." },
  { numeral: "5", title: "Another angle", detail: "Optional. Anything still unseen." },
  { numeral: "6", title: "Last photo", detail: "Optional. One more overlap." },
];

export function promptFor(index: number): PlatePrompt {
  return PLATE_PROMPTS[Math.min(Math.max(index, 0), PLATE_PROMPTS.length - 1)];
}
