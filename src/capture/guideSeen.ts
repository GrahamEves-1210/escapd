// The first-time photo guide's seen flag (docs/DESIGN.md, 04 · Entry rule and
// States, Error). Two layers: a module-level session flag, checked first, and
// a per-device AsyncStorage key. Storage errors are silent, as in
// preferences.tsx: a failed read shows the guide once this session, and a
// failed write shows it again on the next launch. Neither can loop, because
// the guide sets the session flag before it leaves (Close or "Open the
// camera"), and every check reads the session flag first.
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Per-device key. It holds "1" once the guide has been closed or finished. */
export const CAPTURE_GUIDE_KEY = "escapd:onboarding:capture-guide";

const SEEN = "1";

/** The session flag. Set by the guide, or by a stored "1". Never cleared, so a replay never un-sees the guide. */
let captureGuideSeen = false;

/**
 * The session flag alone, with no storage read. True once the guide was
 * closed or finished this session, or a stored "1" was read.
 */
export function captureGuideSeenThisSession(): boolean {
  return captureGuideSeen;
}

/**
 * Whether the player has seen the guide: the session flag first, then the
 * stored key. A stored "1" also sets the session flag. Any other value, or a
 * failed read, resolves false (show the guide). Never rejects.
 */
export async function hasSeenCaptureGuide(): Promise<boolean> {
  if (captureGuideSeen) return true;
  try {
    if ((await AsyncStorage.getItem(CAPTURE_GUIDE_KEY)) === SEEN) captureGuideSeen = true;
  } catch {
    // A failed read counts as unseen.
  }
  // Re-read the flag: the guide may have been marked while the read ran.
  return captureGuideSeen;
}

/**
 * Marks the guide seen: sets the session flag at once, then starts the
 * storage write. Callers don't wait for it before navigating. The returned
 * promise settles when the write does and never rejects.
 */
export function markCaptureGuideSeen(): Promise<void> {
  captureGuideSeen = true;
  return AsyncStorage.setItem(CAPTURE_GUIDE_KEY, SEEN).catch(() => {});
}
