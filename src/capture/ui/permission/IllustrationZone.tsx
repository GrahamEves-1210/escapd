// 03 · Camera permission: the illustration zone at the top of the sheet
// (docs/DESIGN.md 03, Layout: Illustration zone, Light pool, Illustration).
// A cropped window: one static ref.light.object pool falls on a grayscale line
// drawing of a phone, rotated 14 deg clockwise, whose screen shows the
// rangefinder's two upper brackets over the faint lines of a room corner. The
// zone clips the pool and the drawing above a 1 pt crop rule, so no light
// reaches the text below. Decorative: hidden from screen readers, no touches,
// never animated.
import { useId } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, G, Line, LinearGradient, Mask, Path, Rect, Stop } from "react-native-svg";
import { LightPool, Rule } from "@/components/noir";
import { ref } from "@/theme/tokens";

const P = ref.layout.permission;
const A = P.phone;
const ART = ref.illustration;
const EDGE = ref.border.hairline;
const RADIUS = ref.radius.panel;

/** The clipped window: the zone less the sheet's top hairline and the crop rule. */
const CLIP_HEIGHT = P.zone - EDGE * 2;

// Phone geometry in unrotated phone coordinates (origin at the body's
// top-left corner). The body runs well past the crop, which clips it.
const BODY_LENGTH = P.zone;
const SCREEN_WIDTH = A.width - A.screenInset * 2;
// Bracket corners: inset from the inner-screen edge, so (30, 30) and (104, 30).
const BRACKET_NEAR = A.screenInset + A.bracketInset;
const BRACKET_FAR = A.width - BRACKET_NEAR;
// The room corner's wall join: on the screen's centre line, 44 below its top edge.
const JOIN_X = A.width / 2;
const JOIN_Y = A.screenInset + A.wallDrop;

const LINE_ART = { strokeWidth: ART.stroke, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

/** The zone: its own panel fill, the clipped pool and drawing, then the crop rule. */
export function IllustrationZone() {
  const { width } = useWindowDimensions();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="permission-illustration"
    >
      <View style={styles.clip}>
        <LightPool kind="object" cx={width / 2 + P.poolDx} cy={P.poolDy - EDGE} />
        <PhoneDrawing width={width} />
      </View>
      <Rule />
    </View>
  );
}

function PhoneDrawing({ width }: { width: number }) {
  const id = `phone${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  // The body's top-left corner in the clip box: (142.7, 342) on 393 x 852.
  const place = `translate(${width / 2 + A.cornerDx} ${A.cornerDy - EDGE}) rotate(${A.rotate})`;
  // Context lines fade out over the last ref.illustration.contextFade before the crop.
  const fadeTop = CLIP_HEIGHT - ART.contextFade;

  return (
    <Svg width={width} height={CLIP_HEIGHT} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`${id}crop`} gradientUnits="userSpaceOnUse" x1={0} y1={fadeTop} x2={0} y2={CLIP_HEIGHT}>
          <Stop offset={0} stopColor={ART.context} stopOpacity={1} />
          <Stop offset={1} stopColor={ART.context} stopOpacity={0} />
        </LinearGradient>
        <Mask id={`${id}fade`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={CLIP_HEIGHT} maskType="alpha">
          <Rect x={0} y={0} width={width} height={CLIP_HEIGHT} fill={`url(#${id}crop)`} />
        </Mask>
        {/* Each ceiling line fades to transparent along its 30 length, outward from the join. */}
        <LinearGradient id={`${id}ceilingL`} gradientUnits="userSpaceOnUse" x1={JOIN_X} y1={JOIN_Y} x2={JOIN_X - A.ceilingLength} y2={JOIN_Y}>
          <Stop offset={0} stopColor={ART.context} stopOpacity={1} />
          <Stop offset={1} stopColor={ART.context} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`${id}ceilingR`} gradientUnits="userSpaceOnUse" x1={JOIN_X} y1={JOIN_Y} x2={JOIN_X + A.ceilingLength} y2={JOIN_Y}>
          <Stop offset={0} stopColor={ART.context} stopOpacity={1} />
          <Stop offset={1} stopColor={ART.context} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* The body: a dark panel silhouette in the pool with a mid outline. Its inner screen is ground. */}
      <G transform={place}>
        <Rect x={0} y={0} width={A.width} height={BODY_LENGTH} rx={RADIUS} ry={RADIUS} fill={ref.color.panel} stroke={ART.mid} strokeWidth={ART.stroke} />
        <Rect
          x={A.screenInset}
          y={A.screenInset}
          width={SCREEN_WIDTH}
          height={BODY_LENGTH - A.screenInset}
          rx={RADIUS}
          ry={RADIUS}
          fill={ref.color.ground}
        />
      </G>

      {/* Context: the inner screen's edge and the room corner, faded toward the crop. */}
      <G mask={`url(#${id}fade)`}>
        <G transform={place}>
          <Rect
            x={A.screenInset}
            y={A.screenInset}
            width={SCREEN_WIDTH}
            height={BODY_LENGTH - A.screenInset}
            rx={RADIUS}
            ry={RADIUS}
            fill="none"
            stroke={ART.context}
            strokeWidth={EDGE}
          />
          <Line x1={JOIN_X} y1={JOIN_Y} x2={JOIN_X} y2={BODY_LENGTH} stroke={ART.context} {...LINE_ART} />
          {/* Ceiling lines leave the join's top, rising outward at 15 deg. */}
          <G transform={`rotate(${A.ceilingAngle} ${JOIN_X} ${JOIN_Y})`}>
            <Line x1={JOIN_X} y1={JOIN_Y} x2={JOIN_X - A.ceilingLength} y2={JOIN_Y} stroke={`url(#${id}ceilingL)`} {...LINE_ART} />
          </G>
          <G transform={`rotate(${-A.ceilingAngle} ${JOIN_X} ${JOIN_Y})`}>
            <Line x1={JOIN_X} y1={JOIN_Y} x2={JOIN_X + A.ceilingLength} y2={JOIN_Y} stroke={`url(#${id}ceilingR)`} {...LINE_ART} />
          </G>
        </G>
      </G>

      {/* The rangefinder's two upper brackets, in hero white. The lower pair falls below the crop. */}
      <G transform={place}>
        <Path
          d={`M${BRACKET_NEAR} ${BRACKET_NEAR + A.bracketArm}L${BRACKET_NEAR} ${BRACKET_NEAR}L${BRACKET_NEAR + A.bracketArm} ${BRACKET_NEAR}`}
          stroke={ART.hero}
          {...LINE_ART}
        />
        <Path
          d={`M${BRACKET_FAR - A.bracketArm} ${BRACKET_NEAR}L${BRACKET_FAR} ${BRACKET_NEAR}L${BRACKET_FAR} ${BRACKET_NEAR + A.bracketArm}`}
          stroke={ART.hero}
          {...LINE_ART}
        />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Same panel fill as the sheet; overflow hidden clips the pool and drawing to the window.
  clip: { height: CLIP_HEIGHT, overflow: "hidden", backgroundColor: ref.color.panel },
});
