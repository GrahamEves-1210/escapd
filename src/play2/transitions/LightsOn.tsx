// From the brief to the room: the letter goes away into the dark (Darkness
// lies under the brief, so it never fades onto the room), there's a beat of
// black, the flashlight clicks, its bulb catches (a flicker) and the room is
// there in its beam; the game's frame (the rail, the shelf) comes up out of
// the dark a moment after, as eyes adjust. About half a second, opacity only
// (three black veils over what's already drawn underneath); a touch anywhere
// skips it. Reduced motion: none of it, the room is simply there.
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { useFeedback } from "@/game/feedback";
import { useTheme } from "@/theme/ThemeProvider";

/** The beats (ms): the dark held, the bulb's flicker, the room up, the frame up after it. */
export const LIGHTS = { dark: 90, catch: 50, dip: 60, up: 220, frameAfter: 60, frame: 240 } as const;
/** The whole of it. */
export const LIGHTS_MS = LIGHTS.dark + LIGHTS.catch + LIGHTS.dip + Math.max(LIGHTS.up, LIGHTS.frameAfter + LIGHTS.frame);

/** The dark the brief lies on: under it, over the room (not with reduced motion: the brief goes and the room is there). */
export function Darkness() {
  const { reducedMotion } = useTheme();
  if (reducedMotion) return null;
  return <View style={[StyleSheet.absoluteFill, styles.dark]} pointerEvents="none" testID="v2-darkness" />;
}

export function LightsOn({ top, bottom, onDone }: {
  /** Where the room's view starts and ends on screen (points from the top): the rail above it, the shelf below. */
  top: number;
  bottom: number;
  onDone: () => void;
}) {
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const room = useSharedValue(1);
  const frame = useSharedValue(1);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (reducedMotion) {
      done.current();
      return;
    }
    room.set(withDelay(LIGHTS.dark, withSequence(
      withTiming(0.35, { duration: LIGHTS.catch }),
      withTiming(0.6, { duration: LIGHTS.dip }),
      withTiming(0, { duration: LIGHTS.up, easing: Easing.out(Easing.quad) }),
    )));
    frame.set(withDelay(LIGHTS.dark + LIGHTS.catch + LIGHTS.dip + LIGHTS.frameAfter, withTiming(0, { duration: LIGHTS.frame, easing: Easing.out(Easing.quad) })));
    // The switch's click as the bulb catches.
    const click = setTimeout(() => feedback.uvSwitch(), LIGHTS.dark);
    const end = setTimeout(() => done.current(), LIGHTS_MS + 20);
    return () => {
      clearTimeout(click);
      clearTimeout(end);
    };
    // Once, as it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const roomStyle = useAnimatedStyle(() => ({ opacity: room.get() }));
  const frameStyle = useAnimatedStyle(() => ({ opacity: frame.get() }));
  if (reducedMotion) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.over]} testID="v2-lights-on">
      <Animated.View style={[styles.veil, { top: 0, height: top }, frameStyle]} pointerEvents="none" />
      <Animated.View style={[styles.veil, { top, height: Math.max(0, bottom - top) }, roomStyle]} pointerEvents="none" />
      <Animated.View style={[styles.veil, { top: bottom, bottom: 0 }, frameStyle]} pointerEvents="none" />
      {/* A touch anywhere: straight to the room. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => done.current()} accessibilityLabel="Skip" accessible={false} testID="v2-lights-on-skip" />
    </View>
  );
}

const styles = StyleSheet.create({
  // Under the brief (zIndex 90), over the room and its frame.
  dark: { backgroundColor: "#000000", zIndex: 89 },
  over: { zIndex: 89 },
  veil: { position: "absolute", left: 0, right: 0, backgroundColor: "#000000" },
});
