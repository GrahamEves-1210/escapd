// The sheet's illustration panel (05 · Layout "Panel" and "Case-file art"):
// 03's cool grey panel (ref.color.panel, ref.layout.pro.panelHeight, square
// bottom corners; the sheet clips its top corners) holding ESCAPD's case file
// drawn as 03's phone (src/capture/ui/permission/IllustrationPanel.tsx): the
// same heavy black frame, elliptical outer corners and tight inner ones,
// turned in the same perspective (top falling to the right, sides upright)
// and cropped by the panel's foot, with a folder's tab in its top edge and a
// label in place of the island. Its lights are 03's: the lit inner wall down
// the left, the outer wall's sheen down the right, a gloss line along the top
// band and the label's. Every value is ref.layout.pro.art's. Decorative:
// hidden from screen readers, no touches, never animated.
import { useId } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { ref } from "@/theme/tokens";

const L = ref.layout.pro;
const A = L.art;
const SHADE = ref.color.illustrationBevel;

// The frame in its own upright space: x right from its left edge, y down from
// the tab's top edge, drawn A.length long (past the panel's foot).
const W = A.width;
const LEN = A.length;
const O = A.outer;
const B = A.band;
const N = A.inner;
const T = A.tab;
const RIGHT = W - B.right;
const BODY = T.rise;

// The shoulder, from the tab's top edge down to the body's: its direction,
// and how far a parallel edge `d` inside it sits left of it (where it meets
// edges `d` below the tab's and the body's).
const SHOULDER = Math.hypot(T.shoulder, T.rise);
const ALONG = { x: (T.shoulder / SHOULDER) * T.bend, y: (T.rise / SHOULDER) * T.bend };
const inset = (d: number) => (d * (SHOULDER - T.shoulder)) / T.rise;

/** From the current point: the tab's top edge at depth d, its shoulder (both bends rounded), then the body's edge to x `to`. */
function tabEdge(d: number, to: number) {
  const top = { x: T.width - inset(d), y: d };
  const foot = { x: T.width + T.shoulder - inset(d), y: BODY + d };
  return [
    `L${top.x - T.bend} ${top.y}`,
    `Q${top.x} ${top.y} ${top.x + ALONG.x} ${top.y + ALONG.y}`,
    `L${foot.x - ALONG.x} ${foot.y - ALONG.y}`,
    `Q${foot.x} ${foot.y} ${foot.x + T.bend} ${foot.y}`,
    `L${to} ${foot.y}`,
  ].join("");
}

/** The outer edge: up the left side, round the corner, along the tab and the body, round the right corner, down. */
const OUTER = [
  `M0 ${LEN}`,
  `L0 ${O.left.ry}`,
  `A${O.left.rx} ${O.left.ry} 0 0 1 ${O.left.rx} 0`,
  tabEdge(0, W - O.right.rx),
  `A${O.right.rx} ${O.right.ry} 0 0 1 ${W} ${BODY + O.right.ry}`,
  `L${W} ${LEN}Z`,
].join("");

/** The open inside of the folder, in the panel's grey. */
const SCREEN = [
  `M${B.left} ${LEN}`,
  `L${B.left} ${B.top + N.left.ry}`,
  `A${N.left.rx} ${N.left.ry} 0 0 1 ${B.left + N.left.rx} ${B.top}`,
  tabEdge(B.top, RIGHT - N.right.rx),
  `A${N.right.rx} ${N.right.ry} 0 0 1 ${RIGHT} ${BODY + B.top + N.right.ry}`,
  `L${RIGHT} ${LEN}Z`,
].join("");

// The lit inner wall: a stroke centred half its width outside the inside's
// left side and top-left corner, so it fills the band's inner 9.
const BEVEL_C = A.bevel.width / 2;
const BEVEL = [
  `M${B.left - BEVEL_C} ${LEN}`,
  `L${B.left - BEVEL_C} ${B.top + N.left.ry}`,
  `A${N.left.rx + BEVEL_C} ${N.left.ry + BEVEL_C} 0 0 1 ${B.left + N.left.rx} ${B.top - BEVEL_C}`,
].join("");

// The outer wall on the right: a stroke centred sheen.inset inside the outer
// edge, from the top of the right corner (on the body's edge) down past the foot.
const S = A.sheen;
const SHEEN = [
  `M${W - O.right.rx} ${BODY + S.inset}`,
  `A${O.right.rx - S.inset} ${O.right.ry - S.inset} 0 0 1 ${W - S.inset} ${BODY + O.right.ry}`,
  `L${W - S.inset} ${LEN}`,
].join("");

// The gloss line, gloss.y inside the top band, following the tab and the body.
const GL = A.gloss;
const GLOSS = `M${GL.from} ${GL.y}${tabEdge(GL.y, GL.to)}`;

// The label: a black stadium below the body band's inner edge.
const LB = A.label;
const LABEL_R = LB.height / 2;
const LABEL_Y = BODY + B.top + LB.drop;
const LABEL_CX = LB.left + LB.width / 2;
const LABEL_CY = LABEL_Y + LABEL_R;

/** The panel: full-bleed, ref.layout.pro.panelHeight tall, clipped by the sheet's top corners. */
export function CaseFilePanel() {
  const { width } = useWindowDimensions();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.panel}
      testID="pro-panel"
    >
      <CaseFileDrawing width={width} />
    </View>
  );
}

function CaseFileDrawing({ width }: { width: number }) {
  const id = `file${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  // The frame's origin in the panel, and the shear about it: x' = x, y' = y + slope * x.
  const frame = `matrix(1 ${A.slope} 0 1 ${width / 2 + A.dx} ${A.top})`;

  return (
    <Svg width={width} height={L.panelHeight} style={StyleSheet.absoluteFill} testID="pro-art">
      <Defs>
        {/* Every light is illustrationBevel at a stop opacity (react-native-svg ignores a stop colour's alpha). */}
        <LinearGradient id={`${id}bevel`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={LEN}>
          <Stop offset={(A.bevel.from - A.bevel.ramp) / LEN} stopColor={SHADE} stopOpacity={A.bevel.corner} />
          <Stop offset={A.bevel.from / LEN} stopColor={SHADE} stopOpacity={1} />
        </LinearGradient>
        <LinearGradient id={`${id}sheen`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={LEN}>
          <Stop offset={(BODY + S.inset) / LEN} stopColor={SHADE} stopOpacity={0} />
          <Stop offset={(BODY + S.inset + S.ramp) / LEN} stopColor={SHADE} stopOpacity={S.upper} />
          <Stop offset={(BODY + S.to) / LEN} stopColor={SHADE} stopOpacity={S.upper} />
          <Stop offset={(BODY + S.to) / LEN} stopColor={SHADE} stopOpacity={S.lower} />
        </LinearGradient>
        <LinearGradient id={`${id}gloss`} gradientUnits="userSpaceOnUse" x1={GL.from} y1={0} x2={GL.to} y2={0}>
          <Stop offset={0} stopColor={SHADE} stopOpacity={0} />
          <Stop offset={(GL.peak - GL.from) / (GL.to - GL.from)} stopColor={SHADE} stopOpacity={GL.opacity} />
          <Stop offset={1} stopColor={SHADE} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient
          id={`${id}labelGloss`}
          gradientUnits="userSpaceOnUse"
          x1={LABEL_CX + LB.gloss.from}
          y1={0}
          x2={LABEL_CX + LB.gloss.to}
          y2={0}
        >
          <Stop offset={0} stopColor={SHADE} stopOpacity={LB.gloss.start} />
          <Stop offset={1} stopColor={SHADE} stopOpacity={LB.gloss.end} />
        </LinearGradient>
      </Defs>

      <G transform={frame}>
        {/* The solid frame, its lights, then the open inside in the panel's grey, then the label. */}
        <Path d={OUTER} fill={ref.color.inkDisplay} />
        <Path d={BEVEL} fill="none" stroke={`url(#${id}bevel)`} strokeWidth={A.bevel.width} />
        <Path d={SHEEN} fill="none" stroke={`url(#${id}sheen)`} strokeWidth={S.width} />
        <Path d={GLOSS} fill="none" stroke={`url(#${id}gloss)`} strokeWidth={GL.width} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={SCREEN} fill={ref.color.panel} />
        <Rect x={LB.left} y={LABEL_Y} width={LB.width} height={LB.height} rx={LABEL_R} ry={LABEL_R} fill={ref.color.inkDisplay} testID="pro-art-label" />
        <Path
          d={`M${LABEL_CX + LB.gloss.from} ${LABEL_CY + LB.gloss.v}L${LABEL_CX + LB.gloss.to} ${LABEL_CY + LB.gloss.v}`}
          fill="none"
          stroke={`url(#${id}labelGloss)`}
          strokeWidth={LB.gloss.width}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  panel: { height: L.panelHeight, overflow: "hidden", backgroundColor: ref.color.panel },
});
