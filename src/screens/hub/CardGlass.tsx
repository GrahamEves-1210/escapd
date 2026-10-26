// A game card's material (docs/DESIGN.md, 01 · Layout: Card material): Opal's
// dark glass as it looks over the floor glow, built opaque so the centre card
// hides the side cards' rims beneath it. Fill ref.gradient.card (180°, near-black
// to olive); a 1 pt rim ref.gradient.cardRim (Opal's: white 5 % at the top,
// fading out by 0.85, so the foot has none). No shadow. Corners continuous,
// clipped by the views (so they are the platform's own continuous corner);
// the rim is the 1 pt between the outer clip and an inner one.
// In the fan it stays see-through in look: the centre card is white 2 %
// brighter where it lies over a side card, and a side card darkens toward its
// outer edge (black 0 to 18 %) as the floor light falls off.
// While pressed, white glassFill eases in over the whole card (proposal).
import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { gradientLine, gradientStops } from "@/components/noir";
import { ref, type GradientStop } from "@/theme/tokens";
import type { CoveredSide } from "./GameCard";

const H = ref.layout.hub;
const C = H.card;
const F = H.fan;

/** A gradient over a 1 x 1 box stretched to the layer: no measuring, any card size. */
function GradientLayer({ id, gradient }: { id: string; gradient: { angle: number; stops: readonly GradientStop[] } }) {
  return (
    <>
      <Defs>
        <LinearGradient id={id} {...gradientLine(gradient.angle)}>
          {gradientStops(gradient.stops)}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={1} height={1} fill={`url(#${id})`} />
    </>
  );
}

export interface CardGlassProps {
  radius: number;
  /** 0 to 1: the press overlay's strength (usePressProgress). */
  pressed?: SharedValue<number>;
  /** The fan's centre card: brighter where it lies over the side cards. */
  covers?: boolean;
  /** A fan side card: its inner edge (under the centre card). It darkens toward the other edge. */
  covered?: CoveredSide;
}

/** Fills its parent (the card). Decorative and untouchable. */
export function CardGlass({ radius, pressed, covers = false, covered }: CardGlassProps) {
  const id = `glass${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const pressStyle = useAnimatedStyle(() => ({ opacity: pressed ? pressed.get() : 0 }));
  return (
    <View pointerEvents="none" style={[glassStyles.fill, glassStyles.clip, { borderRadius: radius }]}>
      <Svg width="100%" height="100%" style={glassStyles.fill} viewBox="0 0 1 1" preserveAspectRatio="none">
        <GradientLayer id={`${id}f`} gradient={ref.gradient.card} />
        <GradientLayer id={`${id}r`} gradient={ref.gradient.cardRim} />
      </Svg>
      <View style={[glassStyles.inner, glassStyles.clip, { borderRadius: radius - H.hairline }]}>
        <Svg width="100%" height="100%" style={glassStyles.fill} viewBox="0 0 1 1" preserveAspectRatio="none">
          <GradientLayer id={`${id}i`} gradient={ref.gradient.card} />
        </Svg>
      </View>
      {covered ? (
        // The floor's left-right falloff: none at the inner edge, black `falloff` at the outer one.
        <Svg width="100%" height="100%" style={glassStyles.fill} viewBox="0 0 1 1" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`${id}d`} x1={covered === "right" ? 1 : 0} y1={0} x2={covered === "right" ? 0 : 1} y2={0}>
              <Stop offset={0} stopColor={ref.color.void} stopOpacity={0} />
              <Stop offset={1} stopColor={ref.color.void} stopOpacity={H.glass.falloff} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={1} height={1} fill={`url(#${id}d)`} />
        </Svg>
      ) : null}
      {covers ? (
        // The side cards' outlines, in the centre card's own space (their centres 105 out and
        // 10 lower, tilted -/+6 degrees), tinted white `overlap`; the card's clip keeps the overlap.
        <Svg width={C.width} height={C.height} style={glassStyles.fill}>
          {[-1, 1].map((side) => {
            const cx = C.width / 2 + side * F.sideOffset;
            const cy = C.height / 2 + F.sideDrop;
            return (
              <Rect
                key={side}
                x={cx - C.width / 2}
                y={cy - C.height / 2}
                width={C.width}
                height={C.height}
                rx={radius}
                fill={ref.color.textPrimary}
                fillOpacity={H.glass.overlap}
                transform={`rotate(${side * F.tilt} ${cx} ${cy})`}
              />
            );
          })}
        </Svg>
      ) : null}
      <Animated.View style={[glassStyles.fill, glassStyles.press, pressStyle]} />
    </View>
  );
}

const glassStyles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  clip: { overflow: "hidden", ...ref.curve },
  inner: { position: "absolute", top: H.hairline, left: H.hairline, right: H.hairline, bottom: H.hairline },
  press: { backgroundColor: ref.color.glassFill },
});
