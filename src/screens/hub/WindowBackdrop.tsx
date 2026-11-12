// Home's backdrop, her reading nook on a rainy night (docs/ART_DIRECTION.md,
// the mystery-book core): one 3D set (scripts/blender/props/home_set.py,
// finished by scripts/brand/window.py into assets/home/set/), rendered from
// one camera in depth layers that slide against each other as the phone
// tilts (parallax/: useTilt, ParallaxLayer; PARALLAX.depth in art/nook.ts).
// Back to front:
// - the sky: midnight indigo going mauve under a low overcast, a full moon
//   veiled by thin cloud low on the right;
// - a far line of pines in the haze, a cottage with one window lit; a nearer,
//   darker line;
// - live, on a canvas: thin cloud drifting across the glass and over the moon,
//   lit silver as it passes it, the moon's soft corona through it (they slide
//   with the sky); rain hitting the glass, softly: drops land, bead, then some
//   run down leaving a trail (they slide with the glass);
// - the wet glass: a sheen, the frame's shadow and the candle's flame mirrored
//   in it (soft: `haze`), beads and runs of rain (`glass`);
// - the window: plum-stained wood with real depth, a brass latch on the middle
//   bar, the window's key hung from it;
// - the sill and the still life on it: three cloth-bound mysteries (one per
//   mode), spectacles folded on top, a brass chamberstick and its candle. The
//   sill is what everything turns about: it, the cat and the cat's mug
//   (HubScreen draws them over this) never move;
// - live again: the candle's flame (rendered frames, 12 fps) and its warm
//   halo, breathing and flickering; fairy lights strung across the top in the
//   theme's glow, sweet and foil, twinkling slowly (they slide with the frame).
// Nearest of all, the curtains' edges (WindowForeground: HubScreen lays them
// over the cat, under the cards). The rendered layers lie over the rain and
// under the lights, so the rain stays on the glass: behind the frame, the
// sill and everything standing on it.
// Under reduced motion it is all still: no parallax, the clouds hold their
// places (one across the moon), no drops landing, the flame and the lights
// steady. No lightning: the storm is a quiet one.
import { useEffect, useMemo } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurMask, Canvas, Circle, Group, Oval, Path, RadialGradient, Skia, useClock, vec } from "@shopify/react-native-skia";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import SET from "../../../assets/home/set/set.json";
import { BULB_GLOW, BULB_PHASE, CANDLE, CLOUDS, FAIRY, FLAME, MS_TO_S, PARALLAX, RAIN, SHOWER, WINDOW_ART as ART, flicker, sag, type DropSpec } from "./art/nook";
import { ParallaxLayer } from "./parallax/ParallaxLayer";
import { layerShift } from "./parallax/tilt";
import type { TiltValues } from "./parallax/useTilt";

/** The set's layers (assets/home/set/, their places on the art in set.json). */
const PICTURES = {
  sky: require("../../../assets/home/set/sky.jpg") as number,
  far: require("../../../assets/home/set/far.png") as number,
  near: require("../../../assets/home/set/near.png") as number,
  haze: require("../../../assets/home/set/haze.png") as number,
  glass: require("../../../assets/home/set/glass.png") as number,
  frame: require("../../../assets/home/set/frame.png") as number,
  sill: require("../../../assets/home/set/sill.png") as number,
  "fore-left": require("../../../assets/home/set/fore-left.png") as number,
  "fore-right": require("../../../assets/home/set/fore-right.png") as number,
} as const;
type LayerName = keyof typeof PICTURES;
const FLAME_SHEET = require("../../../assets/home/flame.png") as number;
/** A clock in ms to seconds. */
const PER_SECOND = MS_TO_S;
const TURN = Math.PI * 2;

/** Where the set's art lies on a screen, and its sill. Points. */
export interface WindowGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  /** The sill's height at the screen's foot: its top is this far above the bottom edge. */
  sill: number;
}

/**
 * The art covers the screen, keeping its aspect. Where the screen is wider
 * than the art (a 375 x 667 phone) the overflow is cut from the top only, so
 * the sill always stays on the screen's foot (the header covers the top of
 * the frame); where it is narrower the sides are cut evenly.
 */
export function windowGeometry(screenWidth: number, screenHeight: number): WindowGeometry {
  const scale = Math.max(screenWidth / ART.width, screenHeight / ART.height);
  const width = ART.width * scale;
  const height = ART.height * scale;
  return { left: (screenWidth - width) / 2, top: screenHeight - height, width, height, sill: height * ART.sill };
}

/** A layer's box on the screen: its place on the art (set.json, art pixels; it may reach past the art, into its bleed). */
export function layerBox(name: LayerName, art: WindowGeometry) {
  const [x, y, w, h] = SET.layers[name].rect;
  const k = art.width / ART.width;
  return { left: art.left + x * k, top: art.top + y * k, width: w * k, height: h * k };
}

function Picture({ name, art, tilt, depth, turn }: { name: LayerName; art: WindowGeometry; tilt: TiltValues; depth: number; turn?: number }) {
  return (
    <ParallaxLayer tilt={tilt} depth={depth} turn={turn} style={StyleSheet.absoluteFill} testID={`hub-window-${name}`}>
      <Image source={PICTURES[name]} style={[styles.picture, layerBox(name, art)]} resizeMode="stretch" accessibilityIgnoresInvertColors />
    </ParallaxLayer>
  );
}

export function WindowBackdrop({ tilt }: { tilt: TiltValues }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const art = windowGeometry(width, height);
  const D = PARALLAX.depth;
  // The glass: inside the frame, above the sill (the rain lands on it).
  const glass = {
    left: art.left + art.width * ART.frameX,
    top: art.top + art.height * ART.frameY,
    width: art.width * (1 - 2 * ART.frameX),
    height: art.height * (1 - ART.frameY - ART.sill),
  };
  const sky: Sky = { art, glass, moon: { x: art.left + art.width * SET.moon[0], y: art.top + art.height * SET.moon[1], r: art.width * SET.moon[2] } };
  const flame = vec(art.left + art.width * SET.flame[0], art.top + art.height * SET.flame[1]);
  const wick = { x: art.left + art.width * SET.wick[0], y: art.top + art.height * SET.wick[1] };
  const colors = useMemo(() => [theme.glow, theme.sweet, theme.foil], [theme.glow, theme.sweet, theme.foil]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none" testID="hub-window">
      <Picture name="sky" art={art} tilt={tilt} depth={D.sky} />
      <Picture name="far" art={art} tilt={tilt} depth={D.far} />
      <Picture name="near" art={art} tilt={tilt} depth={D.near} />
      {/* Behind the glass's own picture, the frame and the sill: the cloud, and the rain on the glass. */}
      <Canvas style={StyleSheet.absoluteFill} testID="hub-window-weather">
        {reducedMotion ? <StillWeather sky={sky} /> : <LiveWeather sky={sky} tilt={tilt} />}
      </Canvas>
      <Picture name="haze" art={art} tilt={tilt} depth={D.glass} />
      <Picture name="glass" art={art} tilt={tilt} depth={D.glass} />
      <Picture name="frame" art={art} tilt={tilt} depth={D.frame} />
      <Picture name="sill" art={art} tilt={tilt} depth={D.sill} />
      <CandleFlame wick={wick} scale={art.width / ART.width} still={reducedMotion} />
      <Canvas style={StyleSheet.absoluteFill} testID="hub-window-lights">
        {reducedMotion ? (
          <StillLights flame={flame} glow={theme.glow} width={width} top={insets.top} colors={colors} />
        ) : (
          <LiveLights flame={flame} glow={theme.glow} width={width} top={insets.top} colors={colors} tilt={tilt} />
        )}
      </Canvas>
    </View>
  );
}

/** The curtains' edges, nearest of all: over the sill and the cat, under the cards (HubScreen). They slide the other way, furthest. */
export function WindowForeground({ tilt }: { tilt: TiltValues }) {
  const { width, height } = useWindowDimensions();
  const art = windowGeometry(width, height);
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none" testID="hub-window-fore">
      <Picture name="fore-left" art={art} tilt={tilt} depth={PARALLAX.depth.fore} turn={PARALLAX.turn} />
      <Picture name="fore-right" art={art} tilt={tilt} depth={PARALLAX.depth.fore} turn={PARALLAX.turn} />
    </View>
  );
}

/** The art on screen, the glass inside its frame, and the moon (its centre and radius), in points. */
interface Sky {
  art: WindowGeometry;
  glass: { left: number; top: number; width: number; height: number };
  moon: { x: number; y: number; r: number };
}

interface LightsProps {
  flame: { x: number; y: number };
  glow: string;
  /** The screen's width, and the safe top the fairy lights hang under. */
  width: number;
  top: number;
  colors: readonly string[];
}

/** A layer's slide as a Skia transform. */
function useSlide(tilt: TiltValues, depth: number) {
  return useDerivedValue(() => {
    const shift = layerShift({ x: tilt.x.value, y: tilt.y.value }, depth);
    return [{ translateX: shift.x }, { translateY: shift.y }];
  });
}

/** Reduced motion: the clouds hold their places; no rain. */
function StillWeather({ sky }: { sky: Sky }) {
  const clouds = useSharedValue(0);
  return <Clouds sky={sky} clock={clouds} />;
}

function LiveWeather({ sky, tilt }: { sky: Sky; tilt: TiltValues }) {
  const clock = useClock();
  const { glass } = sky;
  const far = useSlide(tilt, PARALLAX.depth.sky);
  const near = useSlide(tilt, PARALLAX.depth.rain);
  return (
    <>
      <Group transform={far}>
        <Clouds sky={sky} clock={clock} />
      </Group>
      <Group transform={near}>
        <Group transform={[{ translateX: glass.left }, { translateY: glass.top }]}>
          {SHOWER.map((d, i) => (
            <Drop key={i} spec={d} clock={clock} width={glass.width} height={glass.height} />
          ))}
        </Group>
      </Group>
    </>
  );
}

/** Reduced motion: the candle and the lights, steady. */
function StillLights({ flame, glow, width, top, colors }: LightsProps) {
  const halo = useSharedValue<number>(CANDLE.rest);
  const lit = useSharedValue<number>(FAIRY.rest);
  return (
    <>
      <Flame at={flame} glow={glow} opacity={halo} />
      <FairyLights width={width} top={top} colors={colors} clock={lit} />
    </>
  );
}

function LiveLights({ flame, glow, width, top, colors, tilt }: LightsProps & { tilt: TiltValues }) {
  const clock = useClock();
  const halo = useDerivedValue(() => {
    return CANDLE.rest + CANDLE.flicker * flicker(clock.value * PER_SECOND);
  });
  const hung = useSlide(tilt, PARALLAX.depth.lights);
  return (
    <>
      <Flame at={flame} glow={glow} opacity={halo} />
      <Group transform={hung}>
        <FairyLights width={width} top={top} colors={colors} clock={clock} />
      </Group>
    </>
  );
}

/**
 * The candle's flame itself: FLAME.frames rendered frames in a row
 * (assets/home/flame.png), the wick's tip at `wick` on the screen, stepped at
 * FLAME.fps like the cat. `still`: its first frame.
 */
function CandleFlame({ wick, scale, still }: { wick: { x: number; y: number }; scale: number; still: boolean }) {
  const w = FLAME.width * scale;
  const h = FLAME.height * scale;
  const t = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    t.set(withRepeat(withTiming(FLAME.frames, { duration: (FLAME.frames / FLAME.fps) / PER_SECOND, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(t);
      t.set(0);
    };
  }, [still, t]);
  const strip = useAnimatedStyle(() => ({ transform: [{ translateX: -Math.min(FLAME.frames - 1, Math.floor(t.get())) * w }] }));
  return (
    <View style={[styles.flame, { left: wick.x - w / 2, top: wick.y - h * FLAME.foot, width: w, height: h }]} testID="hub-window-flame">
      <Animated.Image source={FLAME_SHEET} style={[{ width: w * FLAME.frames, height: h }, strip]} resizeMode="stretch" accessibilityIgnoresInvertColors />
    </View>
  );
}

/** The drifting cloud (CLOUDS), and the moon's soft corona through it. `clock` in ms. */
function Clouds({ sky, clock }: { sky: Sky; clock: SharedValue<number> }) {
  const { moon } = sky;
  const corona = moon.r * CLOUDS.corona;
  return (
    <>
      {CLOUDS.list.map((spec, i) => (
        <Cloud key={i} spec={spec} sky={sky} clock={clock} />
      ))}
      <Group blendMode="screen" opacity={CLOUDS.glow}>
        <Circle cx={moon.x} cy={moon.y} r={corona}>
          <RadialGradient c={vec(moon.x, moon.y)} r={corona} colors={[CLOUDS.lit, CLOUDS.clear]} />
        </Circle>
      </Group>
    </>
  );
}

function Cloud({ spec, sky, clock }: { spec: (typeof CLOUDS.list)[number]; sky: Sky; clock: SharedValue<number> }) {
  const { art, glass, moon } = sky;
  const w = spec.w * art.width;
  const h = spec.h * art.width;
  const y = art.top + spec.y * art.height;
  // It wraps round a run of the glass and a margin each side.
  const from = glass.left - glass.width * CLOUDS.margin;
  const span = glass.width * (1 + 2 * CLOUDS.margin);
  const start = art.left + spec.x * art.width - from;
  const cx = useDerivedValue(() => {
    const x = start + spec.speed * clock.value * PER_SECOND;
    return from + (((x % span) + span) % span);
  });
  const transform = useDerivedValue(() => [{ translateX: cx.value }]);
  // Lit silver as it nears the moon: by the gap between the moon and the cloud's near edge, in moon radii.
  const lit = useDerivedValue(() => {
    const gap = Math.hypot(Math.max(0, Math.abs(cx.value - moon.x) - w / 2), Math.max(0, Math.abs(y - moon.y) - h / 2)) / moon.r;
    return spec.alpha * CLOUDS.litMax * Math.max(0, 1 - gap / CLOUDS.reach);
  });
  const blur = h * CLOUDS.blur;
  return (
    <Group transform={transform}>
      <Oval x={-w / 2} y={y - h / 2} width={w} height={h} color={CLOUDS.color} opacity={spec.alpha}>
        <BlurMask blur={blur} style="normal" />
      </Oval>
      <Oval x={-w / 2} y={y - h / 2} width={w} height={h} color={CLOUDS.lit} opacity={lit}>
        <BlurMask blur={blur} style="normal" />
      </Oval>
    </Group>
  );
}

/** The candle's light: a warm halo round the flame, and a brighter core. */
function Flame({ at, glow, opacity }: { at: { x: number; y: number }; glow: string; opacity: SharedValue<number> }) {
  const core = useDerivedValue(() => Math.min(1, opacity.value * 2));
  return (
    <Group blendMode="screen">
      <Group opacity={opacity}>
        <Circle cx={at.x} cy={at.y} r={CANDLE.halo}>
          <RadialGradient c={vec(at.x, at.y)} r={CANDLE.halo} colors={[glow, `${glow}00`]} />
        </Circle>
      </Group>
      <Group opacity={core}>
        <Circle cx={at.x} cy={at.y} r={CANDLE.core}>
          <RadialGradient c={vec(at.x, at.y)} r={CANDLE.core} colors={[glow, `${glow}00`]} />
        </Circle>
      </Group>
    </Group>
  );
}

/**
 * Fairy lights: FAIRY.swags loops of dark wire across the top of the screen,
 * a bulb every FAIRY.pitch along them, in the given colours in turn, each
 * with a soft glow, twinkling on `clock` (in ms; a value of 1 or less holds
 * them still at it). The wire runs PARALLAX.bleed past each side (it slides).
 */
function FairyLights({ width, top, colors, clock }: { width: number; top: number; colors: readonly string[]; clock: SharedValue<number> }) {
  const { wire, bulbs } = useMemo(() => {
    const span = width / FAIRY.swags;
    const y0 = top + FAIRY.top;
    // Each swag a parabola from one anchor to the next.
    const at = (x: number) => {
      const k = (((x % span) + span) % span) / span;
      return y0 + FAIRY.sag * sag(k);
    };
    const b = Skia.PathBuilder.Make();
    b.moveTo(-span, y0);
    for (let i = -1; i <= FAIRY.swags; i += 1) {
      const x0 = i * span;
      // A quad's control point sits at twice the sag it reaches.
      b.quadTo(x0 + span / 2, y0 + FAIRY.sag * 2, x0 + span, y0);
    }
    const count = Math.floor(width / FAIRY.pitch);
    const offset = (width - (count - 1) * FAIRY.pitch) / 2;
    const spare = Math.ceil(PARALLAX.bleed / FAIRY.pitch);
    const list = Array.from({ length: count + 2 * spare }, (_, n) => {
      const i = n - spare;
      const x = offset + i * FAIRY.pitch;
      return { x, y: at(x) + FAIRY.bulb, color: colors[(((i % colors.length) + colors.length) % colors.length)], phase: (((i * BULB_PHASE) % TURN) + TURN) % TURN };
    });
    return { wire: b.build(), bulbs: list };
  }, [width, top, colors]);
  return (
    <Group>
      <Path path={wire} style="stroke" strokeWidth={FAIRY.wireWidth} color={FAIRY.wire} />
      {bulbs.map((bulb, i) => (
        <Bulb key={i} {...bulb} clock={clock} />
      ))}
    </Group>
  );
}

function Bulb({ x, y, color, phase, clock }: { x: number; y: number; color: string; phase: number; clock: SharedValue<number> }) {
  // A clock ticks in ms; a still value sits between 0 and 1 and is used as it is.
  const opacity = useDerivedValue(() => {
    const v = clock.value;
    if (v <= 1) return v;
    return FAIRY.rest + FAIRY.swing * Math.sin(v * PER_SECOND * FAIRY.speed + phase);
  });
  return (
    <Group opacity={opacity}>
      <Circle cx={x} cy={y} r={FAIRY.glow} color={color} opacity={BULB_GLOW}>
        <BlurMask blur={FAIRY.glow / 2} style="normal" />
      </Circle>
      <Circle cx={x} cy={y} r={FAIRY.bulb} color={color} />
    </Group>
  );
}

/**
 * One drop's life, on a loop: it lands (a quick swell), beads a while, then
 * either runs down leaving a thin trail or simply fades, and lands again.
 */
function Drop({ spec, clock, width, height }: { spec: DropSpec; clock: SharedValue<number>; width: number; height: number }) {
  const x0 = spec.x * width;
  const y0 = spec.y * height;
  const p = useDerivedValue(() => ((clock.value * PER_SECOND) / spec.period + spec.phase) % 1);
  const fall = useDerivedValue(() => {
    if (!spec.runs || p.value < RAIN.runAt) return 0;
    const t = (p.value - RAIN.runAt) / (1 - RAIN.runAt);
    return spec.run * t * t;
  });
  const cy = useDerivedValue(() => y0 + fall.value);
  const r = useDerivedValue(() => {
    const land = Math.min(1, p.value / RAIN.land);
    return spec.r * (RAIN.from + (1 - RAIN.from) * land) * (spec.runs && p.value > RAIN.runAt ? RAIN.running : 1);
  });
  const alpha = useDerivedValue(() => {
    const fadeIn = Math.min(1, p.value / RAIN.fadeIn);
    const fadeOut = p.value > RAIN.fadeAt ? (1 - p.value) / (1 - RAIN.fadeAt) : 1;
    return fadeIn * fadeOut;
  });
  // The wet streak a running drop leaves: as wide as the drop, faint, straight down.
  const trail = useDerivedValue(() => (fall.value > 2 ? `M ${x0} ${y0} L ${x0} ${y0 + fall.value}` : `M ${x0} ${y0}`));
  const highlightY = useDerivedValue(() => cy.value + r.value * RAIN.glint.dy);
  const highlightR = useDerivedValue(() => r.value * RAIN.glint.r);
  return (
    <Group opacity={alpha}>
      <Path path={trail} style="stroke" strokeWidth={spec.r * RAIN.trailWidth} color={RAIN.trail} strokeCap="round" />
      <Circle cx={x0} cy={cy} r={r} color={RAIN.body} />
      <Circle cx={x0} cy={cy} r={r} style="stroke" strokeWidth={1} color={RAIN.edge} />
      <Circle cx={x0} cy={highlightY} r={highlightR} color={RAIN.highlight} />
    </Group>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  picture: { position: "absolute" },
  flame: { position: "absolute", overflow: "hidden" },
});
