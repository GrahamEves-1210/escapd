// The mug of tea on home's sill, right by the sitting cat (SittingCat's `mug`):
// a plain stoneware mug in the backdrop's flat painted style, steam curling up
// off the tea (nook.ts's STEAM), its handle away from the cat. The cat can
// knock it off (SittingCat plays that): it wobbles when patted, slides, tips
// over the sill's edge and drops out of sight. Its motion is the cat's: a
// stop-motion frame (12 fps) of its slide, drop and turn.
import { StyleSheet, View } from "react-native";
import { useEffect } from "react";
import Animated, {
  Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue,
} from "react-native-reanimated";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";
import { BlurMask, Canvas, Group, LinearGradient, Path as SkPath, vec } from "@shopify/react-native-skia";
import { MS_TO_S, STEAM } from "@/screens/hub/art/nook";

/** The mug's drawing: its box (viewBox), the body's share of its width, and where its mouth is (shares of the box). */
const BOX = { w: 46, h: 40 };
const BODY = { x0: 14, x1: 44 };
/** Colours: a deep sea-green glaze in candlelight, its shade, its rim, the tea. */
const GLAZE = { body: "#4F8682", shade: "#3C6A69", rim: "#6FA39C", tea: "#7A4A2E", handle: "#40706E", foot: "#2F5352" };
const TURN = Math.PI * 2;

/**
 * The mug, `size` points across its body (its handle reaches a little past
 * it), its foot `bottom` points up from its parent's bottom and its body's
 * left edge `left` points in from the parent's left. `f`: its motion
 * ([across, down, turn], points and degrees) at 12 fps. `steam` while it's
 * hot and upright; `still` under reduced motion (the steam holds its curl).
 */
export function SillMug({ size, left, bottom, f, steam, still }: {
  size: number; left: number; bottom: number; f: SharedValue<number[]>; steam: boolean; still: boolean;
}) {
  const k = size / (BODY.x1 - BODY.x0);
  const w = BOX.w * k, h = BOX.h * k;
  const style = useAnimatedStyle(() => {
    const [x, y, r] = f.get();
    return { transform: [{ translateX: x }, { translateY: y }, { rotate: `${r}deg` }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.mug, { left: left - BODY.x0 * k, bottom, width: w, height: h }, style]} testID="sill-mug"
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {steam ? <Steam size={size} left={(BODY.x0 + BODY.x1) / 2 * k} still={still} /> : null}
      <Svg width={w} height={h} viewBox={`0 0 ${BOX.w} ${BOX.h}`}>
        {/* The handle, away from the cat. */}
        <Path d="M16 11 C5 11 2 15 2 21 C2 27 6 31 16 31" stroke={GLAZE.handle} strokeWidth={4.5} strokeLinecap="round" fill="none" />
        <Rect x={BODY.x0} y={4} width={BODY.x1 - BODY.x0} height={36} rx={5} fill={GLAZE.body} />
        <Rect x={32} y={4} width={12} height={36} rx={5} fill={GLAZE.shade} />
        <Rect x={BODY.x0} y={35} width={BODY.x1 - BODY.x0} height={5} rx={2.5} fill={GLAZE.foot} />
        <Ellipse cx={29} cy={4.5} rx={15} ry={3.6} fill={GLAZE.rim} />
        <Ellipse cx={29} cy={5} rx={12.4} ry={2.4} fill={GLAZE.tea} />
        {/* A soft highlight down its body, in the candle's light. */}
        <Path d="M18 10 L18 30" stroke="#8DBDB5" strokeWidth={2} strokeLinecap="round" opacity={0.55} />
      </Svg>
    </Animated.View>
  );
}

/** Steam off the tea (STEAM): thin wisps over the mouth, waves travelling up them. */
function Steam({ size, left, still }: { size: number; left: number; still: boolean }) {
  const cw = size * 2.2, ch = size * 2.6;
  // Its clock (ms), running on; held at STEAM.still under reduced motion.
  const clock = useSharedValue(STEAM.still / MS_TO_S);
  useEffect(() => {
    if (still) return;
    const long = 1e8;
    clock.set(withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(long, { duration: long, easing: Easing.linear })), -1, false));
  }, [still, clock]);
  return (
    <View pointerEvents="none" style={[styles.steam, { left: left - cw / 2, top: -ch, width: cw, height: ch }]} testID="sill-mug-steam">
      <Canvas style={StyleSheet.absoluteFill}>
        {STEAM.wisps.map((spec, i) => (
          <Wisp key={i} spec={spec} x={cw / 2} y={ch} size={size} clock={clock} />
        ))}
      </Canvas>
    </View>
  );
}

function Wisp({ spec, x, y, size, clock }: { spec: (typeof STEAM.wisps)[number]; x: number; y: number; size: number; clock: SharedValue<number> }) {
  const x0 = x + spec.dx * size;
  const y0 = y - STEAM.lift * size;
  const rise = spec.rise * size;
  const amp = STEAM.amp * size;
  const path = useDerivedValue(() => {
    const t = clock.value * MS_TO_S;
    let d = "";
    for (let i = 0; i <= STEAM.segments; i += 1) {
      const k = i / STEAM.segments;
      // It sways more as it rises, and leans a little.
      const px = x0 + spec.lean * size * k + amp * (STEAM.swayFrom + (1 - STEAM.swayFrom) * k) * Math.sin(k * STEAM.waves * TURN - t * STEAM.speed + spec.phase);
      d += `${i === 0 ? "M" : " L"} ${px} ${y0 - k * rise}`;
    }
    return d;
  });
  const opacity = useDerivedValue(() => {
    const s = (1 + Math.sin(clock.value * MS_TO_S * STEAM.breath + spec.phase)) / 2;
    return STEAM.low + (STEAM.high - STEAM.low) * s;
  });
  return (
    <Group opacity={opacity}>
      <SkPath path={path} style="stroke" strokeWidth={STEAM.width} strokeCap="round" strokeJoin="round">
        <LinearGradient start={vec(0, y0)} end={vec(0, y0 - rise)} colors={[STEAM.clear, STEAM.color, STEAM.color, STEAM.clear]} positions={[...STEAM.fade]} />
        <BlurMask blur={STEAM.blur} style="normal" />
      </SkPath>
    </Group>
  );
}

const styles = StyleSheet.create({
  // It tips over its far (left) foot.
  mug: { position: "absolute", transformOrigin: "20% 100%" },
  steam: { position: "absolute" },
});
