// The reference's outlined "Add photos" pill: x 19.5-373.5, 49 tall, fully
// round, a 1 pt outline in the ink colour (white here, black there) straddling
// x 20 / 373 as the reference's does, the camera glyph (ESCAPD line art to the
// reference's square camera, Glyphs.tsx) and a Semibold 16 label, centred as
// one group.
// Pressed: the inside fills with ref.color.raised (a proposal; the reference
// shows no press).
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { FocusRing, useFocusRing } from "@/components/noir";
import { curve, ref } from "@/theme/tokens";
import { COPY } from "./copy";
import { CameraGlyph } from "./Glyphs";

const L = ref.layout.review;
const A = L.add;

export function AddPlateButton({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={COPY.add}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID="add-plate"
      style={({ pressed }) => [styles.pill, pressed ? styles.pressed : null, style]}
    >
      <CameraGlyph color={ref.color.textPrimary} />
      <Text style={styles.label}>{COPY.add}</Text>
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
    borderColor: ref.color.textPrimary,
    borderRadius: ref.radius.round,
    ...curve,
  },
  pressed: { backgroundColor: A.pressedFill },
  label: { ...L.type.action, color: ref.color.textPrimary, flexShrink: 1 },
});
