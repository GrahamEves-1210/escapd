// Paranormal hotspot effects (docs/DESIGN.md, Modes · Paranormal): each
// visible hotspot's `effect` drawn over the photo in the mode's glow, on the
// stage, so it pans and zooms with the room. Never touchable and hidden from
// screen readers: the hotspot's own button carries its name, and an effect
// is mood, never the only sign of a clue.
//
// The one exception to "no ambient animation": a paranormal effect loops
// while it is in view, on the UI thread, opacity and transform only (the
// Svg inside each one is drawn once). The player renders this layer only on
// the page in view, so nothing animates off screen. Under reduced motion
// each effect is a still at its `rest` strength.
import { memo, useEffect, useId } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from "react-native-svg";
import type { Hotspot, HotspotEffect } from "@/lib/puzzle-types";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import type { Size } from "./geometry";

const E = ref.layout.play.effects;

export interface EffectLayerProps {
  /** Visible hotspots on the page in view; those with an effect are drawn. */
  hotspots: Hotspot[];
  /** The image box at 1x, in points. */
  stage: Size;
  /** The presence is gone (case closed): every effect fades away. */
  gone?: boolean;
}

export function EffectLayer({ hotspots, stage, gone = false }: EffectLayerProps) {
  const { reducedMotion } = useTheme();
  const fade = useSharedValue(1);
  useEffect(() => {
    fade.set(withTiming(gone ? 0 : 1, { duration: reducedMotion ? motion.reducedFade : ref.motion.treatment.duration }));
  }, [gone, reducedMotion, fade]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  const haunted = hotspots.filter((h): h is Hotspot & { effect: HotspotEffect } => h.effect !== undefined);
  if (haunted.length === 0 || stage.width <= 0) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, fadeStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="effect-layer"
    >
      {haunted.map((h) => (
        <Effect key={h.id} hotspot={h} effect={h.effect} stage={stage} still={reducedMotion} />
      ))}
    </Animated.View>
  );
}

interface EffectProps {
  hotspot: Hotspot;
  effect: HotspotEffect;
  stage: Size;
  still: boolean;
}

const Effect = memo(function Effect({ hotspot, effect, stage, still }: EffectProps) {
  const rect = {
    left: hotspot.shape.x * stage.width,
    top: hotspot.shape.y * stage.height,
    width: hotspot.shape.w * stage.width,
    height: hotspot.shape.h * stage.height,
  };
  const props = { rect, still, testID: `effect-${effect}-${hotspot.id}` };
  switch (effect) {
    case "flicker":
      return <Flicker {...props} />;
    case "apparition":
      return <Apparition {...props} />;
    case "moved":
      return <Moved {...props} />;
    case "cold":
      return <Cold {...props} />;
    case "whisper":
      return <Whisper {...props} />;
    default:
      return null;
  }
});

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PieceProps {
  rect: Box;
  still: boolean;
  testID: string;
}

/** A unique gradient id per effect (Svg ids are document-wide on the web). */
function useGradientId(prefix: string) {
  return `${prefix}${useId().replace(/[^A-Za-z0-9]/g, "")}`;
}

/** Loops `value` through `steps` ([value, ms] pairs) forever, or holds it at `rest` when still. */
function useLoop(value: SharedValue<number>, still: boolean, rest: number, steps: readonly (readonly [number, number])[], delay = 0) {
  useEffect(() => {
    if (still) {
      cancelAnimation(value);
      value.set(rest);
      return;
    }
    const [first, ...others] = steps.map(([to, duration]) => withTiming(to, { duration, easing: Easing.inOut(Easing.sin) }));
    value.set(withDelay(delay, withRepeat(withSequence(first, ...others), -1, false)));
    return () => cancelAnimation(value);
    // steps are built from tokens: stable for the effect's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, value, rest, delay]);
}

/** flicker: a pool of light over the object that stutters, then steadies, like a failing bulb. */
function Flicker({ rect, still, testID }: PieceProps) {
  const theme = useModeTheme();
  const F = E.flicker;
  const id = useGradientId("flicker");
  const opacity = useSharedValue<number>(F.rest);
  const c = F.cycle;
  useLoop(opacity, still, F.rest, [
    [F.peak, c * 0.03], [F.low, c * 0.04], [F.peak, c * 0.02], [F.low * 1.5, c * 0.06],
    [F.peak, c * 0.03], [F.rest, c * 0.42], [F.peak * 0.9, c * 0.2], [F.rest, c * 0.2],
  ]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const w = Math.max(rect.width * F.spread, F.min);
  const h = Math.max(rect.height * F.spread, F.min);
  return (
    <Animated.View
      style={[styles.piece, { left: rect.left - (w - rect.width) / 2, top: rect.top - (h - rect.height) / 2, width: w, height: h }, style]}
      testID={testID}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={theme.glow ?? theme.ink} stopOpacity={F.core} />
            <Stop offset="1" stopColor={theme.glow ?? theme.ink} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** apparition: a faint figure where something stands, a haze under a head, breathing and drifting. */
function Apparition({ rect, still, testID }: PieceProps) {
  const theme = useModeTheme();
  const A = E.apparition;
  const id = useGradientId("apparition");
  const opacity = useSharedValue<number>(A.rest);
  const drift = useSharedValue<number>(0);
  useLoop(opacity, still, A.rest, [[A.peak, A.cycle / 2], [A.low, A.cycle / 2]]);
  useLoop(drift, still, 0, [[-A.drift, A.cycle * 0.6], [A.drift / 2, A.cycle * 0.4]]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateY: drift.get() }] }));
  // Drawn larger than the target, so the haze thins out past its edges instead of stopping at them.
  const w = rect.width * A.spread;
  const h = rect.height * A.spread;
  const frame = { left: rect.left - (w - rect.width) / 2, top: rect.top - (h - rect.height) / 2, width: w, height: h };
  const rx = rect.width * A.rx;
  const ry = rect.height * A.ry;
  const cy = h / 2 + ry * (1 - A.headRise) / 2;
  const head = rx * A.head;
  const glow = theme.glow ?? theme.ink;
  return (
    <Animated.View style={[styles.piece, frame, style]} testID={testID}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={theme.ink} stopOpacity={A.core} />
            <Stop offset="0.45" stopColor={glow} stopOpacity={A.core / 2.5} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={cy} rx={rx} ry={ry} fill={`url(#${id})`} />
        <Ellipse cx={w / 2} cy={cy - ry * A.headRise} rx={head} ry={head * 1.15} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** moved: the object's ghost outline, a little off from where it stands, easing back and away. */
function Moved({ rect, still, testID }: PieceProps) {
  const theme = useModeTheme();
  const M = E.moved;
  const opacity = useSharedValue<number>(M.rest);
  const settle = useSharedValue<number>(0);
  useLoop(opacity, still, M.rest, [[M.peak, M.cycle / 2], [M.low, M.cycle / 2]]);
  useLoop(settle, still, 0, [[M.settle, M.cycle / 2], [0, M.cycle / 2]]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: M.dx * (1 - settle.get()) }, { translateY: M.dy * (1 - settle.get()) }],
  }));
  const inset = M.stroke / 2;
  return (
    <Animated.View style={[styles.piece, rect, style]} testID={testID}>
      <Svg width={rect.width} height={rect.height}>
        <Rect
          x={inset}
          y={inset}
          width={Math.max(0, rect.width - M.stroke)}
          height={Math.max(0, rect.height - M.stroke)}
          rx={M.radius}
          fill="none"
          stroke={theme.glow ?? theme.ink}
          strokeWidth={M.stroke}
          strokeDasharray={[M.dash, M.dash]}
        />
      </Svg>
    </Animated.View>
  );
}

/** cold: frost gathering round the object's edges, clear at its heart, thinning out past it. */
function Cold({ rect, still, testID }: PieceProps) {
  const theme = useModeTheme();
  const C = E.cold;
  const id = useGradientId("cold");
  const opacity = useSharedValue<number>(C.rest);
  useLoop(opacity, still, C.rest, [[C.peak, C.cycle / 2], [C.low, C.cycle / 2]]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const w = rect.width * C.spread;
  const h = rect.height * C.spread;
  const frame = { left: rect.left - (w - rect.width) / 2, top: rect.top - (h - rect.height) / 2, width: w, height: h };
  return (
    <Animated.View style={[styles.piece, frame, style]} testID={testID}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset={C.inner} stopColor={theme.ink} stopOpacity={0} />
            <Stop offset={C.rim} stopColor={theme.ink} stopOpacity={C.edge} />
            <Stop offset="1" stopColor={theme.ink} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** whisper: soft rings rippling out from the object, one after the other: cold white, then the glow. */
function Whisper({ rect, still, testID }: PieceProps) {
  const theme = useModeTheme();
  const W = E.whisper;
  const d = Math.max(rect.width, rect.height) * W.to;
  const frame = { left: rect.left + rect.width / 2 - d / 2, top: rect.top + rect.height / 2 - d / 2, width: d, height: d };
  return (
    <View style={[styles.piece, frame]} testID={testID}>
      <Ripple size={d} color={theme.ink} still={still} rest={W.rest[0]} delay={0} />
      <Ripple size={d} color={theme.glow ?? theme.ink} still={still} rest={W.rest[1]} delay={W.cycle / 2} stillScale={W.from + (1 - W.from) / 2} />
    </View>
  );
}

function Ripple({ size, color, still, rest, delay, stillScale = 1 }: {
  size: number;
  color: string;
  still: boolean;
  rest: number;
  delay: number;
  stillScale?: number;
}) {
  const W = E.whisper;
  const grow = useSharedValue<number>(still ? stillScale : W.from);
  useEffect(() => {
    if (still) {
      cancelAnimation(grow);
      grow.set(stillScale);
      return;
    }
    grow.set(W.from);
    // Steady growth, so one ring is always partway out while the other starts.
    grow.set(withDelay(delay, withRepeat(withTiming(1, { duration: W.cycle, easing: Easing.linear }), -1, false)));
    return () => cancelAnimation(grow);
  }, [still, delay, stillScale, grow, W.from, W.cycle]);
  const style = useAnimatedStyle(() => {
    const g = grow.get();
    // Fades as it grows: full at `from`, gone at the edge.
    const t = (g - W.from) / (1 - W.from);
    return { opacity: still ? rest : W.peak * (1 - t), transform: [{ scale: g }] };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderColor: color, borderWidth: W.stroke }, style]} />
  );
}

const styles = StyleSheet.create({
  piece: { position: "absolute" },
});
