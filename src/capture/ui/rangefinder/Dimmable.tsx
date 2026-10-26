// Opacity for 02's controls. Disabled is the whole control at
// ref.button.disabledOpacity.icon (0.4), eased over ref.motion.control: the
// shutter "returns to 1.0 over 120 ms" when the camera is ready, and busy dims
// and restores the library, flash, lens and thumbnail the same way. `appear`
// fades the child in from 0 on mount (the lens segment, once the lens list
// reports an ultra-wide). Opacity is not movement, so reduced motion keeps
// these timings.
import { useEffect, type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
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
    opacity: shown.get() * interpolate(dim.get(), [0, 1], [1, ref.button.disabledOpacity.icon]),
  }));
  return <Animated.View style={[animated, style]}>{children}</Animated.View>;
}
