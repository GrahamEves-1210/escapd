// The shutter: the camera's release, a rendered reeded brass button with a
// black face standing in its collar (ART.shutter, an 84 picture centred on
// the 75 control), inside the hub of the film-advance lever (ART.lever, turned
// about the release's centre). The user's note puts a magnifying glass on it:
// Phosphor MagnifyingGlass, regular, in the palette's ink, on the face's
// centre, nudged so its lens reads as centred
// (ref.layout.camera.shutter.glassNudge). Its centre sits ref.layout.camera
// .shutter.drop below the bottom row's: the component is that much taller
// above the control, so its whole 75 target stays inside the row.
// - Pressed: the picture of the release pressed home (ART.shutterDown, the
//   collar's shadow across it) fades in over ref.motion.shutterPress and the
//   glass sinks and scales with it (0.94). Reduced motion: the picture only.
// - A photo taken (`wind` going up): the lever winds on, out along its stroke
//   and home again (CHROME.shutter.wind). Not under reduced motion.
// - Disabled (camera not ready or failed, roll full): the whole control at
//   0.4, eased over ref.motion.control.
// - Busy: taps are ignored; it stays still at full opacity, with
//   accessibilityState.busy.
// - Focus: the kit's brass ring, a circle 4 outside the control.
// - In a mode: the glass in the mode's ink; the brass is the same in every mode.
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, ReduceMotion, interpolate, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { FocusRing, timingFor, useFocusRing } from "@/components/noir";
import { ICON_WEIGHT, MagnifyingGlassIcon } from "@/components/icons";
import { useTheme } from "@/theme/ThemeProvider";
import { curve, ref } from "@/theme/tokens";
import { ART } from "../art";
import { CHROME } from "../look";
import { useCapturePalette } from "../palette";
import { Dimmable } from "./Dimmable";

const B = ref.button.shutter;
const S = ref.layout.camera.shutter;
const K = CHROME.shutter;
const PRESS_TIMING = timingFor(ref.motion.shutterPress);
const WIND_OUT = { duration: K.wind.out, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never };
const WIND_HOME = { duration: K.wind.home, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never };

export interface ShutterProps {
  accessibilityLabel: string;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
  /** Photos on the roll: each one more winds the lever on. */
  wind?: number;
  testID?: string;
}

export function Shutter({ accessibilityLabel, disabled, busy, onPress, wind = 0, testID }: ShutterProps) {
  const { reducedMotion } = useTheme();
  const press = useSharedValue(0);
  const focus = useFocusRing();
  const palette = useCapturePalette();
  const inert = disabled || busy;

  const diskStyle = useAnimatedStyle(() => ({
    transform: reducedMotion
      ? []
      : [{ translateY: press.get() * K.travel }, { scale: interpolate(press.get(), [0, 1], [1, ref.motion.shutterPress.scale]) }],
  }));
  const pressedStyle = useAnimatedStyle(() => ({ opacity: press.get() }));

  // The lever: at rest, and wound out and home again as a photo joins the roll.
  const arm = useSharedValue<number>(K.rest);
  const wound = useRef(wind);
  useEffect(() => {
    const before = wound.current;
    wound.current = wind;
    if (wind <= before || reducedMotion) return;
    arm.set(withSequence(withTiming(K.stroke, WIND_OUT), withTiming(K.rest, WIND_HOME)));
  }, [wind, reducedMotion, arm]);
  const leverStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${arm.get()}deg` }] }));

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
        <Animated.View pointerEvents="none" style={[styles.lever, leverStyle]} testID={testID ? `${testID}-lever` : undefined}>
          <Image source={ART.lever} style={StyleSheet.absoluteFill} accessible={false} />
        </Animated.View>
        <View pointerEvents="none" style={styles.ring} testID={testID ? `${testID}-ring` : undefined}>
          <Image source={ART.shutter} style={StyleSheet.absoluteFill} accessible={false} />
          <Animated.View style={[StyleSheet.absoluteFill, pressedStyle]} testID={testID ? `${testID}-down` : undefined}>
            <Image source={ART.shutterDown} style={StyleSheet.absoluteFill} accessible={false} />
          </Animated.View>
        </View>
        <Animated.View pointerEvents="none" style={[styles.disk, diskStyle]} testID={testID ? `${testID}-disk` : undefined}>
          {/* In a View, so it stacks above the absolute layers on the web too. */}
          <View style={styles.glass}>
            <MagnifyingGlassIcon size={B.iconFallback} color={palette.ink} weight={ICON_WEIGHT} testID={testID ? `${testID}-glass` : undefined} />
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
  // The release's picture, centred on the box (its collar is the box's own circle).
  ring: {
    position: "absolute",
    left: (B.ring - K.art) / 2,
    top: (B.ring - K.art) / 2,
    width: K.art,
    height: K.art,
  },
  // The lever's picture, centred on the release, under it.
  lever: {
    position: "absolute",
    left: (B.ring - K.lever) / 2,
    top: (B.ring - K.lever) / 2,
    width: K.lever,
    height: K.lever,
  },
  // The face: the glass's box, which sinks and scales with the press.
  disk: {
    width: B.disk,
    height: B.disk,
    borderRadius: ref.radius.round,
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
