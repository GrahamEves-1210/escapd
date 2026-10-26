// The reference's hint row ("Tap and drag to rearrange your photos"): a grey
// line glyph in a 20 box at the control edge and a grey Regular 14 line
// beside it, the glyph centred on the first line (the mode's muted ink inside a mode). Used for the retake hint
// under the photos (the tap art). The glyph is decorative.
import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useCapturePalette } from "@/capture/ui/palette";
import { ref } from "@/theme/tokens";

const L = ref.layout.review;
const N = L.note;

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
  glyph: { width: N.icon, height: L.type.hint.lineHeight, justifyContent: "center" },
  text: { ...L.type.hint, flexShrink: 1 },
});
