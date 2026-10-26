// Kept apart from the mode store (mode.ts) so the store never pulls in
// expo-router: anything may read the mode, only screens set it on focus.
import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import type { Genre } from "@/lib/puzzle-types";
import { setMode } from "./mode";

/**
 * Sets the active mode each time the calling screen gains focus: a mode
 * screen passes its genre, home passes null. Leaving does nothing; the next
 * screen sets its own.
 */
export function useModeOnFocus(genre: Genre | null) {
  useFocusEffect(
    useCallback(() => {
      setMode(genre);
    }, [genre]),
  );
}
