// One layer of home's set (WindowBackdrop, HubScreen): whatever it holds
// slides with the phone's tilt by its depth. `depth` is the slide in points
// at full tilt (PARALLAX.depth): + for what lies behind the sill (it follows
// the eye), - for what's nearer than it (it goes the other way), 0 for the
// sill itself, which everything turns about. `turn` (degrees at full tilt)
// leans the nearest layers a touch as they slide. Never takes touches.
import type { ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { layerShift } from "./tilt";
import type { TiltValues } from "./useTilt";

export function ParallaxLayer({ tilt, depth, turn = 0, style, testID, children }: {
  tilt: TiltValues;
  depth: number;
  turn?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
}) {
  const slide = useParallax(tilt, depth, turn);
  return (
    <Animated.View style={[style, slide]} pointerEvents="none" testID={testID}>
      {children}
    </Animated.View>
  );
}

/** The slide alone, for a view that is already there (a card, the logo). `turn` adds to `base` degrees. */
export function useParallax(tilt: TiltValues, depth: number, turn = 0, base = 0) {
  return useAnimatedStyle(() => {
    const shift = layerShift({ x: tilt.x.get(), y: tilt.y.get() }, depth);
    const transform: ({ translateX: number } | { translateY: number } | { rotate: string })[] = [{ translateX: shift.x }, { translateY: shift.y }];
    if (turn !== 0 || base !== 0) transform.push({ rotate: `${base + tilt.x.get() * turn}deg` });
    return { transform };
  });
}
