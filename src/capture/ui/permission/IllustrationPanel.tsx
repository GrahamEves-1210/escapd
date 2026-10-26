// 03 · Camera permission: the illustration panel across the top of the sheet
// (docs/DESIGN.md 03, Layout: Illustration panel, Illustration). pushr's look:
// a full-bleed ref.color.panel band, 150 tall, under the sheet's top corners,
// holding a heavy black phone outline turned in perspective (top edge falling
// to the right, sides upright), its island, and the few grey lights the
// reference's render shows: the lit inner wall down the left side, the outer
// wall down the right, a gloss line along the top band, and the island's gloss
// line and flat lit right face. The panel's foot crops the phone. ESCAPD's own
// vector drawing, fitted to the reference's outline; every value is
// ref.layout.permission's. Decorative:
// hidden from screen readers, no touches, never animated.
import { useId } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { ref } from "@/theme/tokens";

const P = ref.layout.permission;
const A = P.phone;
const I = P.island;
const SHADE = ref.color.illustrationBevel;
/** The shear: the top edge falls this much per point to the right. */
const SLOPE = Math.tan((ref.effect.illustrationTilt * Math.PI) / 180);

// The phone in its own upright space: x right from the frame's left edge, y
// down from its top edge, drawn A.length long (past the panel's foot).
const W = A.width;
const L = A.length;
const O = A.outer;
const B = A.band;
const N = A.inner;
const RIGHT = W - B.right;

/** The outer edge: up the left side, round the corners, down the right side. */
const OUTER = [
  `M0 ${L}`,
  `L0 ${O.left.ry}`,
  `A${O.left.rx} ${O.left.ry} 0 0 1 ${O.left.rx} 0`,
  `L${W - O.right.rx} 0`,
  `A${O.right.rx} ${O.right.ry} 0 0 1 ${W} ${O.right.ry}`,
  `L${W} ${L}Z`,
].join("");

/** The open screen inside the band. */
const SCREEN = [
  `M${B.left} ${L}`,
  `L${B.left} ${B.top + N.left.ry}`,
  `A${N.left.rx} ${N.left.ry} 0 0 1 ${B.left + N.left.rx} ${B.top}`,
  `L${RIGHT - N.right.rx} ${B.top}`,
  `A${N.right.rx} ${N.right.ry} 0 0 1 ${RIGHT} ${B.top + N.right.ry}`,
  `L${RIGHT} ${L}Z`,
].join("");

// The lit inner wall: a stroke centred half its width outside the screen's
// left side and top-left corner, so it fills the band's inner 9.
const BEVEL_C = A.bevel.width / 2;
const BEVEL = [
  `M${B.left - BEVEL_C} ${L}`,
  `L${B.left - BEVEL_C} ${B.top + N.left.ry}`,
  `A${N.left.rx + BEVEL_C} ${N.left.ry + BEVEL_C} 0 0 1 ${B.left + N.left.rx} ${B.top - BEVEL_C}`,
].join("");

// The outer wall on the right: a stroke centred sheen.inset inside the outer
// edge, from the top of the right corner down past the foot.
const S = A.sheen;
const SHEEN = [
  `M${W - O.right.rx} ${S.inset}`,
  `A${O.right.rx - S.inset} ${O.right.ry - S.inset} 0 0 1 ${W - S.inset} ${O.right.ry}`,
  `L${W - S.inset} ${L}`,
].join("");

// The island: a round left end, a square-cut right end with small corners.
const ISLAND_R = I.height / 2;
const ISLAND_L = -I.width / 2;
const ISLAND_E = I.width / 2;
const ISLAND = [
  `M${ISLAND_L + ISLAND_R} ${-ISLAND_R}`,
  `L${ISLAND_E - I.endRadius} ${-ISLAND_R}`,
  `A${I.endRadius} ${I.endRadius} 0 0 1 ${ISLAND_E} ${I.endRadius - ISLAND_R}`,
  `L${ISLAND_E} ${ISLAND_R - I.endRadius}`,
  `A${I.endRadius} ${I.endRadius} 0 0 1 ${ISLAND_E - I.endRadius} ${ISLAND_R}`,
  `L${ISLAND_L + ISLAND_R} ${ISLAND_R}`,
  `A${ISLAND_R} ${ISLAND_R} 0 0 1 ${ISLAND_L + ISLAND_R} ${-ISLAND_R}Z`,
].join("");
// Its flat lit right face, inside the body: the black around it is the seam.
const FACE = I.face;
const FACE_TOP = -FACE.height / 2;

/** The panel: full-bleed, ref.layout.permission.panel tall, clipped by the sheet's top corners. */
export function IllustrationPanel() {
  const { width } = useWindowDimensions();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.panel}
      testID="permission-illustration"
    >
      <PhoneDrawing width={width} />
    </View>
  );
}

function PhoneDrawing({ width }: { width: number }) {
  const id = `phone${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  // The frame's origin in the panel, and the shear about it.
  const x0 = width / 2 + A.dx;
  const frame = `matrix(1 ${SLOPE} 0 1 ${x0} ${A.top})`;
  // The island isn't sheared: it sits on the frame's top edge line, turned on its own.
  const islandX = x0 + I.x;
  const islandY = A.top + I.y + I.x * SLOPE;
  const island = `translate(${islandX} ${islandY}) rotate(${I.rotate})`;

  return (
    <Svg width={width} height={P.panel} style={StyleSheet.absoluteFill}>
      <Defs>
        {/* Every light is illustrationBevel at a stop opacity (react-native-svg ignores a stop colour's alpha). */}
        <LinearGradient id={`${id}bevel`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={L}>
          <Stop offset={(A.bevel.from - A.bevel.ramp) / L} stopColor={SHADE} stopOpacity={A.bevel.corner} />
          <Stop offset={A.bevel.from / L} stopColor={SHADE} stopOpacity={1} />
        </LinearGradient>
        <LinearGradient id={`${id}sheen`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={L}>
          <Stop offset={S.inset / L} stopColor={SHADE} stopOpacity={0} />
          <Stop offset={(S.inset + S.ramp) / L} stopColor={SHADE} stopOpacity={S.upper} />
          <Stop offset={S.to / L} stopColor={SHADE} stopOpacity={S.upper} />
          <Stop offset={S.to / L} stopColor={SHADE} stopOpacity={S.lower} />
        </LinearGradient>
        <LinearGradient id={`${id}gloss`} gradientUnits="userSpaceOnUse" x1={A.gloss.from} y1={0} x2={A.gloss.to} y2={0}>
          <Stop offset={0} stopColor={SHADE} stopOpacity={0} />
          <Stop offset={(A.gloss.peak - A.gloss.from) / (A.gloss.to - A.gloss.from)} stopColor={SHADE} stopOpacity={A.gloss.opacity} />
          <Stop offset={1} stopColor={SHADE} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`${id}islandGloss`} gradientUnits="userSpaceOnUse" x1={I.gloss.from} y1={0} x2={I.gloss.to} y2={0}>
          <Stop offset={0} stopColor={SHADE} stopOpacity={I.gloss.start} />
          <Stop offset={1} stopColor={SHADE} stopOpacity={I.gloss.end} />
        </LinearGradient>
        <LinearGradient id={`${id}islandFace`} gradientUnits="userSpaceOnUse" x1={0} y1={FACE_TOP} x2={0} y2={-FACE_TOP}>
          <Stop offset={FACE.split} stopColor={SHADE} stopOpacity={FACE.lit} />
          <Stop offset={FACE.shadeFrom} stopColor={SHADE} stopOpacity={FACE.shade} />
        </LinearGradient>
      </Defs>

      <G transform={frame}>
        {/* The solid frame, its lights, then the open screen in the panel's grey. */}
        <Path d={OUTER} fill={ref.color.inkDisplay} />
        <Path d={BEVEL} fill="none" stroke={`url(#${id}bevel)`} strokeWidth={A.bevel.width} />
        <Path d={SHEEN} fill="none" stroke={`url(#${id}sheen)`} strokeWidth={S.width} />
        <Path
          d={`M${A.gloss.from} ${A.gloss.y}L${A.gloss.to} ${A.gloss.y}`}
          fill="none"
          stroke={`url(#${id}gloss)`}
          strokeWidth={A.gloss.width}
          strokeLinecap="round"
        />
        <Path d={SCREEN} fill={ref.color.panel} />
      </G>

      <G transform={island}>
        <Path d={ISLAND} fill={ref.color.inkDisplay} />
        <Rect
          x={FACE.from}
          y={FACE_TOP}
          width={FACE.to - FACE.from}
          height={FACE.height}
          rx={FACE.radius}
          ry={FACE.radius}
          fill={`url(#${id}islandFace)`}
        />
        <Path
          d={`M${I.gloss.from} ${I.gloss.v}L${I.gloss.to} ${I.gloss.v}`}
          fill="none"
          stroke={`url(#${id}islandGloss)`}
          strokeWidth={I.gloss.width}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Full-bleed under the sheet's top corners (the sheet clips it), cropping the phone at its foot.
  panel: { height: ref.layout.permission.panel, backgroundColor: ref.color.panel, overflow: "hidden" },
});
