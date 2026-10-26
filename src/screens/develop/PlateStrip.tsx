// 06 · The player's photos on the build wait: 07's tiles in miniature, in one
// centred row, each numbered by its photo slot, 1 to 6 (Arabic, round 4); a
// removed photo leaves a gap in the numbers.
// Each is the photo in full colour (cover) inside a 1 pt ref.color.rim edge
// with plate.radius corners, its number above it in 07's label style. Until
// the case is ready, a neutral void veil sits over photos still to send
// (lighter over sent ones), so the strip fills in as the photos go. Hidden
// from screen readers: the copy and the thinking line carry the status.
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { ref } from "@/theme/tokens";

const P = ref.layout.develop.plate;
const V = ref.layout.develop.veil;

export function PlateStrip({ plates, sent, developed }: {
  /** Filled photos in slot order; `number` is the slot's number (default: list position + 1). */
  plates: readonly { uri: string; number?: number }[];
  /** How many plates have been sent; undefined counts none sent. */
  sent?: number;
  developed?: boolean;
}) {
  return (
    <View style={styles.strip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="darkroom-plates">
      {plates.map((plate, i) => (
        <View key={plate.uri} style={styles.cell}>
          <Text style={styles.label} numberOfLines={1}>
            {plate.number ?? i + 1}
          </Text>
          <View style={styles.tile} testID={`darkroom-plate-${i}`}>
            <View style={styles.loading} />
            <Image source={{ uri: plate.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
            {developed ? null : (
              <View style={[styles.veil, { opacity: sent !== undefined && i < sent ? V.sent : V.unsent }]} testID={`darkroom-veil-${i}`} />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", gap: P.gap },
  cell: { width: P.size, gap: P.labelGap },
  label: { ...P.label, color: ref.color.textSecondary },
  tile: {
    width: P.size,
    height: P.size,
    overflow: "hidden",
    borderRadius: P.radius,
    ...ref.curve,
    borderWidth: P.rim,
    borderColor: ref.color.rim,
  },
  // Shows only while the image loads, as 07's tiles.
  loading: { ...StyleSheet.absoluteFill, backgroundColor: ref.color.raised },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: V.color },
});
