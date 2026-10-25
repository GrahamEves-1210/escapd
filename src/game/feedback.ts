// Haptic feedback that follows the player's settings. Clues never depend on
// haptics alone; this only reinforces what the screen already shows.
import { useMemo } from "react";
import * as Haptics from "expo-haptics";
import { usePreferences } from "./preferences";

export function useFeedback() {
  const { haptics_enabled } = usePreferences();
  return useMemo(() => {
    const run = (fn: () => Promise<void>) => {
      if (haptics_enabled) fn().catch(() => {});
    };
    return {
      tap: () => run(() => Haptics.selectionAsync()),
      success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    };
  }, [haptics_enabled]);
}
