// Home's backdrop: a four-pane window filling the phone (its frame and sill on
// the screen's edges, a cross of mullions), a deep blue rainy dusk over pines
// behind the glass (assets/backdrop/window.jpg, scripts/brand/window.py). Rain
// keeps hitting the glass: drops land, bead, then some run down leaving a
// trail; and now and then lightning flickers far off behind the trees. All of
// it stays on the glass, so the frame is solid. Under reduced motion the
// glass is still: no drops landing and no flashes.
import { useEffect } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import { Canvas, Circle, Group, Path, useClock } from "@shopify/react-native-skia";
import { useTheme } from "@/theme/ThemeProvider";

const WINDOW = require("../../../assets/backdrop/window.jpg") as number;
/** The art's geometry as fractions (scripts/brand/window.py): frame, sill, mullion, the cross's height. */
const ART = { frameX: 0.0496, frameY: 0.0229, sill: 0.0536, mullion: 0.0357, cross: 0.5 } as const;
const DROPS = 46;

interface DropSpec {
  x: number;       // 0..1 across the glass
  y: number;       // 0..1 down it
  r: number;       // bead radius (points)
  period: number;  // seconds per cycle
  phase: number;   // 0..1
  runs: boolean;   // runs down the glass after beading
  run: number;     // how far it runs (points)
}

/** A fixed shower (the same every launch), from a cheap hash. */
const SHOWER: DropSpec[] = Array.from({ length: DROPS }, (_, i) => {
  const h = (n: number) => {
    const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  return { x: h(1), y: h(2) * 0.9, r: 2.5 + h(3) * 4.5, period: 3.5 + h(4) * 5, phase: h(5), runs: h(6) < 0.45, run: 80 + h(7) * 260 };
});

export function WindowBackdrop() {
  const { width, height } = useWindowDimensions();
  const { reducedMotion } = useTheme();
  // The glass: inside the frame, above the sill (the mullions are painted; drops may cross them under the art's own).
  const left = width * ART.frameX;
  const top = height * ART.frameY;
  const w = width - 2 * left;
  const h = height - top - height * ART.sill;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="hub-window">
      <Image source={WINDOW} style={[StyleSheet.absoluteFill, { width, height }]} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={{ position: "absolute", left, top, width: w, height: h, overflow: "hidden" }}>
        <Lightning still={reducedMotion} />
        {reducedMotion ? null : <Rain width={w} height={h} />}
      </View>
      {/* The mullions over the rain, so drops stay on the glass. */}
      <View style={[styles.mullion, { left: width / 2 - (width * ART.mullion) / 2, width: width * ART.mullion, top, height: h }]} />
      <View style={[styles.mullion, { top: height * ART.cross - (width * ART.mullion) / 2, height: width * ART.mullion, left, width: w }]} />
    </View>
  );
}

function Rain({ width, height }: { width: number; height: number }) {
  const clock = useClock();
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {SHOWER.map((d, i) => (
        <Drop key={i} spec={d} clock={clock} width={width} height={height} />
      ))}
    </Canvas>
  );
}

/**
 * One drop's life, on a loop: it lands (a quick swell), beads a while, then
 * either runs down leaving a thin trail or simply fades, and lands again
 * somewhere near.
 */
function Drop({ spec, clock, width, height }: { spec: DropSpec; clock: SharedValue<number>; width: number; height: number }) {
  const x0 = spec.x * width;
  const y0 = spec.y * height;
  const phase = useDerivedValue(() => (((clock.value / 1000) / spec.period + spec.phase) % 1));
  const fall = useDerivedValue(() => {
    const p = phase.value;
    if (!spec.runs || p < 0.55) return 0;
    const t = (p - 0.55) / 0.45;
    return spec.run * t * t;
  });
  const cx = useDerivedValue(() => x0 + Math.sin(fall.value / 30) * 3);
  const cy = useDerivedValue(() => y0 + fall.value);
  const r = useDerivedValue(() => {
    const p = phase.value;
    const land = Math.min(1, p / 0.06);
    return spec.r * (0.4 + 0.6 * land) * (spec.runs && p > 0.55 ? 0.85 : 1);
  });
  const alpha = useDerivedValue(() => {
    const p = phase.value;
    const fadeIn = Math.min(1, p / 0.04);
    const fadeOut = p > 0.9 ? (1 - p) / 0.1 : 1;
    return fadeIn * fadeOut;
  });
  const trail = useDerivedValue(() => (fall.value > 2 ? `M ${x0} ${y0} Q ${x0 + 2} ${y0 + fall.value / 2} ${x0 + Math.sin(fall.value / 30) * 3} ${y0 + fall.value}` : ""));
  const highlightY = useDerivedValue(() => cy.value + r.value * 0.35);
  const highlightR = useDerivedValue(() => r.value * 0.45);
  return (
    <Group opacity={alpha}>
      <Path path={trail} style="stroke" strokeWidth={Math.max(1, spec.r * 0.5)} color="rgba(205, 220, 255, 0.28)" strokeCap="round" />
      <Circle cx={cx} cy={cy} r={r} color="rgba(170, 192, 245, 0.30)" />
      <Circle cx={cx} cy={cy} r={r} style="stroke" strokeWidth={1} color="rgba(10, 16, 40, 0.45)" />
      <Circle cx={cx} cy={highlightY} r={highlightR} color="rgba(240, 246, 255, 0.75)" />
    </Group>
  );
}

/** Far-off lightning: every 7 to 16 seconds the sky flickers twice and fades. */
function Lightning({ still }: { still: boolean }) {
  const flash = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    let timer: ReturnType<typeof setTimeout>;
    const strike = () => {
      flash.set(withSequence(
        withTiming(0.32, { duration: 60 }),
        withTiming(0.05, { duration: 90 }),
        withTiming(0.24, { duration: 70 }),
        withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) }),
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
  flash: { backgroundColor: "rgb(196, 212, 255)" },
  // Matches the art's mullion wood, lit on its top/left edge.
  mullion: { position: "absolute", backgroundColor: "rgb(40, 32, 29)", borderLeftWidth: 1, borderTopWidth: 1, borderColor: "rgb(78, 64, 56)" },
});
