// Static glows drawn with react-native-svg: LightPool for a radial pool of
// light and FloorGlow for light rising from the bottom edge (01's floor glow,
// ref.gradient.bottomGlow). Never
// animated, no touches, hidden from accessibility, under the content.
import { useId } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { ref, type GradientStop } from "@/theme/tokens";
import { gradientStops } from "./gradient";

// On a View around the Svg: on the web, Svg hands these props to the DOM, which rejects them.
const hiddenLayer = {
  pointerEvents: "none",
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

const svgId = (raw: string) => raw.replace(/[^A-Za-z0-9]/g, "");

/** A radial glow token: centre and radius in pt, stops fading out to opacity 0 at the edge. */
export interface RadialGlow {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly stops: readonly GradientStop[];
}

export interface LightPoolSpec {
  /** The glow: centre, radius and stops. */
  glow: RadialGlow;
  /** Centre in the layer's own coordinates (its parent's box). Default: the token's. */
  cx?: number;
  cy?: number;
  /** Default: the token's radius. */
  r?: number;
  /** Draw only below this y: the pool stops at a straight edge here. */
  clipTop?: number;
  /** Draw only above this y. */
  clipBottom?: number;
}

export interface LightPoolsProps {
  /** Pools that overlap add up their alphas. */
  pools: readonly LightPoolSpec[];
  style?: StyleProp<ViewStyle>;
}

/**
 * Radial pools in one layer that fills its parent. Each pool is a Rect over
 * its bounding square, filled with a userSpaceOnUse RadialGradient; the last
 * stop is transparent, so the square's corners show nothing.
 */
export function LightPools({ pools, style }: LightPoolsProps) {
  const base = `pool${svgId(useId())}`;
  const resolved = pools.map((p) => ({ ...p, cx: p.cx ?? p.glow.cx, cy: p.cy ?? p.glow.cy, r: p.r ?? p.glow.r }));
  return (
    <View style={[StyleSheet.absoluteFill, style]} {...hiddenLayer}>
      <Svg width="100%" height="100%">
        <Defs>
          {resolved.map((pool, i) => (
            <RadialGradient key={i} id={`${base}g${i}`} gradientUnits="userSpaceOnUse" cx={pool.cx} cy={pool.cy} fx={pool.cx} fy={pool.cy} r={pool.r}>
              {gradientStops(pool.glow.stops)}
            </RadialGradient>
          ))}
        </Defs>
        {resolved.map((pool, i) => {
          // The pool's bounding square, cut to the clip band.
          const top = Math.max(pool.cy - pool.r, pool.clipTop ?? pool.cy - pool.r);
          const bottom = Math.min(pool.cy + pool.r, pool.clipBottom ?? pool.cy + pool.r);
          if (bottom <= top) return null;
          return <Rect key={i} x={pool.cx - pool.r} y={top} width={pool.r * 2} height={bottom - top} fill={`url(#${base}g${i})`} />;
        })}
      </Svg>
    </View>
  );
}

export type LightPoolProps = LightPoolSpec & { style?: StyleProp<ViewStyle> };

/** One static radial pool. */
export function LightPool({ style, ...pool }: LightPoolProps) {
  return <LightPools pools={[pool]} style={style} />;
}

/** A floor glow token: colours across the width, faded in from fadeStart to fadeEnd of the height over `ground`. */
export interface FloorGlowToken {
  readonly ground: `#${string}`;
  readonly fadeStart: number;
  readonly fadeEnd: number;
  readonly stops: readonly GradientStop[];
}

export interface FloorGlowProps {
  /** Default ref.gradient.bottomGlow (01). */
  glow?: FloorGlowToken;
  style?: StyleProp<ViewStyle>;
}

/**
 * Light rising from the bottom edge, in one layer that fills its parent (the
 * screen): nothing above fadeStart, the token's colours left to right below
 * it, full strength from fadeEnd down. The fade is an overlay of the token's
 * ground fading out, so the layer sits directly on that ground (01: void).
 */
export function FloorGlow({ glow = ref.gradient.bottomGlow, style }: FloorGlowProps) {
  const base = `floor${svgId(useId())}`;
  // Both layers span the whole screen, so there is no rect edge at fadeStart to
  // anti-alias into a seam: the ground overlay is opaque down to fadeStart and
  // clears by fadeEnd.
  return (
    <View style={[StyleSheet.absoluteFill, style]} {...hiddenLayer}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`${base}x`} x1={0} y1={0} x2={1} y2={0}>
            {gradientStops(glow.stops)}
          </LinearGradient>
          <LinearGradient id={`${base}y`} x1={0} y1={0} x2={0} y2={1}>
            <Stop offset={glow.fadeStart} stopColor={glow.ground} stopOpacity={1} />
            <Stop offset={glow.fadeEnd} stopColor={glow.ground} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${base}x)`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${base}y)`} />
      </Svg>
    </View>
  );
}
