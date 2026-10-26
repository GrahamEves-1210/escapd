// Close (docs/DESIGN.md 04, Layout: Close disc): Apple Health's light grey
// glass disc on black, ref.button.dismissGlass. A 48 disc of glassDisc
// #848484 inside a 1 pt specular ring (50 across, measured 50.3), brightest at
// the lower right and the upper left (ref.layout.guide.close.ring), with the
// Phosphor X at 26 regular in black (16.2 of ink, stroke 1.6, as measured):
// a dark glyph on a light disc. No shadow and no blur (react-native can't
// draw the reference's Liquid Glass; on pure black the solid grey looks the
// same). Pressed at the disc's 0.75 opacity. The brass focus ring (ref.focus)
// circles it while it has keyboard, D-pad or switch focus. Pressing in gives
// the light `press` haptic. Inside a mode the disc is the mode's muted ink
// and the X its ground (src/capture/ui/palette.ts): still a light disc with a
// dark glyph, the ring's highlights unchanged.
import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient } from "react-native-svg";
import { ICON_WEIGHT, XIcon } from "@/components/icons";
import { FocusRing, gradientLine, gradientStops, useFocusRing, SquashPressable } from "@/components/noir";
import { useCapturePalette } from "@/capture/ui/palette";
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";

const D = ref.button.dismissGlass;
const RING = ref.layout.guide.close.ring;

/** The disc's outer diameter, ring included: 48 + 2 x 1 = 50. */
export const CLOSE_DISC = D.size + D.ringWidth * 2;
const CENTRE = CLOSE_DISC / 2;
// The ring's gradient line across the disc's square, in its own units.
const RING_LINE = gradientLine(RING.angle, CLOSE_DISC, CLOSE_DISC);

export function CloseButton({ accessibilityLabel, onPress }: { accessibilityLabel: string; onPress: () => void }) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const palette = useCapturePalette();
  const ringId = `guideRing${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <SquashPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={feedback.press}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID="guide-close"
      style={({ pressed }) => [styles.disc, pressed && styles.pressed]}
    >
      <Svg width={CLOSE_DISC} height={CLOSE_DISC} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={ringId} gradientUnits="userSpaceOnUse" {...RING_LINE}>
            {gradientStops(RING.stops)}
          </LinearGradient>
        </Defs>
        {/* The stroke's centre half a ring width in from the edge: the fill is the 48 disc, the stroke the outer 1. */}
        <Circle cx={CENTRE} cy={CENTRE} r={CENTRE - D.ringWidth / 2} fill={palette.closeFill} stroke={`url(#${ringId})`} strokeWidth={D.ringWidth} />
      </Svg>
      {/* In a view of its own, so it paints over the disc on the web too (an absolute svg outranks a static one there). */}
      <View pointerEvents="none">
        <XIcon size={D.icon} weight={ICON_WEIGHT} color={palette.closeGlyph} />
      </View>
      <FocusRing visible={focus.focused} shape="pill" />
    </SquashPressable>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: CLOSE_DISC,
    height: CLOSE_DISC,
    borderRadius: D.radius,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: D.pressedOpacity },
});
