// 03 · Camera permission: the illustration zone at the top of the sheet
// (docs/DESIGN.md 03, Layout: Illustration zone, Mount, Plate, Illustration).
// A small film plate, as the light table's tiles and /play's mount: a walnut
// (color.surface) mount with a 1 pt brass hairline at radius.thumbRing, and 4
// in (thumbRing - thumb, so the corners are concentric) a color.canvas plate at
// radius.thumb with a 1 pt color.rim edge drawn over its art. On the plate, a
// warm line drawing of a phone, rotated 14 deg clockwise, whose screen shows
// the rangefinder's two upper brackets in brass over the faint lines of a
// room corner; the plate's foot crops it. No light pool. Decorative: hidden
// from screen readers, no touches, never animated.
import { useId } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, G, Line, LinearGradient, Mask, Path, Rect, Stop } from "react-native-svg";
import { color, curve, radius, ref, space } from "@/theme/tokens";

const P = ref.layout.permission;
const A = P.phone;
const LINE = P.line;
const PLATE_HEIGHT = P.plate.height;

/** The plate sits this far in from the mount's outer edge: 18 - 14 = 4 (1 hairline + 3 walnut). */
const MOUNT_INSET = radius.thumbRing - radius.thumb;
/** The mount: the plate plus its inset above and below (136). */
export const MOUNT_HEIGHT = PLATE_HEIGHT + MOUNT_INSET * 2;
/** The zone: space.xl of walnut above the mount, then the mount (160). The title's own space.xl follows. */
export const ZONE_HEIGHT = space.xl + MOUNT_HEIGHT;

// Phone geometry in unrotated phone coordinates (origin at the body's
// top-left corner). The body runs well past the plate's foot, which crops it.
const BODY_LENGTH = PLATE_HEIGHT;
const SCREEN_WIDTH = A.width - A.screenInset * 2;
// Bracket corners: inset from the inner-screen edge, so (30, 30) and (104, 30).
const BRACKET_NEAR = A.screenInset + A.bracketInset;
const BRACKET_FAR = A.width - BRACKET_NEAR;
// The room corner's wall join: on the screen's centre line, 44 below its top edge.
const JOIN_X = A.width / 2;
const JOIN_Y = A.screenInset + A.wallDrop;

const LINE_ART = { strokeWidth: LINE.stroke, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
const CONTEXT = LINE.context;

/** The zone: walnut above, then the mount and its plate with the drawing. */
export function IllustrationZone() {
  const { width } = useWindowDimensions();
  // The column (the sheet's width less two gutters) less the mount's inset on each side: 345 on 393.
  const plateWidth = width - space.gutter * 2 - MOUNT_INSET * 2;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.zone}
      testID="permission-illustration"
    >
      <View style={styles.mount} testID="permission-mount">
        <View style={styles.plate} testID="permission-plate">
          <PhoneDrawing width={plateWidth} />
          <View style={styles.rim} />
        </View>
      </View>
    </View>
  );
}

function PhoneDrawing({ width }: { width: number }) {
  const id = `phone${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  // The body's top-left corner in the plate: (118.7, 20) on a 345 plate.
  const place = `translate(${width / 2 + A.cornerDx} ${A.cornerDy}) rotate(${A.rotate})`;
  // Context lines fade out over the last LINE.fade before the crop.
  const fadeTop = PLATE_HEIGHT - LINE.fade;

  return (
    <Svg width={width} height={PLATE_HEIGHT} style={StyleSheet.absoluteFill}>
      <Defs>
        {/* An alpha mask: stopOpacity carries the fade (react-native-svg ignores a stop colour's alpha). */}
        <LinearGradient id={`${id}crop`} gradientUnits="userSpaceOnUse" x1={0} y1={fadeTop} x2={0} y2={PLATE_HEIGHT}>
          <Stop offset={0} stopColor={CONTEXT.color} stopOpacity={1} />
          <Stop offset={1} stopColor={CONTEXT.color} stopOpacity={0} />
        </LinearGradient>
        <Mask id={`${id}fade`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={PLATE_HEIGHT} maskType="alpha">
          <Rect x={0} y={0} width={width} height={PLATE_HEIGHT} fill={`url(#${id}crop)`} />
        </Mask>
        {/* Each ceiling line fades from the context opacity to transparent along its 30 length, outward from the join. */}
        <LinearGradient id={`${id}ceilingL`} gradientUnits="userSpaceOnUse" x1={JOIN_X} y1={JOIN_Y} x2={JOIN_X - A.ceilingLength} y2={JOIN_Y}>
          <Stop offset={0} stopColor={CONTEXT.color} stopOpacity={CONTEXT.opacity} />
          <Stop offset={1} stopColor={CONTEXT.color} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`${id}ceilingR`} gradientUnits="userSpaceOnUse" x1={JOIN_X} y1={JOIN_Y} x2={JOIN_X + A.ceilingLength} y2={JOIN_Y}>
          <Stop offset={0} stopColor={CONTEXT.color} stopOpacity={CONTEXT.opacity} />
          <Stop offset={1} stopColor={CONTEXT.color} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* The body: a walnut silhouette on the soot plate with a mid outline. Its inner screen is plate canvas. */}
      <G transform={place}>
        <Rect
          x={0}
          y={0}
          width={A.width}
          height={BODY_LENGTH}
          rx={A.radius}
          ry={A.radius}
          fill={color.surface}
          stroke={LINE.mid.color}
          strokeOpacity={LINE.mid.opacity}
          strokeWidth={LINE.stroke}
        />
        <Rect
          x={A.screenInset}
          y={A.screenInset}
          width={SCREEN_WIDTH}
          height={BODY_LENGTH - A.screenInset}
          rx={A.radius}
          ry={A.radius}
          fill={color.canvas}
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
            rx={A.radius}
            ry={A.radius}
            fill="none"
            stroke={CONTEXT.color}
            strokeOpacity={CONTEXT.opacity}
            strokeWidth={P.hairline}
          />
          <Line x1={JOIN_X} y1={JOIN_Y} x2={JOIN_X} y2={BODY_LENGTH} stroke={CONTEXT.color} strokeOpacity={CONTEXT.opacity} {...LINE_ART} />
          {/* Ceiling lines leave the join's top, rising outward at 15 deg. The gradient carries their opacity. */}
          <G transform={`rotate(${A.ceilingAngle} ${JOIN_X} ${JOIN_Y})`}>
            <Line x1={JOIN_X} y1={JOIN_Y} x2={JOIN_X - A.ceilingLength} y2={JOIN_Y} stroke={`url(#${id}ceilingL)`} {...LINE_ART} />
          </G>
          <G transform={`rotate(${-A.ceilingAngle} ${JOIN_X} ${JOIN_Y})`}>
            <Line x1={JOIN_X} y1={JOIN_Y} x2={JOIN_X + A.ceilingLength} y2={JOIN_Y} stroke={`url(#${id}ceilingR)`} {...LINE_ART} />
          </G>
        </G>
      </G>

      {/* The rangefinder's two upper brackets, in brass. The lower pair falls below the crop. */}
      <G transform={place}>
        <Path
          d={`M${BRACKET_NEAR} ${BRACKET_NEAR + A.bracketArm}L${BRACKET_NEAR} ${BRACKET_NEAR}L${BRACKET_NEAR + A.bracketArm} ${BRACKET_NEAR}`}
          stroke={LINE.bracket}
          {...LINE_ART}
        />
        <Path
          d={`M${BRACKET_FAR - A.bracketArm} ${BRACKET_NEAR}L${BRACKET_FAR} ${BRACKET_NEAR}L${BRACKET_FAR} ${BRACKET_NEAR + A.bracketArm}`}
          stroke={LINE.bracket}
          {...LINE_ART}
        />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  // space.xl of the sheet's walnut above the mount (measured below the sheet's top hairline).
  zone: { paddingTop: space.xl, paddingHorizontal: space.gutter },
  // Walnut with a 1 pt brass hairline; 3 of walnut inside it, so the plate sits 4 in.
  mount: {
    padding: MOUNT_INSET - P.hairline,
    borderRadius: radius.thumbRing,
    ...curve,
    backgroundColor: color.surface,
    borderWidth: P.hairline,
    borderColor: color.hairline,
  },
  // Soot, clipped to its corners, so the plate's foot crops the drawing.
  plate: {
    height: PLATE_HEIGHT,
    borderRadius: radius.thumb,
    ...curve,
    overflow: "hidden",
    backgroundColor: color.canvas,
  },
  // The plate's 1 pt rim, over the drawing, as the light table's tiles.
  rim: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.thumb,
    ...curve,
    borderWidth: P.hairline,
    borderColor: color.rim,
  },
});
