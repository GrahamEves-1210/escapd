// Home's backdrop, her reading nook on a rainy night (docs/ART_DIRECTION.md,
// the mystery-book core): a four-pane window filling the phone, its painted
// plum-brown frame and sill on the screen's edges and a cross of mullions;
// behind the glass a midnight-indigo sky going mauve over a soft treeline, a
// full moon rising in the lower right pane, and on the sill a stack of books
// with a lit candle and a mug of tea (assets/backdrop/window.jpg,
// scripts/brand/window.py). Over the art, on one canvas:
// - rain keeps hitting the glass, softly: drops land, bead, then some run
//   down leaving a trail, and now and then a far-off flash lights the sky.
//   Both stay inside the four panes (clipped), so the frame stays solid;
// - the candle's flame breathes and flickers, a warm halo in the theme's glow;
// - fairy lights strung across the top, in the theme's glow, sweet and foil,
//   twinkling slowly.
// Under reduced motion it is all still: no drops landing, no flashes, the
// flame and the lights steady.
import { useEffect, useMemo } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { useDerivedValue, useSharedValue, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurMask, Canvas, Circle, Group, Path, RadialGradient, Rect, Skia, useClock, vec } from "@shopify/react-native-skia";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { BULB_GLOW, BULB_PHASE, CANDLE, FAIRY, LIGHTNING, MS_TO_S, RAIN, SHOWER, WINDOW_ART as ART, flicker, sag, type DropSpec } from "./art/nook";

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
  const flame = vec(art.left + art.width * ART.flame.x, art.top + art.height * ART.flame.y);

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none" testID="hub-window">
      <Image
        source={WINDOW}
        style={{ position: "absolute", left: art.left, top: art.top, width: art.width, height: art.height }}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
      />
      <Canvas style={StyleSheet.absoluteFill}>
        {reducedMotion ? (
          <StillNook flame={flame} glow={theme.glow} width={width} height={height} top={insets.top} colors={[theme.glow, theme.sweet, theme.foil]} />
        ) : (
          <LiveNook
            panes={panes}
            glass={{ left, top, width: w, height: h }}
            flame={flame}
            glow={theme.glow}
            width={width}
            height={height}
            top={insets.top}
            colors={[theme.glow, theme.sweet, theme.foil]}
          />
        )}
      </Canvas>
    </View>
  );
}

interface NookProps {
  flame: { x: number; y: number };
  glow: string;
  /** The screen's width, and the safe top the fairy lights hang under. */
  width: number;
  height: number;
  top: number;
  colors: readonly string[];
}

/** Reduced motion: the candle and the lights, steady; no rain or flashes. */
function StillNook({ flame, glow, width, top, colors }: NookProps) {
  const halo = useSharedValue<number>(CANDLE.rest);
  const lit = useSharedValue<number>(FAIRY.rest);
  return (
    <>
      <Flame at={flame} glow={glow} opacity={halo} />
      <FairyLights width={width} top={top} colors={colors} clock={lit} />
    </>
  );
}

function LiveNook({
  panes,
  glass,
  flame,
  glow,
  width,
  height,
  top,
  colors,
}: NookProps & { panes: ReturnType<ReturnType<typeof Skia.PathBuilder.Make>["build"]>; glass: { left: number; top: number; width: number; height: number } }) {
  const clock = useClock();
  const halo = useDerivedValue(() => {
    return CANDLE.rest + CANDLE.flicker * flicker(clock.value * PER_SECOND);
  });
  return (
    <>
      <Group clip={panes}>
        <Lightning width={width} height={height} />
        <Group transform={[{ translateX: glass.left }, { translateY: glass.top }]}>
          {SHOWER.map((d, i) => (
            <Drop key={i} spec={d} clock={clock} width={glass.width} height={glass.height} />
          ))}
        </Group>
      </Group>
      <Flame at={flame} glow={glow} opacity={halo} />
      <FairyLights width={width} top={top} colors={colors} clock={clock} />
    </>
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

/** Far-off lightning: every so often the sky flickers twice and fades (inside the panes). */
function Lightning({ width, height }: { width: number; height: number }) {
  const flash = useSharedValue(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const strike = () => {
      flash.set(withSequence(...LIGHTNING.steps.map((s) => withTiming(s.to, { duration: s.ms }))));
      timer = setTimeout(strike, LIGHTNING.every + Math.random() * LIGHTNING.spread);
    };
    timer = setTimeout(strike, LIGHTNING.first + Math.random() * LIGHTNING.firstSpread);
    return () => clearTimeout(timer);
  }, [flash]);
  return <Rect x={0} y={0} width={width} height={height} color={LIGHTNING.color} opacity={flash} />;
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
});
