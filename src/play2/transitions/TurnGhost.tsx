// Turning to another photo: the room just left doesn't cut to black. It
// stays a moment in the dark (the light has swung away from it), drifting
// off the way the player turned from at a third of the pace of the photo
// sliding in over it (Stage's own slide), and fades: a turn of the head,
// with a little parallax, rather than a swap. One still image under a dark
// veil, transform and opacity only, gone in about a third of a second.
// Reduced motion: not drawn.
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { TreatedImage } from "@/components/noir";
import type { SceneSource } from "@/render/SceneView";
import { useTheme } from "@/theme/ThemeProvider";

export const TURN = { ms: 340, drift: 0.2 } as const;

export function TurnGhost({ source, cacheKey, frame, dir, darkness, onDone }: {
  /** The photo just turned away from. */
  source: SceneSource;
  cacheKey?: string;
  /** Where a photo lies in the game view (Stage's frame). */
  frame: { x: number; y: number; width: number; height: number };
  /** The way the player turned (1: to the next photo, which comes in from the right). */
  dir: 1 | -1;
  /** How dark the room is out of the beam. */
  darkness: number;
  onDone: () => void;
}) {
  const { reducedMotion } = useTheme();
  const t = useSharedValue(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (!reducedMotion) t.set(withTiming(1, { duration: TURN.ms, easing: Easing.out(Easing.cubic) }));
    const end = setTimeout(() => done.current(), reducedMotion ? 0 : TURN.ms);
    return () => clearTimeout(end);
    // Once, as it mounts (each turn mounts its own).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const width = frame.width;
  const style = useAnimatedStyle(() => ({ opacity: 1 - t.get(), transform: [{ translateX: -dir * width * TURN.drift * t.get() }] }));
  if (reducedMotion) return null;
  return (
    <Animated.View style={[styles.ghost, { left: frame.x, top: frame.y, width: frame.width, height: frame.height }, style]} pointerEvents="none" testID="v2-turn-ghost">
      <TreatedImage source={source} genre={null} cacheKey={cacheKey} style={StyleSheet.absoluteFill} contentFit="fill" accessible={false} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${Math.min(0.97, darkness + 0.02)})` }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ghost: { position: "absolute" },
});
