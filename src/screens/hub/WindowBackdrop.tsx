// Home's backdrop, her reading nook on a rainy night (docs/ART_DIRECTION.md,
// the mystery-book core): a four-pane window filling the phone, its painted
// plum-brown frame and sill on the screen's edges and a cross of mullions;
// behind the glass a midnight-indigo sky going mauve under a low, rainy
// overcast, a full moon veiled by thin cloud in the lower right pane over a
// soft treeline, and on the sill a stack of books with a lit candle and a mug
// of tea (assets/backdrop/window.jpg, scripts/brand/window.py). Over the art,
// on one canvas:
// - thin cloud keeps drifting across the glass, over the moon, lit silver as
//   it passes in front of it, the moon's soft corona through it;
// - rain keeps hitting the glass, softly: drops land, bead, then some run
//   down leaving a trail. All of it stays on the glass: inside the four panes
//   (clipped), so the frame and the sill stay solid, and round the books, the
//   candle and the mug on the sill (PROPS), which stand in front of it (the
//   cat, drawn over this canvas, too);
// - steam curls up off the tea;
// - the candle's flame breathes and flickers, a warm halo in the theme's glow;
// - fairy lights strung across the top, in the theme's glow, sweet and foil,
//   twinkling slowly.
// Under reduced motion it is all still: the clouds hold their places (one
// across the moon), the steam holds its curl, no drops landing, the flame
// and the lights steady. No lightning: the storm is a quiet one.
import { useMemo, type ReactNode } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { useDerivedValue, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurMask, Canvas, Circle, Group, LinearGradient, Oval, Path, RadialGradient, Skia, useClock, vec, type SkPath } from "@shopify/react-native-skia";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { BULB_GLOW, BULB_PHASE, CANDLE, CLOUDS, FAIRY, MS_TO_S, PROPS, RAIN, SHOWER, STEAM, WINDOW_ART as ART, flicker, sag, type DropSpec } from "./art/nook";

const WINDOW = require("../../../assets/backdrop/window.jpg") as number;
/** A clock in ms to seconds. */
const PER_SECOND = MS_TO_S;
const TURN = Math.PI * 2;

/** Where the window art lies on a screen, and its sill. Points. */
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

export function WindowBackdrop() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const art = windowGeometry(width, height);
  // The glass: inside the frame, above the sill; split into four panes by the mullions.
  const left = art.left + art.width * ART.frameX;
  const top = art.top + art.height * ART.frameY;
  const w = art.width * (1 - 2 * ART.frameX);
  const h = art.height * (1 - ART.frameY - ART.sill);
  const mullion = art.width * ART.mullion;
  const crossY = art.top + art.height * ART.cross;
  const midX = art.left + art.width / 2;
  const panes = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    const half = mullion / 2;
    b.addRect(Skia.XYWHRect(left, top, midX - half - left, crossY - half - top));
    b.addRect(Skia.XYWHRect(midX + half, top, left + w - midX - half, crossY - half - top));
    b.addRect(Skia.XYWHRect(left, crossY + half, midX - half - left, top + h - crossY - half));
    b.addRect(Skia.XYWHRect(midX + half, crossY + half, left + w - midX - half, top + h - crossY - half));
    return b.build();
  }, [left, top, w, h, mullion, crossY, midX]);
  // The things on the sill, in front of the glass: the glass's layers go round them.
  const props = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    const sx = art.width / ART.width;
    const sy = art.height / ART.height;
    for (const p of PROPS) {
      const rect = Skia.XYWHRect(art.left + p.x0 * sx, art.top + p.y0 * sy, (p.x1 - p.x0) * sx, (p.y1 - p.y0) * sy);
      if (p.oval) b.addOval(rect);
      else b.addRRect(Skia.RRectXY(rect, p.r * sx, p.r * sy));
    }
    return b.build();
  }, [art.left, art.top, art.width, art.height]);
  const flame = vec(art.left + art.width * ART.flame.x, art.top + art.height * ART.flame.y);
  const sky: Sky = {
    art,
    glass: { left, top, width: w, height: h },
    moon: { x: art.left + art.width * ART.moon.x, y: art.top + art.height * ART.moon.y, r: art.width * ART.moon.r },
  };
  const mug = { x: art.left + art.width * ART.mug.x, y: art.top + art.height * ART.mug.y, size: art.width * ART.mug.w };
  const nook: NookProps = { panes, props, sky, mug, flame, glow: theme.glow, width, top: insets.top, colors: [theme.glow, theme.sweet, theme.foil] };

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none" testID="hub-window">
      <Image
        source={WINDOW}
        style={{ position: "absolute", left: art.left, top: art.top, width: art.width, height: art.height }}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
      />
      <Canvas style={StyleSheet.absoluteFill}>{reducedMotion ? <StillNook {...nook} /> : <LiveNook {...nook} />}</Canvas>
    </View>
  );
}

/** The art on screen, the glass inside its frame, and the moon (its centre and radius), in points. */
interface Sky {
  art: WindowGeometry;
  glass: { left: number; top: number; width: number; height: number };
  moon: { x: number; y: number; r: number };
}

interface NookProps {
  /** The four panes, the clip for everything behind the glass. */
  panes: SkPath;
  /** What stands on the sill in front of the glass: cut out of that clip. */
  props: SkPath;
  sky: Sky;
  /** The mug's mouth, and its width (points). */
  mug: { x: number; y: number; size: number };
  flame: { x: number; y: number };
  glow: string;
  /** The screen's width, and the safe top the fairy lights hang under. */
  width: number;
  top: number;
  colors: readonly string[];
}

/** On the glass only: inside the panes, and never over what stands on the sill in front of it. */
function Glass({ panes, props, children }: { panes: SkPath; props: SkPath; children: ReactNode }) {
  return (
    <Group clip={panes}>
      <Group clip={props} invertClip>
        {children}
      </Group>
    </Group>
  );
}

/** Reduced motion: the clouds, the steam, the candle and the lights, all still; no rain. */
function StillNook({ panes, props, sky, mug, flame, glow, width, top, colors }: NookProps) {
  const halo = useSharedValue<number>(CANDLE.rest);
  const lit = useSharedValue<number>(FAIRY.rest);
  const clouds = useSharedValue(0);
  const steam = useSharedValue(STEAM.still / MS_TO_S);
  return (
    <>
      <Glass panes={panes} props={props}>
        <Clouds sky={sky} clock={clouds} />
      </Glass>
      <Steam mug={mug} clock={steam} />
      <Flame at={flame} glow={glow} opacity={halo} />
      <FairyLights width={width} top={top} colors={colors} clock={lit} />
    </>
  );
}

function LiveNook({ panes, props, sky, mug, flame, glow, width, top, colors }: NookProps) {
  const clock = useClock();
  const halo = useDerivedValue(() => {
    return CANDLE.rest + CANDLE.flicker * flicker(clock.value * PER_SECOND);
  });
  const { glass } = sky;
  return (
    <>
      <Glass panes={panes} props={props}>
        <Clouds sky={sky} clock={clock} />
        <Group transform={[{ translateX: glass.left }, { translateY: glass.top }]}>
          {SHOWER.map((d, i) => (
            <Drop key={i} spec={d} clock={clock} width={glass.width} height={glass.height} />
          ))}
        </Group>
      </Glass>
      <Steam mug={mug} clock={clock} />
      <Flame at={flame} glow={glow} opacity={halo} />
      <FairyLights width={width} top={top} colors={colors} clock={clock} />
    </>
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

/** Steam curling up off the tea (STEAM): a few thin wisps, waves travelling up them. `clock` in ms. */
function Steam({ mug, clock }: { mug: { x: number; y: number; size: number }; clock: SharedValue<number> }) {
  return (
    <Group>
      {STEAM.wisps.map((spec, i) => (
        <Wisp key={i} spec={spec} mug={mug} clock={clock} />
      ))}
    </Group>
  );
}

function Wisp({ spec, mug, clock }: { spec: (typeof STEAM.wisps)[number]; mug: { x: number; y: number; size: number }; clock: SharedValue<number> }) {
  const { size } = mug;
  const x0 = mug.x + spec.dx * size;
  const y0 = mug.y - STEAM.lift * size;
  const rise = spec.rise * size;
  const amp = STEAM.amp * size;
  const path = useDerivedValue(() => {
    const t = clock.value * PER_SECOND;
    let d = "";
    for (let i = 0; i <= STEAM.segments; i += 1) {
      const k = i / STEAM.segments;
      // It sways more as it rises, and leans a little.
      const x = x0 + spec.lean * size * k + amp * (STEAM.swayFrom + (1 - STEAM.swayFrom) * k) * Math.sin(k * STEAM.waves * TURN - t * STEAM.speed + spec.phase);
      d += `${i === 0 ? "M" : " L"} ${x} ${y0 - k * rise}`;
    }
    return d;
  });
  const opacity = useDerivedValue(() => {
    const s = (1 + Math.sin(clock.value * PER_SECOND * STEAM.breath + spec.phase)) / 2;
    return STEAM.low + (STEAM.high - STEAM.low) * s;
  });
  return (
    <Group opacity={opacity}>
      <Path path={path} style="stroke" strokeWidth={STEAM.width} strokeCap="round" strokeJoin="round">
        <LinearGradient start={vec(0, y0)} end={vec(0, y0 - rise)} colors={[STEAM.clear, STEAM.color, STEAM.color, STEAM.clear]} positions={[...STEAM.fade]} />
        <BlurMask blur={STEAM.blur} style="normal" />
      </Path>
    </Group>
  );
}

/** The candle's flame: a warm halo over the painted flame, and a brighter core. */
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
 * with a soft glow, twinkling on `clock` (in ms; a value of 1 or less holds them still at it).
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
    b.moveTo(0, y0);
    for (let i = 0; i < FAIRY.swags; i += 1) {
      const x0 = i * span;
      // A quad's control point sits at twice the sag it reaches.
      b.quadTo(x0 + span / 2, y0 + FAIRY.sag * 2, x0 + span, y0);
    }
    const count = Math.floor(width / FAIRY.pitch);
    const offset = (width - (count - 1) * FAIRY.pitch) / 2;
    const list = Array.from({ length: count }, (_, i) => {
      const x = offset + i * FAIRY.pitch;
      return { x, y: at(x) + FAIRY.bulb, color: colors[i % colors.length], phase: (i * BULB_PHASE) % TURN };
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
});
