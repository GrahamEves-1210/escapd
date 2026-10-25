import { useId } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { ref } from "@/theme/tokens";

export interface LightPoolSpec {
  /** Which pool: "hero" (r 220, behind 01's fan) or "object" (r 120, under a lit object). */
  kind: keyof typeof ref.light;
  /** Centre in the pool layer's own coordinates (the parent's box, since the layer fills it). */
  cx: number;
  cy: number;
  /** Defaults to the token's radius. Only for a spec that scales it (04 large text). */
  radius?: number;
  /** Draw only below this y: the pool stops at a straight edge here. */
  clipTop?: number;
  /** Draw only above this y. */
  clipBottom?: number;
}

export interface LightPoolsProps {
  /** Pools never overlap (their alphas would add up). 01 is the only screen with two. */
  pools: readonly LightPoolSpec[];
  style?: StyleProp<ViewStyle>;
}

/**
 * Static pools of soft white light (ref.light) in one react-native-svg layer
 * that fills its parent, under the content, with no touches and no
 * accessibility. Each pool is a Rect filled with a userSpaceOnUse
 * RadialGradient. Never animated, never behind reading text, never over a
 * photo or the viewfinder.
 */
export function LightPools({ pools, style }: LightPoolsProps) {
  const base = `pool${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <Svg
      width="100%"
      height="100%"
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        {pools.map((pool, i) => {
          const r = pool.radius ?? ref.light[pool.kind].radius;
          return (
            <RadialGradient key={i} id={`${base}g${i}`} gradientUnits="userSpaceOnUse" cx={pool.cx} cy={pool.cy} fx={pool.cx} fy={pool.cy} r={r}>
              {ref.light[pool.kind].stops.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </RadialGradient>
          );
        })}
      </Defs>
      {pools.map((pool, i) => {
        const r = pool.radius ?? ref.light[pool.kind].radius;
        // The pool's bounding box, cut to the clip band. Outside the radius the
        // gradient's last stop is transparent, so the box shows nothing extra.
        const top = Math.max(pool.cy - r, pool.clipTop ?? pool.cy - r);
        const bottom = Math.min(pool.cy + r, pool.clipBottom ?? pool.cy + r);
        if (bottom <= top) return null;
        return <Rect key={i} x={pool.cx - r} y={top} width={r * 2} height={bottom - top} fill={`url(#${base}g${i})`} />;
      })}
    </Svg>
  );
}

export type LightPoolProps = LightPoolSpec & { style?: StyleProp<ViewStyle> };

/** One static light pool. See LightPools. */
export function LightPool({ style, ...pool }: LightPoolProps) {
  return <LightPools pools={[pool]} style={style} />;
}
