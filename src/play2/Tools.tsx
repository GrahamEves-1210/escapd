// The player's two tools, on the photo's bottom corners, like a game's HUD
// around its view: the magnifier bottom left (Escapd's 3D magnifier,
// assets/brand/magnifier.png), picked up and dragged onto something to look
// closer, then springing back to its corner; the flashlight bottom right
// (drawn to match it, scripts/brand/flashlight.py), fixed in its corner and
// turning on its handle to aim at its beam.
import { Image, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { DragState } from "./ItemTray";

export const TOOL = 64;

const MAGNIFIER = require("../../assets/brand/magnifier.png") as number;
const FLASHLIGHT = require("../../assets/brand/flashlight.png") as number;
/** How far the flashlight may turn either way from straight up (degrees): it stays a held light, never upside down. */
const AIM = 70;

export function Magnifier({ at, drag, onDragStart, onDrop }: {
  at: { left: number; top: number };
  drag: DragState;
  onDragStart: () => void;
  /** Where it was let go (window points); every pickup ends with one call, released or cancelled. */
  onDrop: (x: number, y: number) => void;
}) {
  // Carried with the finger, a little bigger in hand; back to its corner when let go.
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lift = useSharedValue(0);
  const dropped = useSharedValue(false);
  const pan = usePanGesture({
    minDistance: 4,
    maxPointers: 1,
    onActivate: (e) => {
      "worklet";
      dropped.set(false);
      lift.set(withTiming(1, { duration: 120 }));
      drag.x.set(e.absoluteX);
      drag.y.set(e.absoluteY);
      scheduleOnRN(onDragStart);
    },
    onUpdate: (e) => {
      "worklet";
      dx.set(e.translationX);
      dy.set(e.translationY);
      drag.x.set(e.absoluteX);
      drag.y.set(e.absoluteY);
    },
    onDeactivate: (e) => {
      "worklet";
      dropped.set(true);
      scheduleOnRN(onDrop, e.absoluteX, e.absoluteY);
    },
    onFinalize: () => {
      "worklet";
      // Released or cancelled, it always goes home.
      dx.set(withSpring(0, { damping: 16, stiffness: 180 }));
      dy.set(withSpring(0, { damping: 16, stiffness: 180 }));
      lift.set(withTiming(0, { duration: 160 }));
      if (!dropped.get()) {
        dropped.set(true);
        scheduleOnRN(onDrop, -1, -1);
      }
    },
  });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.get() }, { translateY: dy.get() - lift.get() * 18 }, { scale: 1 + lift.get() * 0.25 }],
  }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.tool, styles.lens, at, style]} accessible accessibilityRole="button" accessibilityLabel="Magnifier: drag onto something to look closer" testID="v2-lens">
        <Image source={MAGNIFIER} style={styles.art} resizeMode="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

/** The flashlight, bottom right, pivoting on its handle toward the beam (the art points up at rest). */
export function Flashlight({ at, beamX, beamY, frame, uv }: {
  at: { left: number; top: number };
  beamX: SharedValue<number>;
  beamY: SharedValue<number>;
  frame: { x: number; y: number; width: number; height: number };
  uv: boolean;
}) {
  // The pivot: low on the handle.
  const px = at.left + TOOL / 2;
  const py = at.top + TOOL * 0.85;
  const { x: fx, y: fy, width: fw, height: fh } = frame;
  const style = useAnimatedStyle(() => {
    const dx = fx + beamX.get() * fw - px;
    const dy = fy + beamY.get() * fh - py;
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const aim = Math.max(-AIM, Math.min(AIM, ((deg + 540) % 360) - 180));
    return { transform: [{ rotate: `${aim}deg` }] };
  });
  return (
    <View pointerEvents="none" style={[styles.tool, at]} testID="v2-flashlight">
      <Animated.View style={[styles.pivot, style]}>
        {uv ? <View style={styles.uvGlow} /> : null}
        <Image source={FLASHLIGHT} style={styles.art} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  tool: { position: "absolute", width: TOOL, height: TOOL, zIndex: 8 },
  lens: { zIndex: 60 },
  pivot: { width: TOOL, height: TOOL, transformOrigin: "50% 85%" },
  art: { width: TOOL, height: TOOL },
  uvGlow: { position: "absolute", left: TOOL * 0.2, top: 0, width: TOOL * 0.6, height: TOOL * 0.35, borderRadius: TOOL, backgroundColor: "rgba(160,110,255,0.75)" },
});
