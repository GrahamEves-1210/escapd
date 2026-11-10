// Anything tappable in the game's frame: it gives under the finger (a small
// scale and a point of travel, sprung back) with a light haptic and the
// press sound, so a brass tab or a book feels like a thing. Reduced motion:
// no movement, the feedback stays.
import { type ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useFeedback } from "@/game/feedback";
import { useTheme } from "@/theme/ThemeProvider";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PRESS = { scale: 0.93, travel: 1.5, inMs: 70, spring: { mass: 0.5, damping: 11, stiffness: 380 } } as const;

export function Press({ children, style, onPress, cue = "press", scale = PRESS.scale, ...rest }: Omit<PressableProps, "style" | "children"> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** What the press feels like: "press" (a light knock and its sound), "tick" (a selection tick), "none" (the caller gives its own). */
  cue?: "press" | "tick" | "none";
  scale?: number;
}) {
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const down = useSharedValue(0);
  const give = useAnimatedStyle(() => ({ transform: [{ translateY: down.get() * PRESS.travel }, { scale: 1 - down.get() * (1 - scale) }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (!reducedMotion) down.set(withTiming(1, { duration: PRESS.inMs }));
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reducedMotion) down.set(withSpring(0, PRESS.spring));
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (cue === "press") feedback.press();
        else if (cue === "tick") feedback.tick();
        onPress?.(e);
      }}
      style={[style, give]}
    >
      {children}
    </AnimatedPressable>
  );
}
