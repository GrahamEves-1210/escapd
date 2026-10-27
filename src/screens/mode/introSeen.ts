// The first-time "how this mode works" screen (MODES_PROMPT.md Part 2): each
// mode shows it once per device, before its first case. One AsyncStorage key
// per mode.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Genre } from "@/lib/puzzle-types";

export function introKey(genre: Genre): string {
  return `escapd:mode-intro:${genre}`;
}

/** True once the player has pressed Start on the mode's intro. Never rejects: unreadable storage shows the intro again. */
export async function hasSeenIntro(genre: Genre): Promise<boolean> {
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
