// The shutter, the screen's primary action and its brightest object: a 2 pt
// bright ring with a 4 pt ground gap inside it, then a bright disk carrying
// Phosphor MagnifyingGlass in inverse ink (the user's note: "the photo button
// has a magnifier glass icon on it"). Never signal.
// - Pressed: the disk fill eases bright to brightPressed and the disk scales to
//   0.96 over ref.motion.shutterPress; the ring stays still. Reduced motion:
//   the colour change only.
// - Disabled (camera not ready or failed, roll full): the whole control at
//   ref.button.disabledOpacity, eased over ref.motion.control.
// - Busy: taps are ignored and it stays a static full-opacity white disk, with
//   accessibilityState.busy. No spinner.
// - Focus: an 84 circle, measured from the 76 box's outer edge.
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { FocusRing, timingFor, useFocusRing } from "@/components/noir";
import { MagnifyingGlassIcon } from "@/components/icons";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { Dimmable } from "./Dimmable";

const S = ref.button.shutter;
const PRESS = ref.motion.shutterPress;
const PRESS_TIMING = timingFor(PRESS);

export interface ShutterProps {
  accessibilityLabel: string;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
  testID?: string;
}

export function Shutter({ accessibilityLabel, disabled, busy, onPress, testID }: ShutterProps) {
  const { reducedMotion } = useTheme();
  const press = useSharedValue(0);
  const focus = useFocusRing();
  const inert = disabled || busy;

  const diskStyle = useAnimatedStyle(() => {
    const p = press.get();
    return {
      backgroundColor: interpolateColor(p, [0, 1], [S.fill, S.pressedFill]),
      transform: [{ scale: reducedMotion ? 1 : interpolate(p, [0, 1], [1, PRESS.scale]) }],
    };
  });

  return (
    <Dimmable dimmed={disabled}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: inert, busy }}
        // Pressable copies `disabled` over accessibilityState.disabled, so it is
        // passed only when true; busy ignores taps through the handlers instead.
        disabled={disabled ? true : undefined}
        onPress={inert ? undefined : onPress}
        onPressIn={inert ? undefined : () => press.set(withTiming(1, PRESS_TIMING))}
        onPressOut={() => press.set(withTiming(0, PRESS_TIMING))}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        testID={testID}
        style={styles.box}
      >
        <View pointerEvents="none" style={styles.ring} />
        <Animated.View style={[styles.disk, diskStyle]}>
          <MagnifyingGlassIcon size={S.iconSize} color={S.glyph} weight="regular" />
        </Animated.View>
        <FocusRing visible={focus.focused} shape="pill" />
      </Pressable>
    </Dimmable>
  );
}

const styles = StyleSheet.create({
  // The 76 box carries no border: Yoga places absolute children inside a
  // parent's border, so a bordered box would pull the focus ring's -4 inset in
  // by the ring width (an 80 circle on the shutter's own ring, not 84 with a 2 gap).
  box: { width: S.ring, height: S.ring, alignItems: "center", justifyContent: "center" },
  // The 2 pt ring, drawn as the box's first child. It never scales.
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: ref.radius.pill,
    borderWidth: S.ringWidth,
    borderColor: S.ringColor,
    ...ref.curve,
  },
  // Inside the 72 ring opening, the 64 disk leaves the 4 pt ground gap.
  disk: {
    width: S.disk,
    height: S.disk,
    borderRadius: ref.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    ...ref.curve,
  },
});
