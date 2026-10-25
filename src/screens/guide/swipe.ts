// The guide's horizontal swipe (docs/DESIGN.md 04, Tappable elements:
// Horizontal swipe). It activates past +/-16 pt horizontally and fails past
// +/-16 pt vertically; on release it commits when |dx| >= 56 or
// |vx| >= 500 pt/s. Left is next, right is previous. The content never tracks
// the finger: a committed swipe runs the same crossfade as the buttons.
import { ref } from "@/theme/tokens";

const SWIPE = ref.layout.guide.swipe;

/** usePanGesture offsets: activation range on x, failure range on y. */
export const SWIPE_OFFSETS = {
  activeOffsetX: [-SWIPE.activeOffsetX, SWIPE.activeOffsetX] as [number, number],
  failOffsetY: [-SWIPE.failOffsetY, SWIPE.failOffsetY] as [number, number],
};

/**
 * The step change a released swipe commits to: 1 (a left swipe: next), -1 (a
 * right swipe: previous) or 0 (too short and too slow). Distance decides the
 * direction when it passes; otherwise the velocity does.
 */
export function swipeStep(translationX: number, velocityX: number): number {
  "worklet";
  const byDistance = Math.abs(translationX) >= SWIPE.commitDistance;
  if (!byDistance && Math.abs(velocityX) < SWIPE.commitVelocity) return 0;
  return byDistance ? (translationX < 0 ? 1 : -1) : velocityX < 0 ? 1 : -1;
}
