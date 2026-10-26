// The reference's outlined "Add photos" pill: x 19.5-373.5, 49 tall, fully
// round, a 1 pt outline in the ink colour (white here, black there) straddling
// x 20 / 373 as the reference's does, the camera glyph (ESCAPD line art to the
// reference's square camera, Glyphs.tsx) and a Semibold 16 label, centred as
// one group.
// Pressed: the inside fills with ref.color.raised (a proposal; the reference
// shows no press). Inside a mode: the outline, glyph and label in the mode's
// ink, pressed in its raised fill (src/capture/ui/palette.ts).
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { useCapturePalette } from "@/capture/ui/palette";
import { FocusRing, useFocusRing } from "@/components/noir";
import { curve, ref } from "@/theme/tokens";
import { COPY } from "./copy";
import { CameraGlyph } from "./Glyphs";

const L = ref.layout.review;
const A = L.add;

export function AddPlateButton({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const focus = useFocusRing();
  const palette = useCapturePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={COPY.add}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID="add-plate"
      style={({ pressed }) => [styles.pill, { borderColor: palette.ink }, pressed ? { backgroundColor: palette.raised } : null, style]}
    >
      <CameraGlyph color={palette.ink} />
      <Text style={[styles.label, { color: palette.ink }]}>{COPY.add}</Text>
      <FocusRing visible={focus.focused} shape="pill" edge={A.border} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    marginHorizontal: A.inset,
    minHeight: A.height,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: A.gap,
    paddingHorizontal: ref.space.xl,
    borderWidth: A.border,
    borderRadius: ref.radius.round,
    ...curve,
  },
  label: { ...L.type.action, flexShrink: 1 },
});
