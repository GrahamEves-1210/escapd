// "Before you build": three friendly tips in a plain vertical list, then one
// calm line on what happens to the photos. The heading is Bold 14 (the
// reference's section heading, section.inset from the edge); each tip is a
// numbered disc (24, raised) and a Regular 16 line beside it, its first line
// centred on the disc, tips.gap apart. The note under them is Regular 14 grey,
// with no glyph: it reassures, it doesn't warn. Nothing here is a control.
// Inside a mode: the mode's ink, muted ink and raised discs
// (src/capture/ui/palette.ts).
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useCapturePalette, type CapturePalette } from "@/capture/ui/palette";
import { ref } from "@/theme/tokens";
import { COPY } from "./copy";

const L = ref.layout.review;
const S = L.section;
const T = L.tips;

export function ChecksSection({ style }: { style?: StyleProp<ViewStyle> }) {
  const palette = useCapturePalette();
  return (
    <View style={style}>
      <Text accessibilityRole="header" style={[styles.heading, { color: palette.ink }]}>
        {COPY.checksTitle}
      </Text>
      <View style={styles.list} testID="tips">
        {COPY.checks.map((line, i) => (
          <Tip key={line} mark={String(i + 1)} text={line} palette={palette} />
        ))}
      </View>
      <Text style={[styles.note, { color: palette.inkMuted }]} testID="privacy-note">
        {COPY.privacy}
      </Text>
    </View>
  );
}

// The disc's number is drawn only; the tip reads with its number
// ("1. Keep people out of the shot.") as one text element.
function Tip({ mark, text, palette }: { mark: string; text: string; palette: CapturePalette }) {
  return (
    <View style={styles.tip} testID="tip">
      <View style={[styles.disc, { backgroundColor: palette.raised }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[styles.mark, { color: palette.ink }]}>{mark}</Text>
      </View>
      <Text style={[styles.tipText, { color: palette.ink }]} accessibilityLabel={`${mark}. ${text}`}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { ...L.type.section, marginHorizontal: S.inset },
  list: { marginTop: S.listGap, marginHorizontal: ref.space.edge, gap: T.gap },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: T.discGap },
  disc: {
    minWidth: T.disc,
    minHeight: T.disc,
    borderRadius: ref.radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { ...L.type.tipNumber, textAlign: "center" },
  // The first line centred on the disc.
  tipText: { ...L.type.tip, flex: 1, marginTop: (T.disc - L.type.tip.lineHeight) / 2 },
  note: { ...L.type.hint, marginTop: S.noteGap, marginHorizontal: ref.space.edge },
});
