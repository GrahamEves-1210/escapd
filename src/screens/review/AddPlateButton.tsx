// "Add a photo": the photo guide's ghost pill (ref.button.ghost: 52 tall, a
// full capsule with a 1 pt hairline, the headline label), in the guide's
// reading column, with the camera glyph (ESCAPD line art, Glyphs.tsx)
// add.gap before its label, centred as one group. In the shell it is the
// guide's own dark pill (shade, hairline, white label); inside a mode the
// same pill in the mode's colours: its near-black ground as the fill, its rim
// as the hairline, its ink for the glyph and label (src/capture/ui/palette.ts),
// so the mode's accent stays on the one strong action, "Build the case".
// Pressed: the fill steps up to the raised fill (the kit's ghost press).
// Pressing in gives the light `press` haptic; the brass focus ring circles it.
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { useCapturePalette } from "@/capture/ui/palette";
import { FocusRing, useFocusRing } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { curve, ref } from "@/theme/tokens";
import { COPY } from "./copy";
import { CameraGlyph } from "./Glyphs";

const GHOST = ref.button.ghost;
const LABEL = ref.type.headline;

export function AddPlateButton({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const palette = useCapturePalette();
  const shell = palette.genre === null;
  const fill = shell ? GHOST.fill : palette.well;
  const pressedFill = shell ? GHOST.pressedFill : palette.raised;
  const edge = shell ? GHOST.border : palette.rim;
  const ink = shell ? GHOST.label : palette.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={COPY.add}
      onPressIn={feedback.press}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID="add-plate"
      style={({ pressed }) => [styles.pill, { backgroundColor: pressed ? pressedFill : fill, borderColor: edge }, style]}
    >
      <CameraGlyph color={ink} />
      <Text style={[styles.label, { color: ink }]}>{COPY.add}</Text>
      <FocusRing visible={focus.focused} shape="pill" edge={GHOST.borderWidth} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    marginHorizontal: ref.space.reading,
    minHeight: GHOST.height,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ref.layout.review.add.gap,
    paddingHorizontal: ref.space.xl,
    paddingVertical: (GHOST.height - LABEL.lineHeight) / 2 - GHOST.borderWidth,
    borderWidth: GHOST.borderWidth,
    borderRadius: ref.radius.round,
    ...curve,
  },
  label: { ...LABEL, flexShrink: 1 },
});
