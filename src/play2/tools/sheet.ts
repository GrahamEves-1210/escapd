// What Reveal.tsx hands each drawn sheet (the pencil rubbing, the red-lens card, the fold-in).
import type { SharedValue } from "react-native-reanimated";
import type { Feedback } from "@/game/feedback";

export interface SheetProps {
  /** What is revealed (the card's writing, its narration split off). */
  text: string;
  /** The card's title: the seed of everything drawn by hand, so the same card is the same object. */
  title: string;
  /** The screen's width and height: the sheet lays itself out in a column this wide. */
  width: number;
  height: number;
  /** How far the writing has come clear (0..1): the sheet drives it to 1 as it's read. */
  shown: SharedValue<number>;
  /** Read already (the gesture may rest). */
  done: boolean;
  /** Reduced motion: the writing shows at once. */
  reduced: boolean;
  /** Called once, when it's read (Reveal marks it done). */
  onRead: () => void;
  feedback: Feedback;
  /** The room's ground behind the sheet (shadows fall in it). */
  ground: string;
  /** For the screen reader: what the object is and how it's read, or (read) what it says. */
  labels: { label: string };
}
