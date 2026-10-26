// The photo guide's flag for the room being photographed (docs/DESIGN.md 04,
// Entry rule). The guide now shows before every new room, not only the first
// time, so there is no stored "seen" key any more: one session flag says the
// guide has been shown for the current room.
// - openCapture() clears it whenever a new room starts (and then always opens
//   the guide).
// - The guide sets it as it leaves for the camera (its last step, its X).
// - /capture's backstop (useGuideBackstop) reads it: any way into /capture
//   that skipped the guide for this room shows the guide first. Coming back
//   to the camera for the same room ("Add a photo", a retake) does not.
// Neither can loop: the guide sets the flag before it navigates, and nothing
// but a new room clears it. The old per-device key is no longer read.

/** The retired per-device key ("1" once the guide had been seen). Kept for reference; nothing reads it. */
export const CAPTURE_GUIDE_KEY = "escapd:onboarding:capture-guide";

/** Set once the guide has been shown for the current room. */
let shownForThisRoom = false;

/** Whether the guide has been shown for the current room. Synchronous. */
export function captureGuideSeenThisSession(): boolean {
  return shownForThisRoom;
}

/**
 * The same flag as a promise, for callers written against the old stored
 * check (the backstop). Never rejects.
 */
export async function hasSeenCaptureGuide(): Promise<boolean> {
  return shownForThisRoom;
}

/**
 * Marks the guide shown for the current room, at once. The guide calls it
 * before it leaves for the camera. The returned promise is already settled.
 */
export function markCaptureGuideSeen(): Promise<void> {
  shownForThisRoom = true;
  return Promise.resolve();
}

/** A new room starts (openCapture): the guide shows again before its camera. */
export function resetCaptureGuide(): void {
  shownForThisRoom = false;
}
