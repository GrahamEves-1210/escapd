// The music: mounted once, at the app's root (app/_layout.tsx), so it follows
// the active mode across every screen rather than starting and stopping with
// each one. The shell (home, Pro, account) and noir play the main theme,
// Crime Scene and Paranormal their own tracks (trackFor in music.ts).
//
// It plays while music is on (the server's music_enabled, the Music switch in
// Settings) and the app is in the foreground; turning it off, or the app
// going inactive, fades it out; the app reaching the background pauses it at
// once (timers may not run there to finish a fade). It starts at app start:
// the session's ambient category needs no user gesture on iOS or Android, and
// the web (where a browser would want one) plays no audio at all.
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
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
  const state = useSyncExternalStore(subscribeAppState, appState, appState);
  const foreground = state !== "background" && state !== "inactive";
  const track = music_enabled && foreground ? trackFor(mode) : null;

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
