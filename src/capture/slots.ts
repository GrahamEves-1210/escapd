// Plate instructions for a first room. Counts match private.app_config:
// at least 3, at most 6, and the camera aims at 4.
export const MIN_PLATES = 3;
export const MAX_PLATES = 6;
export const RECOMMENDED_PLATES = 4;

export interface PlatePrompt {
  numeral: string;
  title: string;
  detail: string;
}

export const PLATE_PROMPTS: readonly PlatePrompt[] = [
  { numeral: "I", title: "From the doorway", detail: "Wide. Include the floor and two walls." },
  { numeral: "II", title: "Opposite corner", detail: "Overlap the first plate." },
  { numeral: "III", title: "The busiest wall", detail: "The wall with the most objects." },
  { numeral: "IV", title: "A close view", detail: "A desk, shelf, or table." },
  { numeral: "V", title: "Another angle", detail: "Optional. Anything still unseen." },
  { numeral: "VI", title: "Last plate", detail: "Optional. One more overlap." },
];

export function promptFor(index: number): PlatePrompt {
  return PLATE_PROMPTS[Math.min(Math.max(index, 0), PLATE_PROMPTS.length - 1)];
}
