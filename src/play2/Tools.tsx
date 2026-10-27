// The player's two tools, on the photo's bottom corners, like a game's HUD
// around its view: the magnifier bottom left (the one drawn for Settings: a
// lens ring with its handle), dragged onto something to look closer; the
// flashlight bottom right, turning to aim at its beam.
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { FlashlightIcon } from "phosphor-react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { DragState } from "./ItemTray";

export const TOOL = 64;

/** The magnifier as drawn for Settings: the ring is the lens, a handle out to the bottom right. */
export function LensGlyph({ size, color }: { size: number; color: string }) {
  const r = size * 0.32;
  const c = size * 0.42;
  const h0 = c + r * 0.72;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} fill="rgba(255,255,255,0.08)" stroke={color} strokeWidth={size * 0.06} />
      <Line x1={h0} y1={h0} x2={size * 0.9} y2={size * 0.9} stroke={color} strokeWidth={size * 0.1} strokeLinecap="round" />
    </Svg>
  );
}

export function Magnifier({ at, drag, onDragStart, onDrop }: {
  at: { left: number; top: number };
  drag: DragState;
  onDragStart: () => void;
  onDrop: (x: number, y: number) => void;
}) {
  const pan = usePanGesture({
    minDistance: 4,
    maxPointers: 1,
    onActivate: (e) => {
      "worklet";
      drag.x.set(e.absoluteX);
      drag.y.set(e.absoluteY);
      scheduleOnRN(onDragStart);
    },
    onUpdate: (e) => {
      "worklet";
      drag.x.set(e.absoluteX);
      drag.y.set(e.absoluteY);
    },
    onDeactivate: (e) => {
      "worklet";
      scheduleOnRN(onDrop, e.absoluteX, e.absoluteY);
    },
  });
  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.tool, at]} accessible accessibilityRole="button" accessibilityLabel="Magnifier: drag onto something to look closer" testID="v2-lens">
        <LensGlyph size={TOOL} color="#FFFFFF" />
      </View>
    </GestureDetector>
  );
}

/** The magnifier under the finger while it's dragged. */
export function LensGhost({ drag }: { drag: DragState }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: drag.x.get() - 30 }, { translateY: drag.y.get() - 30 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.ghost, style]} testID="v2-lens-drag">
      <LensGlyph size={76} color="#FFFFFF" />
    </Animated.View>
  );
}

/** The flashlight, bottom right, its head turned toward the beam (the icon points up at rest). */
export function Flashlight({ at, beamX, beamY, frame, uv }: {
  at: { left: number; top: number };
  beamX: SharedValue<number>;
  beamY: SharedValue<number>;
  frame: { x: number; y: number; width: number; height: number };
  uv: boolean;
}) {
  const cx = at.left + TOOL / 2;
  const cy = at.top + TOOL / 2;
  const { x: fx, y: fy, width: fw, height: fh } = frame;
  const style = useAnimatedStyle(() => {
    const dx = fx + beamX.get() * fw - cx;
    const dy = fy + beamY.get() * fh - cy;
    return { transform: [{ rotate: `${Math.atan2(dy, dx) + Math.PI / 2}rad` }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.tool, at, style]} testID="v2-flashlight">
      <FlashlightIcon size={TOOL * 0.8} weight="duotone" color={uv ? "rgb(196,160,255)" : "#FFFFFF"} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tool: {
    position: "absolute", width: TOOL, height: TOOL, alignItems: "center", justifyContent: "center", zIndex: 8,
    shadowColor: "#000000", shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  ghost: { position: "absolute", left: 0, top: 0, zIndex: 200 },
});
