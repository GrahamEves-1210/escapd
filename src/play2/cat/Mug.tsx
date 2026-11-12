// The mug of coffee on home's sill, right by the sitting cat (SittingCat's
// `mug`): chunky sea-green stoneware with a bare clay foot, rendered in the
// kit's light like the still life beside it (scripts/blender/props/home_mug.py,
// assets/home/mug*.png), steam curling up off it (nook.ts's STEAM), its handle
// away from the cat. The cat can knock it off (SittingCat plays that): patted,
// it wobbles (the still picture, rocked about its far foot); nudged, it is a
// real thing falling: ten rendered frames (TUMBLE) of it shoved, tipping over
// its foot toward us, letting go of the sill and turning over as it drops, the
// coffee flung out of it. The frame shown follows the cat's own motion for it
// (a stop-motion frame at 12 fps of its slide, tip and drop), which also
// carries the picture across and down, so the two never part. Under reduced
// motion it is never knocked: it just sits there, its steam held still.
import { StyleSheet, View } from "react-native";
import { useEffect } from "react";
import Animated, {
  Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { BlurMask, Canvas, Group, LinearGradient, Path as SkPath, vec } from "@shopify/react-native-skia";
import { MS_TO_S, STEAM } from "@/screens/hub/art/nook";

const STILL = require("../../../assets/home/mug.png") as number;
const SHEET = require("../../../assets/home/mug-tumble.png") as number;

/**
 * The tumble's frames (home_mug.py prints these): `count` frames on a sheet
 * `columns` across, each `width` x `height` points when the mug's body is
 * `body` points across; and the mug at rest in a frame, as shares of it: its
 * body's `left` and `right` edges, its `foot` on the sill, its `mouth`, and
 * the foot it tips over (`pivot`). Frame 0 is the mug at rest (mug.png is it).
 */
export const TUMBLE = {
  count: 10, columns: 5, rows: 2, width: 69.17, height: 60.67, body: 28,
  left: 0.5862, right: 0.9915, foot: 0.8894, mouth: 0.3067, pivot: { x: 0.6457, y: 0.8656 },
} as const;
/**
 * How the cat's nudge (SittingCat: the slide, the tip, the drop, as shares of
 * the mug's size and degrees) picks the frame: the shove is worth `shove`
 * frames, the tip `tip`, the drop `fall` (together the last frame's number).
 */
export const KNOCK = { slide: 0.12 / 0.27, turn: -80, drop: 1.2 / 0.27, shove: 2, tip: 2.5, fall: 4.5 } as const;
/** Its soft shadow on the sill (a plum ink, never black), as shares of its size: across, tall, how dark. */
const SHADOW = { wide: 1.5, tall: 0.34, ink: "rgb(16, 8, 20)", strength: 0.5, gone: 3 } as const;
const TURN = Math.PI * 2;

/** The tumble's frame (0 at rest .. TUMBLE.count - 1) for the mug's motion ([across, down, turn]) and its size. */
export function tumbleFrame(f: readonly number[], size: number): number {
  "worklet";
  const [x, y, r] = f;
  const unit = (v: number) => Math.min(1, Math.max(0, v));
  const p = KNOCK.shove * unit(-x / (KNOCK.slide * size)) + KNOCK.tip * unit(r / KNOCK.turn) + KNOCK.fall * unit(y / (KNOCK.drop * size));
  return Math.min(TUMBLE.count - 1, Math.round(p));
}

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
  const k = size / ((TUMBLE.right - TUMBLE.left) * TUMBLE.width);
  const w = TUMBLE.width * k, h = TUMBLE.height * k;
  const frame = useDerivedValue(() => tumbleFrame(f.get(), size));
  // Across and down it goes as the cat moves it; it only rocks (about its far foot) while it stands: falling, the frames turn it.
  const style = useAnimatedStyle(() => {
    const [x, y, r] = f.get();
    return { transform: [{ translateX: x }, { translateY: y }, { rotate: `${frame.get() === 0 ? r : 0}deg` }] };
  });
  const standing = useAnimatedStyle(() => ({ opacity: frame.get() === 0 ? 1 : 0 }));
  const falling = useAnimatedStyle(() => ({ opacity: frame.get() === 0 ? 0 : 1 }));
  const strip = useAnimatedStyle(() => {
    const n = frame.get();
    return { transform: [{ translateX: -(n % TUMBLE.columns) * w }, { translateY: -Math.floor(n / TUMBLE.columns) * h }] };
  });
  const shade = useAnimatedStyle(() => ({ opacity: frame.get() < SHADOW.gone ? 1 : 0 }));
  const box = { left: left - TUMBLE.left * w, bottom: bottom - (1 - TUMBLE.foot) * h, width: w, height: h };
  const sw = size * SHADOW.wide, sh = size * SHADOW.tall;
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.mug, { left: left + size / 2 - sw / 2, bottom: bottom - sh * 0.62, width: sw, height: sh }, shade]}
        testID="sill-mug-shadow" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={sw} height={sh} viewBox="0 0 2 2" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="sillMugShadow" cx={1} cy={1} r={1} gradientUnits="userSpaceOnUse">
              <Stop offset={0} stopColor={SHADOW.ink} stopOpacity={SHADOW.strength} />
              <Stop offset={0.55} stopColor={SHADOW.ink} stopOpacity={SHADOW.strength * 0.6} />
              <Stop offset={1} stopColor={SHADOW.ink} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={1} cy={1} rx={1} ry={1} fill="url(#sillMugShadow)" />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.mug, box, { transformOrigin: `${TUMBLE.pivot.x * 100}% ${TUMBLE.pivot.y * 100}%` }, style]} testID="sill-mug"
        accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {steam ? <Steam size={size} left={(TUMBLE.left + TUMBLE.right) / 2 * w} top={TUMBLE.mouth * h} still={still} /> : null}
        <Animated.Image source={STILL} style={[styles.mug, { width: w, height: h }, standing]} resizeMode="stretch" />
        <Animated.View style={[styles.frame, { width: w, height: h }, falling]}>
          <Animated.Image source={SHEET} style={[{ width: w * TUMBLE.columns, height: h * TUMBLE.rows }, strip]} resizeMode="stretch" />
        </Animated.View>
      </Animated.View>
    </>
  );
}

/** Steam off the coffee (STEAM): thin wisps over the mouth (`left`, `top` in the mug's box), waves travelling up them. */
function Steam({ size, left, top, still }: { size: number; left: number; top: number; still: boolean }) {
  const cw = size * 2.2, ch = size * 2.6;
  // Its clock (ms), running on; held at STEAM.still under reduced motion.
  const clock = useSharedValue(STEAM.still / MS_TO_S);
  useEffect(() => {
    if (still) return;
    const long = 1e8;
    clock.set(withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(long, { duration: long, easing: Easing.linear })), -1, false));
  }, [still, clock]);
  return (
    <View pointerEvents="none" style={[styles.steam, { left: left - cw / 2, top: top - ch, width: cw, height: ch }]} testID="sill-mug-steam">
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
  mug: { position: "absolute" },
  frame: { position: "absolute", overflow: "hidden" },
  steam: { position: "absolute" },
});
