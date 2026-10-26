// The shutter, Once's (ref.button.shutter): a 75 near-black ring
// (ref.color.well, 4 thick) around a 67 disk filled with
// ref.gradient.shutterDisk (210 deg, darker at the top right, lighter at the
// bottom left), a 1 pt bevel along the disk's top edge (ref.color.bevel,
// fading down the sides), and the screen's only light: a soft white glow
// biased upward (ref.effect.shutterGlow). The user's note puts a magnifying
// glass on it: Phosphor MagnifyingGlass, regular, in the reference's white
// (textPrimary), on the disk's centre, nudged so its lens reads as centred
// (ref.layout.camera.shutter.glassNudge). Its centre sits ref.layout.camera
// .shutter.drop below the bottom row's, as measured: the component is that
// much taller above the ring, so its whole 75 target stays inside the row.
// - Pressed: the disk (with the glass) scales to 0.94 and its gradient steps
//   one notch darker (ref.gradient.shutterDiskPressed) over
//   ref.motion.shutterPress; the ring and glow stay still. Reduced motion: the
//   gradient change only.
// - Disabled (camera not ready or failed, roll full): the whole control at
//   0.4, eased over ref.motion.control.
// - Busy: taps are ignored; it stays still at full opacity, with
//   accessibilityState.busy.
// - Focus: the kit's brass ring, a circle 4 outside the ring.
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient } from "react-native-svg";
import { FocusRing, gradientLine, gradientStops, timingFor, useFocusRing } from "@/components/noir";
import { ICON_WEIGHT, MagnifyingGlassIcon } from "@/components/icons";
import { useTheme } from "@/theme/ThemeProvider";
import { curve, ref } from "@/theme/tokens";
import { Dimmable } from "./Dimmable";

const B = ref.button.shutter;
const S = ref.layout.camera.shutter;
const PRESS_TIMING = timingFor(ref.motion.shutterPress);
const R = B.disk / 2;
const DISK_LINE = gradientLine(ref.gradient.shutterDisk.angle, B.disk, B.disk);
const PRESSED_LINE = gradientLine(ref.gradient.shutterDiskPressed.angle, B.disk, B.disk);

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

  const diskStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : interpolate(press.get(), [0, 1], [1, ref.motion.shutterPress.scale]) }],
  }));
  const pressedStyle = useAnimatedStyle(() => ({ opacity: press.get() }));

  return (
    <Dimmable dimmed={disabled} style={styles.drop}>
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
        <View pointerEvents="none" style={styles.ring} testID={testID ? `${testID}-ring` : undefined} />
        <Animated.View pointerEvents="none" style={[styles.disk, diskStyle]} testID={testID ? `${testID}-disk` : undefined}>
          <Svg width={B.disk} height={B.disk} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="shutterDisk" gradientUnits="userSpaceOnUse" {...DISK_LINE}>
                {gradientStops(ref.gradient.shutterDisk.stops)}
              </LinearGradient>
              <LinearGradient id="shutterBevel" {...S.bevelLine}>
                {gradientStops(S.bevel)}
              </LinearGradient>
            </Defs>
            <Circle cx={R} cy={R} r={R} fill="url(#shutterDisk)" />
            <Circle cx={R} cy={R} r={R - S.bevelWidth / 2} fill="none" stroke="url(#shutterBevel)" strokeWidth={S.bevelWidth} />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, pressedStyle]}>
            <Svg width={B.disk} height={B.disk}>
              <Defs>
                <LinearGradient id="shutterDiskPressed" gradientUnits="userSpaceOnUse" {...PRESSED_LINE}>
                  {gradientStops(ref.gradient.shutterDiskPressed.stops)}
                </LinearGradient>
              </Defs>
              <Circle cx={R} cy={R} r={R} fill="url(#shutterDiskPressed)" />
            </Svg>
          </Animated.View>
          {/* In a View, so it stacks above the absolute layers on the web too. */}
          <View style={styles.glass}>
            <MagnifyingGlassIcon size={B.iconFallback} color={ref.color.textPrimary} weight={ICON_WEIGHT} testID={testID ? `${testID}-glass` : undefined} />
          </View>
        </Animated.View>
        <FocusRing visible={focus.focused} shape="pill" />
      </Pressable>
    </Dimmable>
  );
}

const styles = StyleSheet.create({
  // Room above the ring for its drop, so its centre sits `drop` below the row's.
  drop: { paddingTop: S.drop * 2 },
  // The 75 box carries no border: Yoga places absolute children inside a
  // parent's border, which would pull the focus ring in.
  box: { width: B.ring, height: B.ring, alignItems: "center", justifyContent: "center" },
  // The ring is the box's own circle under the disk, glowing upward.
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: ref.radius.round,
    backgroundColor: B.ringFill,
    boxShadow: ref.effect.shutterGlow,
    ...curve,
  },
  disk: {
    width: B.disk,
    height: B.disk,
    borderRadius: ref.radius.round,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    ...curve,
  },
  // Nudged so the lens, not the glyph's box, reads as centred.
  glass: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: S.glassNudge.x }, { translateY: S.glassNudge.y }],
  },
});
