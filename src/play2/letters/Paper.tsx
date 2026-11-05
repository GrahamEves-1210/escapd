// A sheet of paper, drawn once with Skia behind whatever is written on it
// (src/play2/letters): its outline cut clean, deckled or torn (paper.ts,
// edgePath), lying on the desk with a contact shadow and a softer one, a
// fine grain (fractal noise, overlaid so the paper keeps its colour), a slow
// mottle of age (a low-frequency noise turned into a faint stain), and as
// the sheet asks: the chain lines of laid paper, the creases of a letter
// folded in three, foxing freckles, a translucent fringe on a deckled edge.
// All procedural and static: nothing here animates, so it draws once.
//
// The canvas reaches `BLEED` past the sheet on every side so its shadow and
// any edge never clip. The children lie over the sheet, padded as asked.
import { useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { BlurMask, Canvas, Circle, ColorMatrix, FractalNoise, Group, Line, LinearGradient, Path, Rect, Shadow, Skia, vec } from "@shopify/react-native-skia";
import { alpha } from "@/theme/payoff";
import { edgePath, foxing as foxSpots, type Edge, type Edges } from "./paper";

/** How far the canvas reaches past the sheet (its shadow). */
export const BLEED = 28;

/** Noise to white with grey flecks where it dips (`k` how deep), opaque: multiplied in, a fine tooth that barely darkens the paper. */
const grey = (k: number) => [k, 0, 0, 0, 1 - 0.5 * k, k, 0, 0, 0, 1 - 0.5 * k, k, 0, 0, 0, 1 - 0.5 * k, 0, 0, 0, 0, 1];
const seedNum = (s: string) => {
  let n = 7;
  for (const ch of s) n = (n * 31 + ch.charCodeAt(0)) % 9973;
  return n;
};

export interface PaperProps {
  color: string;
  seed: string;
  edges?: Edge | Partial<Edges>;
  /** The fine grain's strength (0 to 1). */
  grain?: number;
  /** Age: a slow stain over the sheet in `ageColor` (0 to 1). */
  age?: number;
  ageColor?: string;
  /** Foxing freckles. */
  foxing?: number;
  foxColor?: string;
  /** Creases where it was folded, as shares of its height. */
  folds?: readonly number[];
  /** A glass set down on it once: a faint ring stain, its centre and radius as shares of the width. */
  ring?: { x: number; y: number; r: number } | null;
  /** Laid paper's chain lines. */
  laid?: boolean;
  /** The shadow under it. */
  shade: string;
  /** How far it is lifted off the desk (the shadow's reach). */
  lift?: number;
  padding?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  testID?: string;
}

export function Paper({ color, seed, edges = "clean", grain = 0.5, age = 0, ageColor = "#8A5A2B", foxing = 0, foxColor = "#8A5A2B", folds = [], ring = null, laid = false, shade, lift = 1, padding, style, children, testID }: PaperProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 0.5 || Math.abs(size.h - height) > 0.5) setSize({ w: width, h: height });
  };
  return (
    <View style={style} onLayout={onLayout} testID={testID}>
      {size ? <Sheet {...{ color, seed, edges, grain, age, ageColor, foxing, foxColor, folds, ring, laid, shade, lift }} w={size.w} h={size.h} /> : null}
      <View style={padding}>{children}</View>
    </View>
  );
}

function Sheet({ w, h, color, seed, edges, grain, age, ageColor, foxing, foxColor, folds, ring, laid, shade, lift }: Required<Omit<PaperProps, "padding" | "style" | "children" | "testID">> & { w: number; h: number }) {
  const d = edgePath(w, h, edges, seed);
  const deckled = typeof edges === "string" ? edges !== "clean" : Object.values(edges).some((e) => e !== "clean");
  const n = seedNum(seed);
  const spots = foxing > 0 ? foxSpots(w, h, foxing, seed) : [];
  const clip = Skia.Path?.MakeFromSVGString?.(d) ?? null;
  const blots = age > 0 ? foxSpots(w, h, 5, `${seed}:age`).map((b) => ({ ...b, r: 30 + b.r * 14, a: 0.05 + b.a * 0.4 })) : [];
  const chains = laid ? Array.from({ length: Math.floor(w / 26) }, (_, i) => 13 + i * 26) : [];
  return (
    <Canvas style={{ position: "absolute", left: -BLEED, top: -BLEED, width: w + BLEED * 2, height: h + BLEED * 2 }} pointerEvents="none">
      <Group transform={[{ translateX: BLEED }, { translateY: BLEED }]}>
        {/* On the desk: a tight contact shadow and a wider soft one. */}
        <Path path={d} color={color}>
          <Shadow dx={0} dy={2 * lift} blur={2.5 * lift} color={shade} />
          <Shadow dx={0} dy={10 * lift} blur={16 * lift} color={alpha("#000000", 0.28)} />
        </Path>
        <Group clip={clip ?? undefined}>
          {/* Age: the edges browned where air and hands got at them, and a few faint tide marks. */}
          {age > 0 ? (
            <>
              <Path path={d} style="stroke" strokeWidth={18} color={alpha(ageColor, 0.22 * age)}>
                <BlurMask blur={12} style="normal" />
              </Path>
              {blots.map((b, i) => (
                <Circle key={i} cx={b.x} cy={b.y} r={b.r} color={alpha(ageColor, b.a * age)}>
                  <BlurMask blur={b.r * 0.6} style="normal" />
                </Circle>
              ))}
            </>
          ) : null}
          {/* A glass's ring: darker at its rim where the drop dried, broken where it lifted unevenly. */}
          {ring ? (
            <Group>
              <Circle cx={ring.x * w} cy={ring.y * h} r={ring.r * w} style="stroke" strokeWidth={3} color={alpha(ageColor, 0.14)}>
                <BlurMask blur={1.6} style="normal" />
              </Circle>
              <Circle cx={ring.x * w} cy={ring.y * h} r={ring.r * w - 2} style="stroke" strokeWidth={6} color={alpha(ageColor, 0.05)}>
                <BlurMask blur={3} style="normal" />
              </Circle>
            </Group>
          ) : null}
          {/* The grain. */}
          <Rect x={0} y={0} width={w} height={h} opacity={grain} blendMode="multiply">
            <FractalNoise freqX={1.4} freqY={1.1} octaves={2} seed={n + 1} tileWidth={0} tileHeight={0} />
            <ColorMatrix matrix={grey(0.55)} />
          </Rect>
        </Group>
        {/* Laid paper: the faint chain lines the mould's wires left. */}
        {chains.map((x) => (
          <Line key={x} p1={vec(x, 4)} p2={vec(x, h - 4)} color={alpha("#5A4630", 0.06)} strokeWidth={1.2} />
        ))}
        {/* Foxing. */}
        {spots.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} color={alpha(foxColor, s.a)}>
            <BlurMask blur={s.r * 0.7} style="normal" />
          </Circle>
        ))}
        {/* The folds: each crease a shadowed valley with a lit lip, and the panel under it a touch darker. */}
        {folds.map((t) => (
          <Group key={t}>
            <Path path={`M0 ${t * h} H${w} V${t * h + 18} H0 Z`}>
              <LinearGradient start={vec(0, t * h)} end={vec(0, t * h + 18)} colors={[alpha("#3A2A30", 0.07), alpha("#3A2A30", 0)]} />
            </Path>
            <Line p1={vec(1, t * h)} p2={vec(w - 1, t * h + 0.6)} color={alpha("#3A2A30", 0.13)} strokeWidth={0.9} />
            <Line p1={vec(1, t * h - 1)} p2={vec(w - 1, t * h - 0.4)} color={alpha("#FFFFFF", 0.55)} strokeWidth={0.9} />
          </Group>
        ))}
        {/* A deckle's thin fringe, lighter where the fibres thin out; a clean cut's faint edge. */}
        <Path path={d} style="stroke" strokeWidth={deckled ? 1.6 : 0.8} color={deckled ? alpha("#FFFFFF", 0.35) : alpha("#2A1C24", 0.12)} />
      </Group>
    </Canvas>
  );
}
