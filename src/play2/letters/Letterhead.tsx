// The correspondence's letterhead (src/play2/letters), for the pages that
// belong to the same world as the letters: the casebook's page and case
// closed's card. The series line set left as each mode's paper prints it,
// over its rule: noir's engraved plum italic over a fine double rule (the
// hotel stationery), crime scene's printed form face over a heavy oxblood
// rule (the intake sheet), paranormal's IM Fell italic over a faint rule
// (the old letter). Never centred between hairlines with an ornament.
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { Genre } from "@/lib/puzzle-types";
import { LETTER, LETTER_FONT } from "@/theme/payoff";

export const LETTERHEAD_TYPE = {
  noir: { fontFamily: LETTER_FONT.engraved, fontSize: 16, lineHeight: 21 },
  crime_scene: { fontFamily: LETTER_FONT.form, fontSize: 15, lineHeight: 20 },
  paranormal: { fontFamily: LETTER_FONT.fellItalic, fontSize: 19, lineHeight: 24 },
} as const;

/** Each mode's letterhead ink (4.5:1 or more on its paper, brief-test). */
export const LETTERHEAD_INK: Record<Genre, string> = { noir: LETTER.noir.head, crime_scene: LETTER.crime_scene.form, paranormal: LETTER.paranormal.ink };

export function Letterhead({ genre, text, right, ink = LETTERHEAD_INK[genre], style, testID }: {
  genre: Genre;
  text: string;
  /** A quiet word at the right of the line (a page number). */
  right?: string;
  ink?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View style={style}>
      <View style={styles.row}>
        <Text style={[LETTERHEAD_TYPE[genre], styles.flex, { color: ink }]} testID={testID}>{text}</Text>
        {right ? <Text style={[LETTERHEAD_TYPE[genre], styles.right, { color: ink }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{right}</Text> : null}
      </View>
      {genre === "noir" ? (
        <>
          <View style={[styles.rule, { backgroundColor: ink, opacity: 0.8 }]} />
          <View style={[styles.thin, { backgroundColor: ink, opacity: 0.6 }]} />
        </>
      ) : genre === "crime_scene" ? (
        <View style={[styles.heavy, { backgroundColor: ink }]} />
      ) : (
        <View style={[styles.faint, { backgroundColor: ink }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  flex: { flex: 1 },
  right: { fontSize: 14 },
  rule: { height: 1.2, marginTop: 6 },
  thin: { height: 0.6, marginTop: 2 },
  heavy: { height: 2.5, marginTop: 6 },
  faint: { height: 0.8, marginTop: 6, opacity: 0.45 },
});
