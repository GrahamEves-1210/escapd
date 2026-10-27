// The header, the camera's (02, src/capture/ui/rangefinder/Header.tsx): the
// 44 square back button `edge` from the left edge and `top` under the safe
// top, and between it and an empty square's width on the right, the serif
// title "Your photos" (ref.type.serifTitle) over the grey meta line ("4 of 5
// taken" against the roll's plan, ref.type.meta), both centred, filling the square's 44 at one line
// each. A larger text size grows the header downward. The title and the count
// are one screen-reader header ("Your photos, 4 of 5 photos taken"), read
// politely when the count changes. Inside a mode: the mode's raised square,
// ink and muted ink (src/capture/ui/palette.ts).
import { StyleSheet, Text, View } from "react-native";
import { ArrowLeftIcon } from "@/components/icons";
import { SquareButton } from "@/capture/ui/rangefinder/SquareButton";
import { useCapturePalette } from "@/capture/ui/palette";
import { ref } from "@/theme/tokens";
import { COPY } from "./copy";

const C = ref.layout.camera;
const SQ = ref.button.square;

export function ReviewHeader({ top, count, max, onBack }: { top: number; count: number; max: number; onBack: () => void }) {
  const palette = useCapturePalette();
  return (
    <View style={[styles.row, { paddingTop: top + C.top }]} testID="review-header">
      <SquareButton icon={ArrowLeftIcon} accessibilityLabel={COPY.backLabel} onPress={onBack} testID="review-back" />
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${COPY.title}, ${COPY.countSpoken(count, max)}`}
        accessibilityLiveRegion="polite"
        style={styles.prompt}
        testID="review-title"
      >
        <Text style={[styles.title, { color: palette.ink }]}>{COPY.title}</Text>
        <Text style={[styles.meta, { color: palette.inkMuted }]} testID="review-count">
          {COPY.count(count, max)}
        </Text>
      </View>
      {/* The right square's place, so the title stays centred on the screen. */}
      <View style={styles.balance} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: C.edge },
  // Between the squares, space.sm clear of each, as the camera's prompt.
  prompt: { flex: 1, marginHorizontal: ref.space.sm, paddingTop: C.promptTop, alignItems: "center" },
  title: { ...ref.type.serifTitle, textAlign: "center" },
  meta: { ...ref.type.meta, textAlign: "center", marginTop: C.metaGap },
  balance: { width: SQ.size },
});
