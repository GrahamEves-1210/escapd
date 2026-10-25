// Opacity for 02's controls. Disabled is the whole control at
// ref.button.disabledOpacity, and 02 eases into and out of it over
// ref.motion.control: the shutter, flash and grid "return to 1.0 over 120 ms"
// when the camera is ready, and busy dims and restores the rest the same way.
// `appear` fades the child in from 0 on mount (the lens segment, once the lens
// list reports an ultra-wide). Opacity is not movement, so reduced motion keeps
// these timings.
//
// The kit controls apply disabledOpacity instantly, so a kit control inside a
// Dimmable takes `style={undimmed}` (its own `disabled` still sets the state
// and blocks presses) and this wrapper does the dimming.
//
// A Dimmable is a real native view (Reanimated views never flatten), and
// native hit-testing (iOS Fabric and Android) drops touches outside a parent
// that nothing overflows. So a Dimmable around a 44 control whose hitSlop takes
// it to 48 takes `style={slopBox}`: it becomes that 48 box but keeps a 44
// footprint, so nothing it holds moves.
import { useEffect, type ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { controlTiming, useStateProgress } from "@/components/noir";
import { ref } from "@/theme/tokens";

export interface DimmableProps {
  dimmed: boolean;
  /** Fade in from 0 over ref.motion.control on mount. */
  appear?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Dimmable({ dimmed, appear = false, children, style }: DimmableProps) {
  const dim = useStateProgress(dimmed);
  const shown = useSharedValue(appear ? 0 : 1);
  useEffect(() => {
    shown.set(withTiming(1, controlTiming));
  }, [shown]);
  const animated = useAnimatedStyle(() => ({
    opacity: shown.get() * interpolate(dim.get(), [0, 1], [1, ref.button.disabledOpacity]),
  }));
  return <Animated.View style={[animated, style]}>{children}</Animated.View>;
}

/** The hit area past a 44 control on each side: 44 + 2 x 2 = 48, ref.hit.comfortable. */
export const SLOP = (ref.hit.comfortable - ref.hit.min) / 2;

const styles = StyleSheet.create({
  undimmed: { opacity: 1 },
  slopBox: { padding: SLOP, margin: -SLOP },
});

/** Cancels a kit control's own instant disabledOpacity; the Dimmable around it eases the dim instead. */
export const undimmed = styles.undimmed;

/** For a Dimmable around a 44 control with hitSlop 2: the wrapper is the 48 hit box, with a 44 footprint. */
export const slopBox = styles.slopBox;
