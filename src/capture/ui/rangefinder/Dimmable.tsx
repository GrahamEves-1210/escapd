// Opacity for 02's own controls: the shutter, the lens segment and the
// last-plate thumbnail. Disabled is the whole control at
// ref.button.disabledOpacity, and 02 eases into and out of it over
// ref.motion.control: the shutter "returns to 1.0 over 120 ms" when the camera
// is ready, and busy dims and restores the segment and the thumbnail the same
// way. `appear` fades the child in from 0 on mount (the lens segment, once the
// lens list reports an ultra-wide). Opacity is not movement, so reduced motion
// keeps these timings.
//
// The live IconButtons (back, library, flash, grid) dim themselves to the
// same 0.4, at once, as they do on every screen in the play screen's look.
import { useEffect, type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { controlTiming, useStateProgress } from "@/components/noir";
import { ref, space } from "@/theme/tokens";

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

/**
 * The live IconButton's hitSlop: 4 past its 48 circle on each side, a 56 box.
 * Native hit-testing (iOS Fabric and Android) drops touches outside a parent
 * that nothing overflows, so each row holding IconButtons carries SLOP inside
 * its own box (padding) and the gaps around it shrink by as much.
 */
export const SLOP = space.xs;
