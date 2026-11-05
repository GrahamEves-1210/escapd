// What a letter is given to show (src/play2/letters): the words are the
// brief's and the ending's own (Brief.tsx, Ending.tsx); the letters only lay
// them out.
import type { SceneSource } from "@/render/SceneView";

export type Photo = { source: SceneSource; cacheKey?: string };

/** The brief before a case: what happened, what to find, the cat's word. */
export interface BriefLetterProps {
  /** The case's number ("Case no. 2141"), its series line. */
  label: string;
  series: string;
  context: string;
  objective: string;
  objectiveLabel: string;
  catLine: string;
  catLabel: string;
  catDelay: number;
  /** Her own room, for a print clipped to the file (crime scene). */
  photo?: Photo;
}

/** The reply at the way out: the running head, the headline, the ending's text, "The End". */
export interface ReplyLetterProps {
  head: string;
  headline: string;
  text: string;
  seed: string;
  catLabel: string;
  catDelay: number;
  /** The door she walked out of, for a print on the closed file (crime scene). */
  door?: Photo;
}
