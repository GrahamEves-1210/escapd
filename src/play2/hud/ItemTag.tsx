// What a held item is, when it's tapped in the tray: a tag of the mode's
// paper tied to it (a punched eyelet, a loop of twine), the thing itself
// drawn beside its name, a line on it in the mode's own hand. It stands on
// the tools' row, clear of them; a tap anywhere puts it away.
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { ItemDef } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { useModeTheme } from "@/game/mode";
import { LETTER_FONT } from "@/theme/payoff";
import { ref } from "@/theme/tokens";
import { ItemIcon } from "../ItemTray";
import { TornEdge } from "../journal/Paper";
import { GroundShadow, hidden, INK, useHudMaterials } from "./materials";

const LABEL: Record<Genre, object> = {
  noir: { fontFamily: LETTER_FONT.typewriter, fontSize: 10, lineHeight: 13, letterSpacing: 1.6, textTransform: "uppercase" },
  crime_scene: { fontFamily: LETTER_FONT.form, fontSize: 9.5, lineHeight: 13, letterSpacing: 1.5, textTransform: "uppercase" },
  paranormal: { fontFamily: LETTER_FONT.fell, fontSize: 10.5, lineHeight: 13, letterSpacing: 2, textTransform: "uppercase" },
};

export function ItemTag({ item, label, name, text }: { item: ItemDef; label: string; name: string; text: string }) {
  const m = useHudMaterials();
  const theme = useModeTheme();
  const hand = typeof theme.hand.fontFamily === "string" ? theme.hand.fontFamily : ref.font.hand;
  return (
    <View style={[styles.tag, { shadowColor: m.shadow }]} testID="v2-item-card">
      <View style={[styles.body, { backgroundColor: m.paper.fill }]}>
        <Eyelet shade={m.paper.shade} />
        <View style={styles.glyph}>
          <GroundShadow width={44} height={12} color={m.paper.ink} opacity={0.35} style={styles.glyphShadow} />
          <ItemIcon item={item} size={46} />
        </View>
        <View style={styles.words}>
          <Text style={[LABEL[m.genre], { color: m.paper.pen }]} allowFontScaling={false}>{label}</Text>
          <Text style={[styles.name, { color: m.paper.ink, fontFamily: ref.font.cover }]}>{name}</Text>
          <Text style={[styles.text, { color: m.paper.muted, fontFamily: hand }]}>{text}</Text>
        </View>
      </View>
      <TornEdge color={m.paper.fill} side="bottom" seed={item.id} height={5} teeth={40} />
    </View>
  );
}

/** The tag's punched eyelet and the twine through it. */
const Eyelet = memo(function Eyelet({ shade }: { shade: string }) {
  return (
    <View style={styles.eyelet} {...hidden}>
      <Svg width={26} height={34} viewBox="0 0 26 34">
        <Circle cx={12} cy={22} r={5.4} fill={shade} />
        <Circle cx={12} cy={22} r={2.5} fill={INK} />
        <Path d="M12.2 21.6 C8 15 7 8 10.6 0" stroke="#B3182F" strokeWidth={1.5} strokeLinecap="round" fill="none" />
        <Path d="M11.8 22.4 C11.4 14 14 6 19 0" stroke="#8E1225" strokeWidth={1.5} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  tag: {
    alignSelf: "center", maxWidth: 360, marginHorizontal: ref.space.lg, transform: [{ rotate: "-0.8deg" }],
    shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  body: { flexDirection: "row", alignItems: "center", gap: ref.space.sm, paddingLeft: 30, paddingRight: 14, paddingTop: 10, paddingBottom: 6, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  eyelet: { position: "absolute", left: 2, top: -12 },
  glyph: { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  glyphShadow: { bottom: 0 },
  words: { flexShrink: 1, gap: 1 },
  name: { fontSize: 17, lineHeight: 22 },
  text: { fontSize: 15, lineHeight: 19 },
});
