// 06 · The player's photos on the build wait: 07's tiles in miniature, in one
// centred row, each numbered by its photo slot, 1 to 6 (Arabic, round 4); a
// removed photo leaves a gap in the numbers.
// Each is the photo in full colour (cover) inside a 1 pt ref.color.rim edge
// with plate.radius corners, its number above it in 07's label style. Until
// the case is ready, a neutral void veil sits over photos still to send
// (lighter over sent ones), so the strip fills in as the photos go. Hidden
// from screen readers: the copy and the thinking line carry the status.
// Inside a mode each photo is in the mode's baked treatment (TreatedImage, at
// the review tiles' bake size, so their bakes are reused here) and the
// numbers, rims and loading fill take the mode's colours
// (src/capture/ui/palette.ts); the veil stays neutral.
import { StyleSheet, Text, View } from "react-native";
import { useCapturePalette } from "@/capture/ui/palette";
import { TreatedImage } from "@/components/noir";
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
  const palette = useCapturePalette();
  return (
    <View style={styles.strip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="darkroom-plates">
      {plates.map((plate, i) => (
        <View key={plate.uri} style={styles.cell}>
          <Text style={[styles.label, { color: palette.inkMuted }]} numberOfLines={1}>
            {plate.number ?? i + 1}
          </Text>
          <View style={[styles.tile, { borderColor: palette.rim }]} testID={`darkroom-plate-${i}`}>
            <View style={[styles.loading, { backgroundColor: palette.raised }]} />
            <TreatedImage
              source={plate.uri}
              genre={palette.genre}
              maxEdge={ref.layout.review.tile.bake}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible={false}
              testID={`darkroom-photo-${i}`}
            />
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
  label: { ...P.label },
  tile: {
    width: P.size,
    height: P.size,
    overflow: "hidden",
    borderRadius: P.radius,
    ...ref.curve,
    borderWidth: P.rim,
  },
  // Shows only while the image loads, as 07's tiles.
  loading: { ...StyleSheet.absoluteFill },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: V.color },
});
