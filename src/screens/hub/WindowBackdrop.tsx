// Home's backdrop: a rainy night seen through a window whose frame and sill
// run round the screen (assets/backdrop/window.jpg, scripts/brand/window.py).
// Over the glass, rain streaks fall past outside, and now and then lightning
// flickers far off, lighting the sky behind the city. Both are held to the
// window's opening, so the frame stays solid. Under reduced motion the night
// is still: no rain moving and no flashes.
import { useEffect } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { Canvas, Path, useClock } from "@shopify/react-native-skia";
import { useTheme } from "@/theme/ThemeProvider";

const WINDOW = require("../../../assets/backdrop/window.jpg") as number;
/** The opening inside the frame, as fractions of the art (cover-fitted): sides and top, then the sill. */
const OPENING = { side: 0.081, top: 0.037, sill: 0.09 } as const;
const DROPS = 70;

interface Drop {
  x: number;
  speed: number;
  len: number;
  phase: number;
}

// Fixed per launch: the same rain every frame, drawn from the clock.
const RAIN: Drop[] = Array.from({ length: DROPS }, (_, i) => {
  const r = (n: number) => {
    const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  return { x: r(1), speed: 0.9 + r(2) * 0.8, len: 18 + r(3) * 34, phase: r(4) };
});

export function WindowBackdrop() {
  const { width, height } = useWindowDimensions();
  const { reducedMotion } = useTheme();
  const left = width * OPENING.side;
  const top = height * OPENING.top;
  const w = width - 2 * left;
  const h = height - top - height * OPENING.sill;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="hub-window">
      <Image source={WINDOW} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={{ position: "absolute", left, top, width: w, height: h, overflow: "hidden" }}>
        <Lightning still={reducedMotion} />
        {reducedMotion ? null : <Rain width={w} height={h} />}
      </View>
    </View>
  );
}

/** Rain outside the glass: thin pale streaks, slanting a little, falling at a few speeds. */
function Rain({ width, height }: { width: number; height: number }) {
  const clock = useClock();
  const path = useDerivedValue(() => {
    const t = clock.value / 1000;
    let d = "";
    for (let i = 0; i < RAIN.length; i++) {
      const drop = RAIN[i];
      const span = height + drop.len;
      const y = ((drop.phase * span + t * drop.speed * 900) % span) - drop.len;
      const x = drop.x * width + y * 0.08;
      d += `M ${x} ${y} L ${x + drop.len * 0.08} ${y + drop.len} `;
    }
    return d;
  });
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Path path={path} style="stroke" strokeWidth={1.2} color="rgba(190, 205, 230, 0.32)" strokeCap="round" />
    </Canvas>
  );
}

/** Far-off lightning: every 7 to 16 seconds, the sky flickers twice and fades. */
function Lightning({ still }: { still: boolean }) {
  const flash = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    let timer: ReturnType<typeof setTimeout>;
    const strike = () => {
      const out = { duration: 260, easing: Easing.out(Easing.quad) };
      flash.set(withSequence(
        withTiming(0.34, { duration: 60 }),
        withTiming(0.06, { duration: 90 }),
        withTiming(0.26, { duration: 70 }),
        withTiming(0, out),
      ));
      timer = setTimeout(strike, 7000 + Math.random() * 9000);
    };
    timer = setTimeout(strike, 3500 + Math.random() * 4000);
    return () => clearTimeout(timer);
  }, [still, flash]);
  const style = useAnimatedStyle(() => ({ opacity: flash.get() }));
  return <Animated.View style={[StyleSheet.absoluteFill, styles.flash, style]} />;
}

const styles = StyleSheet.create({
  // Brightest high up, where the storm is.
  flash: { backgroundColor: "rgb(200, 214, 255)" },
});
