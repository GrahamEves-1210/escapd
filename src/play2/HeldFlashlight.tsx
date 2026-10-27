// The flashlight in hand, first person: held low at the bottom right of the
// screen, just above the ledge, its body turning to aim at the beam and
// shortening as it points deeper into the room. Screen space (not the
// photo's), so the ledge never hides it. Never touchable.
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";

const L = { length: 104, body: 18, head: 30 } as const;

export function HeldFlashlight({ beamX, beamY, frame, pivot, uv }: {
  beamX: SharedValue<number>;
  beamY: SharedValue<number>;
  /** The room photo's frame in window points (the beam is in its fractions). */
  frame: { x: number; y: number; width: number; height: number } | null;
  /** Where the hand holds it, in window points. */
  pivot: { x: number; y: number };
  uv: boolean;
}) {
  const fx = frame?.x ?? 0, fy = frame?.y ?? 0, fw = frame?.width ?? 0, fh = frame?.height ?? 0;
  const reach = Math.hypot(fw, fh) || 1;
  const style = useAnimatedStyle(() => {
    const dx = fx + beamX.get() * fw - pivot.x;
    const dy = fy + beamY.get() * fh - pivot.y;
    const far = Math.min(1, Math.hypot(dx, dy) / reach);
    return { transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }, { scaleX: 1 - 0.35 * far }] };
  });
  if (!frame) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.held, { left: pivot.x, top: pivot.y - L.body / 2 }, style]} testID="v2-held-light">
      <View style={styles.grip} />
      <View style={styles.body} />
      <View style={styles.head}>
        <View style={[styles.lens, { backgroundColor: uv ? "rgb(178,128,255)" : "rgb(255,238,196)", shadowColor: uv ? "rgb(150,95,255)" : "rgb(255,220,150)" }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  held: { position: "absolute", width: L.length, height: L.body, flexDirection: "row", alignItems: "center", transformOrigin: "0% 50%", zIndex: 6 },
  grip: { width: 30, height: L.body - 2, borderTopLeftRadius: 7, borderBottomLeftRadius: 7, backgroundColor: "rgb(24,24,27)" },
  body: { flex: 1, height: L.body, backgroundColor: "rgb(44,44,49)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)" },
  head: {
    width: 26, height: L.head, borderRadius: 7, backgroundColor: "rgb(62,62,68)", alignItems: "flex-end", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  lens: { width: 6, height: L.head - 8, borderRadius: 3, marginRight: -1, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
});
