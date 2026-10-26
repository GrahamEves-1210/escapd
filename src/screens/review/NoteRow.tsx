// The retake hint under the photos: a grey line glyph (the tap art) in a 20
// box and a line in 01's subtitle (Medium 17, the palette's muted ink) beside
// it, note.gap apart, the glyph centred on the first line. The glyph is
// decorative.
import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useCapturePalette } from "@/capture/ui/palette";
import { ref } from "@/theme/tokens";

const N = ref.layout.review.note;
const TYPE = ref.type.subtitle;

export function NoteRow({ glyph, text, style, testID }: { glyph: ReactNode; text: string; style?: StyleProp<ViewStyle>; testID?: string }) {
  const palette = useCapturePalette();
  return (
    <View style={[styles.row, style]} testID={testID}>
      <View style={styles.glyph} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {glyph}
      </View>
      <Text style={[styles.text, { color: palette.inkMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: N.gap, marginHorizontal: ref.space.edge },
  // One line box tall, so the glyph sits on the first line's centre however the text wraps.
  glyph: { width: N.icon, height: TYPE.lineHeight, justifyContent: "center" },
  text: { ...TYPE, flexShrink: 1 },
});
