import { AccessibilityInfo, Platform, type HostInstance } from "react-native";

// Screen-reader helpers that never throw. React Native Web has neither
// sendAccessibilityEvent nor announceForAccessibilityWithOptions, and a
// screen-reader nicety must never take the screen down with it: where a call
// is missing it is skipped, and any failure is swallowed.

/** Moves screen-reader focus to `node` (a no-op where the platform can't). */
export function focusForAccessibility(node: HostInstance | null | undefined): void {
  if (!node || Platform.OS === "web") return;
  try {
    const send = AccessibilityInfo.sendAccessibilityEvent;
    if (typeof send === "function") send(node, "focus");
  } catch {}
}

/** Announces `text`; `queue` waits for the current speech on iOS. A no-op where unsupported. */
export function announce(text: string, options?: { queue?: boolean }): void {
  if (!text) return;
  try {
    const withOptions = AccessibilityInfo.announceForAccessibilityWithOptions;
    if (options && typeof withOptions === "function") {
      withOptions(text, options);
      return;
    }
    const plain = AccessibilityInfo.announceForAccessibility;
    if (typeof plain === "function") plain(text);
  } catch {}
}
