// A card that is a thing, not a page (copy.ts: its text is only what is stamped, engraved or written on
// it): the thing itself, rendered (icons/art.ts), large, with what's on it drawn where it is. A brass
// weight shows the mark stamped into its drum; a ring, a locket, a balance's lid show their engraving
// under them, cut in the metal's own face; a blank letter is blank but for the faint brown tide marks
// of something that dried on it; a note written back to front shows its scrawl the wrong way round.
// No words describe it.
import { memo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import { LETTER_FONT } from "@/theme/payoff";
import { ItemIcon } from "../ItemTray";
import { stampOf } from "../mechanisms/gadgets/held";

/** What a thing's card draws: the thing, and where its words go. */
export type ThingLook = "inscribed" | "mirrored" | "blank";

/** A card drawn as the thing itself, or null when it is writing on paper. */
export function thingOf(card: { title: string; text: string }, look: string | undefined): ThingLook | null {
  if (look === "inscribed") return "inscribed";
  if (look === "mirrored") return "mirrored";
  if (!look && card.text.trim() === "") return "blank";
  return null;
}

const ENGRAVED = "#5B4320";

export function Thing({ title, text, look, size = 104, ink = ENGRAVED, style, testID }: {
  title: string; text: string; look: ThingLook; size?: number; ink?: string; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const weight = /\bweight\b/i.test(title);
  const stamp = weight ? stampOf(title, text.trim()) : "";
  const engraving = look === "inscribed" && !weight ? text.trim() : "";
  const lemon = look === "blank" && /blank/i.test(title);
  return (
    <View style={[styles.root, style]} testID={testID} accessible accessibilityLabel={engraving ? `${title}: ${engraving}` : stamp ? `${title}, stamped ${stamp}` : title}>
      <View style={{ width: size, height: size }}>
        <ItemIcon item={{ name: title, kind: "prop" }} size={size} />
        {stamp ? (
          // Stamped into the drum: dark in the cut, a line of light on its lower lip.
          <Text style={[styles.stamp, { top: size * 0.56, fontSize: Math.round(size * 0.2), lineHeight: Math.round(size * 0.26) }]} allowFontScaling={false}>{stamp}</Text>
        ) : null}
        {lemon ? <TideMarks size={size} /> : null}
        {look === "mirrored" ? <Scrawl size={size} /> : null}
      </View>
      {engraving ? (
        <Text style={[styles.engraving, { color: ink, fontSize: size > 90 ? 20 : 15, lineHeight: size > 90 ? 26 : 20 }]}>{engraving}</Text>
      ) : null}
    </View>
  );
}

/** Lemon juice dried on paper: faint brownish tide marks, hardly there. */
const TideMarks = memo(function TideMarks({ size }: { size: number }) {
  const s = size;
  return (
    <Svg width={s} height={s} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Ellipse cx={s * 0.38} cy={s * 0.42} rx={s * 0.13} ry={s * 0.07} fill="#B98A3A" fillOpacity={0.16} stroke="#9C6F2A" strokeOpacity={0.22} strokeWidth={0.8} />
      <Ellipse cx={s * 0.62} cy={s * 0.6} rx={s * 0.1} ry={s * 0.05} fill="#B98A3A" fillOpacity={0.13} stroke="#9C6F2A" strokeOpacity={0.2} strokeWidth={0.7} />
      <Ellipse cx={s * 0.5} cy={s * 0.33} rx={s * 0.06} ry={s * 0.03} fill="#B98A3A" fillOpacity={0.12} />
    </Svg>
  );
});

/** Handwriting set down back to front: loops leaning the wrong way, read right to left. */
const Scrawl = memo(function Scrawl({ size }: { size: number }) {
  const s = size;
  const line = (y: number, w: number) => {
    let d = `M${s * 0.78} ${y}`;
    for (let x = s * 0.78; x > s * (0.78 - w); x -= s * 0.045) d += ` q${-s * 0.012} ${-s * 0.05} ${-s * 0.024} 0 q${-s * 0.006} ${s * 0.03} ${-s * 0.021} ${s * 0.002}`;
    return d;
  };
  return (
    <Svg width={s} height={s} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={`${line(s * 0.42, 0.5)} ${line(s * 0.52, 0.42)} ${line(s * 0.62, 0.3)}`} stroke="#2A2230" strokeOpacity={0.62} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </Svg>
  );
});

const styles = StyleSheet.create({
  root: { alignItems: "center", gap: 8 },
  stamp: {
    position: "absolute", left: 0, right: 0, textAlign: "center", color: "#2A1A0C",
    textShadowColor: "rgba(255, 244, 214, 0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0,
  },
  engraving: { fontFamily: LETTER_FONT.engraved, textAlign: "center", letterSpacing: 0.4 },
});
