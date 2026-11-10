// The close-up's table: looking closer brings the thing to the desk. A
// surface of the mode's felt under the lamp (its light pooled in the middle,
// the corners falling away), a front edge of the mode's wood with the brass
// strip let into it, the thing's name typed on a card in a brass label
// holder, and one quiet way to put it back: a brass stud with a cross cut
// into it, the same in every close-up. The crime scene's table carries an
// evidence scale along its edge. All static art, drawn once.
import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import type { Genre } from "@/lib/puzzle-types";
import { LETTER_FONT } from "@/theme/payoff";
import { InkMark } from "./Ink";
import { Brass, EdgeShadow, Felt, hidden, INK, Plank, useHudMaterials } from "./materials";
import { Press } from "./Press";

/** The table's front edge (points): wood, the brass strip along its top. */
export const TABLE_EDGE = 12;

/** The surface and its front edge, behind whatever lies on the table (it fills its parent). */
export const TableTop = memo(function TableTop() {
  const m = useHudMaterials();
  return (
    <View style={StyleSheet.absoluteFill} {...hidden}>
      <EdgeShadow height={26} from="bottom" color={m.shadow} opacity={0.85} style={styles.cast} />
      <Felt />
      <View style={styles.edge}>
        <Plank height={TABLE_EDGE} lit="top" brass={3} seed={43} />
      </View>
      <EdgeShadow height={10} from="top" color={m.shadow} opacity={0.6} style={styles.under} />
      {m.genre === "crime_scene" ? <Scale /> : null}
    </View>
  );
});

/** An evidence scale laid along the table's edge: cream, ticked every few points, a longer tick at each fifth. */
const Scale = memo(function Scale() {
  const ticks = useMemo(() => {
    let d = "";
    for (let i = 0; i <= 100; i++) d += `M${4 + i * 4} 0 V${i % 10 === 0 ? 6 : i % 5 === 0 ? 4.4 : 2.6}`;
    return d;
  }, []);
  return (
    <View style={styles.scale}>
      <Svg width="100%" height={9} viewBox="0 0 408 9" preserveAspectRatio="xMinYMin slice">
        <Rect x={0} y={0} width={408} height={9} fill="#EFE3C4" />
        <Path d={ticks} stroke={INK} strokeWidth={0.8} />
        <Rect x={0} y={8.2} width={408} height={0.8} fill={INK} opacity={0.5} />
      </Svg>
    </View>
  );
});

const FACE: Record<Genre, object> = {
  noir: { fontFamily: LETTER_FONT.typewriter, fontSize: 16, lineHeight: 21 },
  crime_scene: { fontFamily: LETTER_FONT.reportBold, fontSize: 15, lineHeight: 20, textTransform: "uppercase", letterSpacing: 0.6 },
  paranormal: { fontFamily: LETTER_FONT.fellItalic, fontSize: 18, lineHeight: 22 },
};

/** The thing's name: a card in a brass label holder. */
export function NameLabel({ name }: { name: string }) {
  const m = useHudMaterials();
  return (
    <View style={styles.holder}>
      <Brass radius={4} />
      <View style={[styles.card, { backgroundColor: m.paper.fill }]}>
        <Text style={[FACE[m.genre], { color: m.paper.ink }]} accessibilityRole="header" numberOfLines={1} allowFontScaling={false} selectable={false}>{name}</Text>
      </View>
    </View>
  );
}

/** Putting it back: a brass stud, a cross cut into it. */
export function CloseStud({ onPress, label = "Close", testID }: { onPress: () => void; label?: string; testID?: string }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={10} testID={testID} style={styles.stud}>
      <Brass radius={18} />
      <InkMark name="cross" size={20} tone="engraved" weight={2.4} />
    </Press>
  );
}

/** A word on brass, engraved: a plate to press ("Take it"). */
export function PlateButton({ label, onPress, disabled, testID, style }: { label: string; onPress: () => void; disabled?: boolean; testID?: string; style?: object }) {
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} testID={testID} style={[styles.plate, style]}>
      <Brass radius={5} />
      <Text style={styles.plateText} allowFontScaling={false}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  cast: { position: "absolute", left: 0, right: 0, top: -26 },
  edge: { position: "absolute", left: 0, right: 0, top: 0, height: TABLE_EDGE },
  under: { position: "absolute", left: 0, right: 0, top: TABLE_EDGE },
  scale: { position: "absolute", left: 0, right: 0, top: TABLE_EDGE, height: 9, overflow: "hidden" },
  holder: { alignSelf: "flex-start", padding: 4, maxWidth: "100%" },
  card: { paddingHorizontal: 10, paddingTop: 3, paddingBottom: 2, borderRadius: 1.5, borderWidth: 0.8, borderColor: "rgba(30, 20, 24, 0.55)" },
  stud: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  plate: { minHeight: 40, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  plateText: { fontFamily: LETTER_FONT.form, fontSize: 14, lineHeight: 18, letterSpacing: 1.4, textTransform: "uppercase", color: "#33200A" },
});
