// Step changes (docs/DESIGN.md 04, States: Transition and Reduced motion).
// The art, stamp, title and body crossfade over motion.sceneCrossfade, with no
// drift and no counter roll; under reduced motion it is a motion.reducedFade
// opacity change. The pool, Close and the button stay still. Taps during the
// transition are ignored.
//
// One shared clock drives every layer: the n-th step change runs it from n - 1
// to n. A layer that came in at change e shows clamp(clock - (e - 1)), and one
// going out at change l shows 1 - clamp(clock - (l - 1)). So nothing blinks
// while React swaps a layer's role, and one callback marks the end.
import { useCallback, useRef, useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

export interface StepLayer {
  step: number;
  /** The step change that brought it in (0 for the first step). */
  enteredAt: number;
  /** The step change taking it out, while it fades; null for the current step. */
  leftAt: number | null;
}

export interface StepperState {
  current: StepLayer;
  leaving: StepLayer | null;
  /** Step changes so far. */
  changes: number;
}

const INITIAL: StepperState = { current: { step: 0, enteredAt: 0, leftAt: null }, leaving: null, changes: 0 };

/**
 * The guide's step state. `goTo` starts a crossfade of `duration` ms and
 * returns false (doing nothing) while one is running, or for a step outside
 * 0..count - 1. `state.leaving` is null again once the crossfade ends.
 */
export function useStepper(count: number, duration: number) {
  const [state, setState] = useState<StepperState>(INITIAL);
  // The same state for event handlers, which must not wait for a render.
  const live = useRef<StepperState>(INITIAL);
  const moving = useRef(false);
  const clock = useSharedValue(0);

  const settle = useCallback(
    (changes: number) => {
      if (live.current.changes !== changes) return;
      // Pins the end state even if the fade was cut short.
      clock.set(changes);
      moving.current = false;
      const next = { ...live.current, leaving: null };
      live.current = next;
      setState(next);
    },
    [clock],
  );

  const goTo = useCallback(
    (step: number): boolean => {
      const now = live.current;
      if (moving.current || step < 0 || step >= count || step === now.current.step) return false;
      moving.current = true;
      const changes = now.changes + 1;
      const next: StepperState = {
        current: { step, enteredAt: changes, leftAt: null },
        leaving: { ...now.current, leftAt: changes },
        changes,
      };
      live.current = next;
      setState(next);
      // ThemeProvider decides reduced motion (the caller passes reducedFade),
      // so Reanimated's own system check must not skip the fade.
      clock.set(
        withTiming(changes, { duration, reduceMotion: ReduceMotion.Never }, () => {
          "worklet";
          scheduleOnRN(settle, changes);
        }),
      );
      return true;
    },
    [clock, count, duration, settle],
  );

  /** True while a crossfade runs. For event handlers only. */
  const isMoving = useCallback(() => moving.current, []);
  /** The step on screen (or arriving). For event handlers only. */
  const currentStep = useCallback(() => live.current.current.step, []);

  return { state, clock, goTo, isMoving, currentStep };
}

/** The leaving layer first (underneath), then the current one. */
export function layersOf(state: StepperState): StepLayer[] {
  return state.leaving ? [state.leaving, state.current] : [state.current];
}

function clamp01(value: number): number {
  "worklet";
  return Math.min(Math.max(value, 0), 1);
}

function layerOpacity(clock: number, enteredAt: number, leftAt: number | null): number {
  "worklet";
  return leftAt === null ? clamp01(clock - (enteredAt - 1)) : 1 - clamp01(clock - (leftAt - 1));
}

/**
 * One step's copy of a crossfading region. A leaving layer takes no touches
 * and is hidden from screen readers while it fades.
 */
export function FadeLayer({
  clock,
  layer,
  style,
  children,
}: {
  clock: SharedValue<number>;
  layer: StepLayer;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { enteredAt, leftAt } = layer;
  const fade = useAnimatedStyle(() => ({ opacity: layerOpacity(clock.get(), enteredAt, leftAt) }));
  const leaving = leftAt !== null;
  return (
    <Animated.View
      pointerEvents={leaving ? "none" : "box-none"}
      accessibilityElementsHidden={leaving}
      importantForAccessibility={leaving ? "no-hide-descendants" : "auto"}
      style={[style, fade]}
    >
      {children}
    </Animated.View>
  );
}
