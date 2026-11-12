// The player's two tools, on the photo's bottom corners, like a game's HUD
// around its view. Both are modelled and rendered in Blender (scripts/blender,
// the kit's house look: aged brass, a warm key from the upper left, an ink line).
// The magnifier bottom left (scripts/blender/props/magnifier.py: a brass rim round
// real glass you can see the room through, on a turned walnut handle), picked up
// and dragged onto something to look closer, then springing back to its corner;
// the flashlight bottom right (scripts/blender/props/flashlight.py: a chunky brass
// torch, lit, seen down into its reflector), fixed in its corner and turning on
// its handle to aim at its beam; with the UV light on it's the blackened twin whose
// lens glows violet (assets/brand/flashlight-uv.png), and so does its beam (Stage).
// Each stands on the shelf's back edge: a soft shadow where it rests (the
// magnifier's stays while it's in hand: where it goes back to).
import { Image, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { CarryBody, type Carry } from "./Carry";
import { GroundShadow } from "./hud/materials";

/** The tools' size (points): big enough to read as the brass heirlooms they are, clear of the cat and the tray. */
export const TOOL = 88;

const MAGNIFIER = require("../../assets/brand/magnifier.png") as number;
const FLASHLIGHT = require("../../assets/brand/flashlight.png") as number;
const FLASHLIGHT_UV = require("../../assets/brand/flashlight-uv.png") as number;
/** How far the flashlight may turn either way from straight up (degrees): it stays a held light, never upside down. */
const AIM = 70;
/**
 * The flashlight's art, as fractions of its square (printed by scripts/blender/props/flashlight.py): the point low
 * on its handle that it turns about, and the middle of its lens (both on its centre line, so the lens leads the
 * way to the beam at any turn).
 */
const LIGHT_PIVOT_Y = 0.785;
export const LIGHT_LENS_Y = 0.167;
/** The magnifier's lens centre, from the art's centre (fractions of its size, printed by scripts/blender/props/magnifier.py): what it looks at (the art holds the lens up and right). */
const LENS = { x: 0.024, y: -0.064 };
/** In hand it's a little bigger, and rides this far above where it was held. */
const GROW = 0.2;
const RAISE = 16;

/** Where the magnifier looks (window points) with its body centred at (x, y). */
export function lensPoint(x: number, y: number): { x: number; y: number } {
  "worklet";
  return { x: x + LENS.x * TOOL * (1 + GROW), y: y + LENS.y * TOOL * (1 + GROW) };
}

export function Magnifier({ at, lifted = false, carry, onDragStart, onDrop }: {
  at: { left: number; top: number };
  /** In hand (or on its way home): drawn above everything; at rest it sits with the HUD, under any sheet. */
  lifted?: boolean;
  /** Its physics (PlayerV2 owns it, to snap it into what it was dropped on or send it home). */
  carry: Carry;
  onDragStart: () => void;
  /** Where its lens was when let go (window points); every pickup ends with one call, released or cancelled (-1, -1). */
  onDrop: (x: number, y: number) => void;
}) {
  const { grab, move, release, tx, ty, phase } = carry;
  const dropped = useSharedValue(false);
  const pan = usePanGesture({
    minDistance: 4,
    maxPointers: 1,
    testID: "v2-lens-pan",
    onActivate: (e) => {
      "worklet";
      dropped.set(false);
      // Held where it was gripped, a little above the finger (mid-flight home: by its middle).
      const resting = phase.get() === 0;
      const offX = resting ? TOOL / 2 - e.x : 0;
      const offY = (resting ? TOOL / 2 - e.y : -TOOL * 0.3) - RAISE;
      grab("lens", e.absoluteX - e.x + TOOL / 2, e.absoluteY - e.y + TOOL / 2, e.absoluteX, e.absoluteY, offX, offY);
      scheduleOnRN(onDragStart);
    },
    onUpdate: (e) => {
      "worklet";
      move(e.absoluteX, e.absoluteY);
    },
    onDeactivate: () => {
      "worklet";
      dropped.set(true);
      release();
      const lens = lensPoint(tx.get(), ty.get());
      scheduleOnRN(onDrop, lens.x, lens.y);
    },
    onFinalize: () => {
      "worklet";
      if (!dropped.get()) {
        dropped.set(true);
        release();
        scheduleOnRN(onDrop, -1, -1);
      }
    },
  });
  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.tool, lifted && styles.lifted, at]} accessible accessibilityRole="button" accessibilityLabel="Magnifier: drag onto something to look closer" testID="v2-lens">
        <GroundShadow width={TOOL * 0.62} height={16} opacity={0.7} style={styles.restLens} />
        <CarryBody carry={carry} size={TOOL} origin={null} grow={GROW}>
          <Image source={MAGNIFIER} style={styles.art} resizeMode="contain" />
        </CarryBody>
      </View>
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
  const py = at.top + TOOL * LIGHT_PIVOT_Y;
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
      <GroundShadow width={TOOL * 0.5} height={16} opacity={0.7} style={styles.restLight} />
      <Animated.View style={[styles.pivot, style]}>
        <Image source={uv ? FLASHLIGHT_UV : FLASHLIGHT} style={styles.art} resizeMode="contain" testID="v2-flashlight-art" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  tool: { position: "absolute", width: TOOL, height: TOOL, zIndex: 8 },
  lifted: { zIndex: 60 },
  pivot: { width: TOOL, height: TOOL, transformOrigin: `50% ${LIGHT_PIVOT_Y * 100}%` },
  art: { width: TOOL, height: TOOL },
  // Where each stands: under the magnifier's handle (low left), under the flashlight's cap (its pivot).
  restLens: { left: TOOL * 0.02, bottom: -5 },
  restLight: { left: TOOL * 0.25, bottom: -5 },
});
