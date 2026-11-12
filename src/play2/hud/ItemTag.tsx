// What a held item is, when it's tapped in the tray: a tag of the mode's
// paper tied to it (a punched eyelet, a loop of twine), the thing itself
// drawn beside its name. Its name, and at most one short line of its own
// (what's written on it or about it, when the room gives one that fits a
// line): never what to do with it. The casebook's hints say that, when
// asked. It stands on the tools' row, clear of them; a tap anywhere puts it
// away.
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { ItemDef } from "@/engine/v2";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { ItemIcon } from "../ItemTray";
import { TornEdge } from "../journal/Paper";
import { KeyImpression } from "../mechanisms/gadgets/KeyArt";
import { isBitting } from "../mechanisms/gadgets/keys";
import { GroundShadow, hidden, INK, useHudMaterials } from "./materials";

/** The longest line a tag carries (characters): past it, the tag is the name alone (the whole card is a hold away). */
export const TAG_LINE = 64;

/** The one short in-world line a tag may carry: the item's own card's first sentence, if it's short. Else none. */
export function tagLine(text: string | null | undefined): string | null {
  // The first sentence: up to a full stop that ends one (the next word starts with a capital, or nothing follows; "No. 7" isn't one).
  const whole = (text ?? "").trim().split("\n")[0];
  const first = (whole.match(/^.*?[.!?](?=\s+[A-Z\u201C"']|\s*$)/)?.[0] ?? whole).trim();
  return first && first.length <= TAG_LINE ? first : null;
}

export function ItemTag({ item, name, line }: { item: ItemDef; name: string; line?: string | null }) {
  const m = useHudMaterials();
  const theme = useModeTheme();
  const hand = typeof theme.hand.fontFamily === "string" ? theme.hand.fontFamily : ref.font.hand;
  // A key pressed into soap or wax: its card is the key's cuts, which are drawn (the thing itself), never written.
  const pressed = line && isBitting(line) ? line.trim() : null;
  const said = pressed ? null : tagLine(line);
  return (
    <View style={[styles.tag, { shadowColor: m.shadow }]} testID="v2-item-card">
      <View style={[styles.body, { backgroundColor: m.paper.fill }]}>
        <Eyelet shade={m.paper.shade} />
        {pressed ? <KeyImpression bitting={pressed} width={132} /> : (
          <View style={styles.glyph}>
            <GroundShadow width={44} height={12} color={m.paper.ink} opacity={0.35} style={styles.glyphShadow} />
            <ItemIcon item={item} size={46} />
          </View>
        )}
        <View style={styles.words}>
          <Text style={[styles.name, { color: m.paper.ink, fontFamily: ref.font.cover }]}>{name}</Text>
          {said ? <Text style={[styles.text, { color: m.paper.muted, fontFamily: hand }]} testID="v2-item-line">{said}</Text> : null}
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
  body: { flexDirection: "row", alignItems: "center", gap: ref.space.sm, paddingLeft: 30, paddingRight: 20, paddingTop: 10, paddingBottom: 6, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  eyelet: { position: "absolute", left: 2, top: -12 },
  glyph: { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  glyphShadow: { bottom: 0 },
  words: { flexShrink: 1, gap: 1 },
  name: { fontSize: 17, lineHeight: 22 },
  text: { fontSize: 15, lineHeight: 19 },
});
