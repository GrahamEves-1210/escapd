// Once's square header button (02): a 44 rounded square (ref.button.square:
// ref.color.raised, radius 14 continuous, a 1 pt rim on all four edges in
// the measured ref.layout.camera.squareRim, no shadow) carrying a Phosphor
// glyph in textPrimary at the measured size and weight
// (ref.layout.camera.headerIcon: bold 18). The hit area is 48 (hitSlop 2),
// which the header row carries inside its own box: native hit-testing drops
// touches outside a parent.
// - Pressed: the whole button at ref.button.square.pressedOpacity 0.75, and
//   the kit's press-in squash (SquashPressable; none under reduced motion).
// - Disabled: 0.4, eased over ref.motion.control (Dimmable).
// - Focus: the kit's brass ring, concentric with the 14 corners.
// - Haptic: the light `press` as it is pressed in.
// - In a mode: the mode's raised fill, rim and ink (src/capture/ui/palette.ts).
// - `chrome` (the camera's own header only; every other screen keeps the look
//   above): the camera's push button, a rendered black cap in a brass rim
//   (ART.buttonSquare, a 52 picture centred on the 44 control) in place of the
//   fill and rim, the glyph in the palette's ink; same size, hit area, press,
//   focus ring and haptic.
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { FocusRing, SquashPressable, useFocusRing, type NoirIcon } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { curve, ref } from "@/theme/tokens";
import { ART } from "../art";
import { CHROME } from "../look";
import { useCapturePalette } from "../palette";
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
  /** The camera's rendered push button instead of the flat square (02's header only). */
  chrome?: boolean;
  testID?: string;
}

export function SquareButton({ icon: Icon, accessibilityLabel, onPress, disabled = false, chrome = false, testID }: SquareButtonProps) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const palette = useCapturePalette();
  return (
    <Dimmable dimmed={disabled}>
      <SquashPressable
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
        style={({ pressed }) => [
          styles.box,
          chrome ? null : [styles.flat, { backgroundColor: palette.raised, borderColor: palette.squareRim }],
          pressed ? styles.pressed : null,
        ]}
      >
        {chrome ? (
          <>
            <Image source={ART.buttonSquare} pointerEvents="none" accessible={false} style={styles.art} testID={testID ? `${testID}-art` : undefined} />
            {/* In a View, so it stacks above the picture on the web too. */}
            <View>
              <Icon size={L.headerIcon.size} color={palette.ink} weight={L.headerIcon.weight} />
            </View>
          </>
        ) : (
          <Icon size={L.headerIcon.size} color={palette.ink} weight={L.headerIcon.weight} />
        )}
        <FocusRing visible={focus.focused} shape="panel" edge={chrome ? 0 : B.borderWidth} radius={B.radius} />
      </SquashPressable>
    </Dimmable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: B.size,
    height: B.size,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: B.radius,
    ...curve,
  },
  // The flat square's rim (its fill and rim colour are the palette's).
  flat: { borderWidth: B.borderWidth },
  // The camera's button: its picture, centred on the control.
  art: {
    position: "absolute",
    left: (B.size - CHROME.square) / 2,
    top: (B.size - CHROME.square) / 2,
    width: CHROME.square,
    height: CHROME.square,
  },
  pressed: { opacity: B.pressedOpacity },
});
