// The cat: Escapd's black cat, peering over the bottom edge of the room with
// its paws on the ledge, its slit pupils following the flashlight's beam. The
// art's own pupils are painted out (assets/characters/cat_peek.png); these
// are drawn over the eyes and slide toward the beam, further the further it is.
import { useRef, useState, type ComponentRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { measureInWindow } from "@/render/PickupFlight";

const ART = require("../../assets/characters/cat_peek.png") as number;
/** The art's size (px) and its eyes, as fractions of it. */
const ART_W = 560;
const ART_H = 585;
const EYES = [{ x: 0.3329, y: 0.5336 }, { x: 0.7061, y: 0.5336 }] as const;
const EYE_R = { x: 0.0949, y: 0.0833 };
const PUPIL = { w: 0.03, h: 0.15 };

export function PeekingCat({ width, beamX, beamY, frame }: {
  /** On-screen width (points). */
  width: number;
  beamX: SharedValue<number>;
  beamY: SharedValue<number>;
  /** The room photo's frame in window points: where the beam's fractions land. */
  frame: { x: number; y: number; width: number; height: number } | null;
}) {
  const height = (width * ART_H) / ART_W;
  const viewRef = useRef<ComponentRef<typeof View>>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  return (
    <View
      ref={viewRef}
      pointerEvents="none"
      onLayout={() => measureInWindow(viewRef.current).then((r) => r && setOrigin({ x: r.x, y: r.y }))}
      style={{ width, height }}
      accessible
      accessibilityLabel="A black cat watches your light"
      testID="v2-cat"
    >
      <Image source={ART} style={StyleSheet.absoluteFill} resizeMode="contain" />
      {EYES.map((eye, i) => (
        <Pupil key={i} eye={eye} width={width} height={height} origin={origin} frame={frame} beamX={beamX} beamY={beamY} />
      ))}
    </View>
  );
}

function Pupil({ eye, width, height, origin, frame, beamX, beamY }: {
  eye: { x: number; y: number }; width: number; height: number;
  origin: { x: number; y: number } | null;
  frame: { x: number; y: number; width: number; height: number } | null;
  beamX: SharedValue<number>; beamY: SharedValue<number>;
}) {
  const pw = width * PUPIL.w;
  const ph = height * PUPIL.h;
  const cx = eye.x * width;
  const cy = eye.y * height;
  const rangeX = width * EYE_R.x * 0.55;
  const rangeY = height * EYE_R.y * 0.35;
  const ox = origin?.x ?? 0, oy = origin?.y ?? 0;
  const fx = frame?.x ?? 0, fy = frame?.y ?? 0, fw = frame?.width ?? 0, fh = frame?.height ?? 0;
  const known = !!origin && !!frame;
  const style = useAnimatedStyle(() => {
    let dx = 0, dy = 0;
    if (known) {
      // The beam in window points, against this eye's centre.
      const bx = fx + beamX.get() * fw - (ox + cx);
      const by = fy + beamY.get() * fh - (oy + cy);
      const d = Math.hypot(bx, by) || 1;
      const pull = Math.min(1, d / 160);
      dx = (bx / d) * rangeX * pull;
      dy = (by / d) * rangeY * pull;
    }
    return { transform: [{ translateX: dx }, { translateY: dy }] };
  });
  return <Animated.View style={[styles.pupil, { left: cx - pw / 2, top: cy - ph / 2, width: pw, height: ph, borderRadius: pw }, style]} />;
}

const styles = StyleSheet.create({
  pupil: { position: "absolute", backgroundColor: "#0B0806" },
});
