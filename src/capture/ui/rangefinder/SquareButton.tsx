// Once's square header button (02): a 44 rounded square (ref.button.square:
// ref.color.raised, radius 14 continuous, a 1 pt rim on all four edges in
// the measured ref.layout.camera.squareRim, no shadow) carrying a Phosphor
// glyph in textPrimary at the measured size and weight
// (ref.layout.camera.headerIcon: bold 18). The hit area is 48 (hitSlop 2),
// which the header row carries inside its own box: native hit-testing drops
// touches outside a parent.
// - Pressed: the whole button at ref.button.square.pressedOpacity 0.75.
// - Disabled: 0.4, eased over ref.motion.control (Dimmable).
// - Focus: the kit's brass ring, concentric with the 14 corners.
// - Haptic: the light `press` as it is pressed in.
import { Pressable, StyleSheet } from "react-native";
import { FocusRing, useFocusRing, type NoirIcon } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { curve, ref } from "@/theme/tokens";
import { Dimmable } from "./Dimmable";

const B = ref.button.square;
const L = ref.layout.camera;

/** The 2 pt each side that takes the 44 square to its 48 hit area. */
export const SQUARE_SLOP = (B.hit - B.size) / 2;

export interface SquareButtonProps {
  icon: NoirIcon;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

export function SquareButton({ icon: Icon, accessibilityLabel, onPress, disabled = false, testID }: SquareButtonProps) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  return (
    <Dimmable dimmed={disabled}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={feedback.press}
        onPress={onPress}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        hitSlop={SQUARE_SLOP}
        testID={testID}
        style={({ pressed }) => [styles.box, pressed ? styles.pressed : null]}
      >
        <Icon size={L.headerIcon.size} color={ref.color.textPrimary} weight={L.headerIcon.weight} />
        <FocusRing visible={focus.focused} shape="panel" edge={B.borderWidth} radius={B.radius} />
      </Pressable>
    </Dimmable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: B.size,
    height: B.size,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: B.fill,
    borderWidth: B.borderWidth,
    borderColor: L.squareRim,
    borderRadius: B.radius,
    ...curve,
  },
  pressed: { opacity: B.pressedOpacity },
});
