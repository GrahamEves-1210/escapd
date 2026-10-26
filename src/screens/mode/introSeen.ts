// The first-time "how this mode works" screen (MODES_PROMPT.md Part 2): crime
// scene and paranormal show it once per device, before their first case.
// Noir has none (its first tap runs The Study). One AsyncStorage key per mode.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Genre } from "@/lib/puzzle-types";

/** The modes that open with an intro the first time. */
export function hasIntro(genre: Genre): genre is "crime_scene" | "paranormal" {
  return genre === "crime_scene" || genre === "paranormal";
}

export function introKey(genre: Genre): string {
  return `escapd:mode-intro:${genre}`;
}

/** True once the player has pressed Start on the mode's intro (and always for noir). Never rejects: unreadable storage shows the intro again. */
export async function hasSeenIntro(genre: Genre): Promise<boolean> {
  if (!hasIntro(genre)) return true;
  try {
    return (await AsyncStorage.getItem(introKey(genre))) === "1";
  } catch {
    return false;
  }
}

/** Start on the intro: from now on the mode's card skips it. Never rejects. */
export async function markIntroSeen(genre: Genre): Promise<void> {
  try {
    await AsyncStorage.setItem(introKey(genre), "1");
  } catch {
    // Shown again next time; nothing else depends on it.
  }
}
