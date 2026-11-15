// Turning to another photo, every way it happens (a swipe across the room,
// the turn arrows): the light swings off the room just left and it goes dark,
// then, as soon as the next photo is there, the torch catches on it with the
// same flicker it caught with from the brief (LightsOn: catch, dip, up), a
// shorter dark before it. A black veil over the room's view only (the rail and
// the shelf stay lit), opacity only. It waits in the dark for the photo (it is
// normally already there: Preload.tsx), but never longer than `wait`.
// Reduced motion: none of it; the next photo is simply there.
import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { LIGHTS } from "./LightsOn";

/** The beats (ms): the room going dark, the least time held dark, the bulb's catch and dip, the room up; the longest it waits for a photo. */
export const TURN_LIGHTS = { down: 110, dark: 40, catch: LIGHTS.catch, dip: LIGHTS.dip, up: LIGHTS.up, wait: 2500 } as const;

export function TurnLights({ ready, fromDark = false, onDone }: {
  /** The photo turned to has loaded (Stage's onReady). */
  ready: boolean;
  /** Turned again before the last turn's light was up: start in the dark. */
  fromDark?: boolean;
  onDone: () => void;
}) {
  const { reducedMotion } = useTheme();
  const veil = useSharedValue(fromDark ? 1 : 0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  // Into the dark, as it mounts.
  const darkAt = useRef(0);
  useEffect(() => {
    if (reducedMotion) {
      done.current();
      return;
    }
    darkAt.current = Date.now() + (fromDark ? 0 : TURN_LIGHTS.down);
    if (!fromDark) veil.set(withTiming(1, { duration: TURN_LIGHTS.down, easing: Easing.in(Easing.quad) }));
    // Once, as it mounts (each turn mounts its own).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The photo is there (or it has waited long enough): the torch catches on it.
  const lit = useRef(false);
  const end = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (reducedMotion) return;
    const catchOn = () => {
      if (lit.current) return;
      lit.current = true;
      const hold = Math.max(TURN_LIGHTS.dark, darkAt.current + TURN_LIGHTS.dark - Date.now());
      veil.set(withDelay(hold, withSequence(
        withTiming(0.35, { duration: TURN_LIGHTS.catch }),
        withTiming(0.6, { duration: TURN_LIGHTS.dip }),
        withTiming(0, { duration: TURN_LIGHTS.up, easing: Easing.out(Easing.quad) }),
      )));
      end.current = setTimeout(() => done.current(), hold + TURN_LIGHTS.catch + TURN_LIGHTS.dip + TURN_LIGHTS.up + 20);
    };
    if (ready) {
      catchOn();
      return;
    }
    const giveUp = setTimeout(catchOn, TURN_LIGHTS.wait);
    return () => clearTimeout(giveUp);
  }, [ready, reducedMotion, veil]);
  useEffect(() => () => {
    if (end.current) clearTimeout(end.current);
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: veil.get() }));
  if (reducedMotion) return null;
  return <Animated.View style={[StyleSheet.absoluteFill, styles.veil, style]} pointerEvents="none" testID="v2-turn-lights" />;
}

const styles = StyleSheet.create({
  veil: { backgroundColor: "#000000" },
});
