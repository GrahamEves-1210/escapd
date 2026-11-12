// Turning to the next photo: an arrow in the house pen at the room's edge,
// cream over a soft dark copy so it reads on any photo (never an icon set's
// chevron). `lit`: something has come into view that way (on another photo):
// the arrow takes the mode's light and breathes, until she turns. That is the
// whole of the telling: no "something changed in the room".
import { useEffect } from "react";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { InkMark } from "./Ink";

export function TurnArrow({ dir, color = "#FFF6E6", lit = false }: { dir: 1 | -1; color?: string; lit?: boolean }) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const breath = useSharedValue(0);
  useEffect(() => {
    if (!lit || reducedMotion) {
      cancelAnimation(breath);
      breath.set(0);
      return;
    }
    breath.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(breath);
  }, [lit, reducedMotion, breath]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: dir * 5 * breath.get() }, { scale: 1 + 0.14 * breath.get() }] }));
  return (
    <Animated.View style={style} testID={lit ? "v2-turn-lit" : undefined}>
      <InkMark name={dir === 1 ? "right" : "left"} size={44} tone="chalk" color={lit ? theme.glow : color} weight={lit ? 3 : 2.6} />
    </Animated.View>
  );
}
