// The shutter, the screen's primary action and its brightest object: the
// brass rangefinder shutter. A 3 pt brass ring (color.accent, the loupe's
// ring on /play) with a 5 pt gap of ground inside it, then a 60 manila core
// (color.manila) carrying Phosphor MagnifyingGlass in color.ink (the user's
// note: "the photo button has a magnifier glass icon on it").
// - Pressed: the core eases manila to color.accentPressed and scales to 0.96
//   over ref.motion.shutterPress; the ring stays still. Reduced motion: the
//   colour change only.
// - Disabled (camera not ready or failed, roll full): the whole control at
//   ref.button.disabledOpacity, eased over ref.motion.control.
// - Busy: taps are ignored and it stays a static full-opacity manila core,
//   with accessibilityState.busy. No spinner.
// - Focus: the kit's brass ring, an 84 circle measured from the 76 box's outer
//   edge.
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { FocusRing, timingFor, useFocusRing } from "@/components/noir";
import { ICON_WEIGHT, MagnifyingGlassIcon } from "@/components/icons";
import { useTheme } from "@/theme/ThemeProvider";
import { color, curve, radius, ref } from "@/theme/tokens";
import { Dimmable } from "./Dimmable";

const S = ref.layout.camera.shutter;
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

  const coreStyle = useAnimatedStyle(() => {
    const p = press.get();
    return {
      backgroundColor: interpolateColor(p, [0, 1], [color.manila, color.accentPressed]),
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
        <Animated.View style={[styles.core, coreStyle]} testID={testID ? `${testID}-core` : undefined}>
          <MagnifyingGlassIcon size={S.icon} color={color.ink} weight={ICON_WEIGHT} />
        </Animated.View>
        <FocusRing visible={focus.focused} shape="pill" />
      </Pressable>
    </Dimmable>
  );
}

const styles = StyleSheet.create({
  // The 76 box carries no border: Yoga places absolute children inside a
  // parent's border, so a bordered box would pull the focus ring's -4 inset in
  // by the ring width (an 82 circle on the shutter's own ring, not 84 with a 2 gap).
  box: { width: S.size, height: S.size, alignItems: "center", justifyContent: "center" },
  // The 3 pt brass ring, drawn as the box's first child. It never scales.
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.round,
    borderWidth: S.ringWidth,
    borderColor: color.accent,
    ...curve,
  },
  // Inside the 70 ring opening, the 60 core leaves the 5 pt gap.
  core: {
    width: S.core,
    height: S.core,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
    ...curve,
  },
});
