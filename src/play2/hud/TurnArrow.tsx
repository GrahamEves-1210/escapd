// Turning to the next photo: an arrow in the house pen at the room's edge,
// cream over a soft dark copy so it reads on any photo (never an icon set's
// chevron).
import { InkMark } from "./Ink";

export function TurnArrow({ dir, color = "#FFF6E6" }: { dir: 1 | -1; color?: string }) {
  return <InkMark name={dir === 1 ? "right" : "left"} size={44} tone="chalk" color={color} weight={2.6} />;
}
