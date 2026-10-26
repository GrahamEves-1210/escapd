// Haptic feedback that follows the player's settings. Clues never depend on
// haptics alone; this only reinforces what the screen already shows.
//
// One small vocabulary for the whole app (docs/DESIGN.md, Global tokens:
// Haptics), so the same kind of moment always feels the same:
// - tick: a selection moving (a code wheel digit, a photo page settling, a
//   toggle, a segment, a step in the guide). The lightest.
// - press: a button, chip or card pressed in.
// - thud: a firm, physical moment (the shutter, an item landing in the tray,
//   a lock giving way).
// - success / warning / error: an outcome the screen also states.
import { useMemo } from "react";
import * as Haptics from "expo-haptics";
import { usePreferences } from "./preferences";

export function useFeedback() {
  const { haptics_enabled } = usePreferences();
  return useMemo(() => {
    const run = (fn: () => Promise<void>) => {
      if (!haptics_enabled) return;
      // A platform without haptics (the web) may throw or reject; neither may reach the screen.
      try {
        fn().catch(() => {});
      } catch {}
    };
    const tick = () => run(() => Haptics.selectionAsync());
    return {
      tick,
      /** The older name for tick, kept for existing callers. */
      tap: tick,
      press: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
      thud: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
      error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
    };
  }, [haptics_enabled]);
}

export type Feedback = ReturnType<typeof useFeedback>;
