// The room tone under a case: a soft loop for the active mode (rain and a hum
// for noir, a tense hum for a crime scene, a cold drone for paranormal). It
// fades in while `active`, the screen has focus, the app is in the foreground
// and sound is on, and fades out as soon as any of those stops.
//
// Several screens may ask at once (a play screen still mounted under another):
// the most recent claim that wants a tone wins, so a screen losing focus never
// silences the one that just gained it.
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import type { Genre } from "@/lib/puzzle-types";
import { useMode } from "./mode";
import { usePreferences } from "./preferences";
import { setRoomTone } from "./sound";

const claims = new Map<object, Genre>();

function settle() {
  let wanted: Genre | null = null;
  for (const genre of claims.values()) wanted = genre;
  setRoomTone(wanted);
}

function claim(owner: object, genre: Genre | null) {
  claims.delete(owner);
  if (genre) claims.set(owner, genre);
  settle();
}

function subscribeAppState(listener: () => void) {
  const subscription = AppState.addEventListener("change", listener);
  return () => subscription.remove();
}
// In the foreground unless the system says otherwise ("unknown" or null at launch counts as in).
const appIsActive = () => AppState.currentState !== "background" && AppState.currentState !== "inactive";

export function useRoomTone(active: boolean) {
  const { sound_enabled } = usePreferences();
  const mode = useMode();
  const focused = useIsFocused();
  const foreground = useSyncExternalStore(subscribeAppState, appIsActive, appIsActive);
  const [owner] = useState(() => ({}));
  const genre: Genre | null = active && sound_enabled && focused && foreground ? (mode ?? "noir") : null;

  useEffect(() => {
    claim(owner, genre);
  }, [owner, genre]);
  useEffect(() => () => claim(owner, null), [owner]);
}
