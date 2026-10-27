// "Before you build": the photo guide's step title (Bold 22), then three
// friendly tips in a plain vertical list, then one calm line on what happens
// to the photos. Each tip is a raised disc holding its numeral in 02's
// counter italic and a Regular 17 line beside it, its first line centred on
// the disc. The note under them is Regular 15 in the muted ink, with no
// glyph: it reassures, it doesn't warn. Nothing here is a control.
// Inside a mode: the mode's ink, muted ink and raised discs, the numerals in
// its lit colour (src/capture/ui/palette.ts).
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
    <View style={[styles.root, style]}>
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

// The disc's numeral is drawn only; the tip reads with its number
// ("1. Stand in the middle and turn all the way round.") as one text element.
function Tip({ mark, text, palette }: { mark: string; text: string; palette: CapturePalette }) {
  return (
    <View style={styles.tip} testID="tip">
      <View style={[styles.disc, { backgroundColor: palette.raised }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[styles.mark, { color: palette.lit }]}>{mark}</Text>
      </View>
      <Text style={[styles.tipText, { color: palette.ink }]} accessibilityLabel={`${mark}. ${text}`}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginHorizontal: ref.space.edge },
  heading: { ...ref.type.stepTitle },
  list: { marginTop: S.listGap, gap: T.gap },
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
  note: { ...L.type.note, marginTop: S.noteGap },
});
