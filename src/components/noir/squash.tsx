// Press-in squash, the one physical answer every button gives
// (GAME_FEEL_PROMPT.md 1, "every tap answers back"): pressed in, the control
// sinks to ref.motion.juice.press.scale over a short ease-out; let go, it
// springs back. Scale only, driven by a shared value on the UI thread, so a
// press costs no React render per frame. Under reduced motion (the OS
// setting or the player's own, read from ThemeProvider) nothing scales; the
// caller's haptic and any pressed colour or opacity stay as they were.
import { useState, type Ref } from "react";
import { Pressable, type GestureResponderEvent, type HostInstance, type PressableProps } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { timingFor } from "./motion";

const J = ref.motion.juice.press;
const IN = timingFor(J.in);
// Our own reduced-motion check decides; Reanimated's system one never does.
const RELEASE = { ...J.release, reduceMotion: ReduceMotion.Never } as const;

/**
 * The squash as a hook, for a control that draws its own Animated view: put
 * `style` on it and call `onPressIn` / `onPressOut` from its press handlers.
 * `scale` is the pressed-in size (default ref.motion.juice.press.scale);
 * false turns the squash off.
 */
export function usePressSquash(scale: number | false = J.scale) {
  const { reducedMotion } = useTheme();
  const size = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: size.get() }] }));
  const onPressIn = () => {
    if (reducedMotion || scale === false) return;
    size.set(withTiming(scale, IN));
  };
  const onPressOut = () => {
    // Always home, even if reduced motion came on mid-press.
    size.set(withSpring(1, RELEASE));
  };
  return { style, onPressIn, onPressOut, scale: size };
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface SquashPressableProps extends PressableProps {
  /** The pressed-in scale; default ref.motion.juice.press.scale. false: no squash. */
  squash?: number | false;
  ref?: Ref<HostInstance>;
}

/**
 * A Pressable that squashes while pressed: a drop-in for `Pressable`. A
 * function `style` or `children` still gets `{ pressed }`, so a pressed
 * opacity or fill keeps working alongside the scale.
 */
export function SquashPressable({ squash, style, children, onPressIn, onPressOut, testOnly_pressed, ref: pressableRef, ...rest }: SquashPressableProps) {
  const press = usePressSquash(squash);
  const [down, setDown] = useState(false);
  // `hovered` for react-native-web's typing of the same callback (always false here).
  const state = { pressed: testOnly_pressed ?? down, hovered: false };
  const resolved = typeof style === "function" ? style(state) : style;
  return (
    <AnimatedPressable
      {...rest}
      ref={pressableRef}
      onPressIn={(e: GestureResponderEvent) => {
        setDown(true);
        press.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        setDown(false);
        press.onPressOut();
        onPressOut?.(e);
      }}
      style={[resolved, press.style]}
    >
      {typeof children === "function" ? children(state) : children}
    </AnimatedPressable>
  );
}
