// The music: mounted once, at the app's root (app/_layout.tsx), so it plays
// across every screen rather than starting and stopping with each one. The
// main theme plays everywhere until the player is in an escape room
// (/play/…, the room and its case closed): there Crime Scene and Paranormal
// switch to their own tracks (trackFor in music.ts); noir keeps the theme.
//
// It plays while music is on (the server's music_enabled, the Music switch in
// Settings) and the app is in the foreground; turning it off, or the app
// going inactive, fades it out; the app reaching the background pauses it at
// once (timers may not run there to finish a fade). It starts at app start:
// the session's ambient category needs no user gesture on iOS or Android, and
// the web (where a browser would want one) plays no audio at all.
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { usePathname } from "expo-router";
import { useMode } from "./mode";
import { setMusic, trackFor } from "./music";
import { usePreferences } from "./preferences";

function subscribeAppState(listener: () => void) {
  const subscription = AppState.addEventListener("change", listener);
  return () => subscription.remove();
}
// "unknown" or null at launch counts as the foreground.
const appState = (): string | null => AppState.currentState ?? null;

export function useMusic() {
  const { music_enabled } = usePreferences();
  const mode = useMode();
  // A mode's own music only inside its escape room; the theme on home, the camera, the build wait.
  const inRoom = usePathname().startsWith("/play/");
  const state = useSyncExternalStore(subscribeAppState, appState, appState);
  const foreground = state !== "background" && state !== "inactive";
  const track = music_enabled && foreground ? trackFor(inRoom ? mode : null) : null;

  useEffect(() => {
    setMusic(track, { immediate: state === "background" });
  }, [track, state]);
  useEffect(() => () => setMusic(null), []);
}

/** Runs useMusic. A component so the root layout can mount it beside the stack. */
export function Music() {
  useMusic();
  return null;
}
