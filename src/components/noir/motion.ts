// Motion helpers for Noir controls. Every duration and curve comes from
// ref.motion in src/theme/tokens.ts; nothing here invents a value.
import { useEffect } from "react";
import {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  SlideInDown,
  SlideOutDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
  type WithTimingConfig,
} from "react-native-reanimated";
import { motion, ref } from "@/theme/tokens";

/** The easing names and bezier tuples used in ref.motion. */
export type EasingToken = "linear" | "ease-out" | "ease-in-out" | readonly [number, number, number, number];

/**
 * Maps a token's easing to Reanimated. "ease-out" is `Easing.out(Easing.ease)`,
 * which equals CSS ease-out (DESIGN.md, Buttons and controls). "ease-in-out" is
 * `Easing.inOut(Easing.ease)`, the curve Thinking states specifies (and the
 * "close match" it names for the dither). Tuples become `Easing.bezier`.
 */
export function toEasing(token: EasingToken): NonNullable<WithTimingConfig["easing"]> {
  if (typeof token !== "string") return Easing.bezier(token[0], token[1], token[2], token[3]);
  switch (token) {
    case "linear":
      return Easing.linear;
    case "ease-out":
      return Easing.out(Easing.ease);
    case "ease-in-out":
      return Easing.inOut(Easing.ease);
  }
}

/**
 * A `withTiming` config for a `{ duration, easing }` token. Reduced motion is
 * decided by ThemeProvider (OS setting or the player's own), never by
 * Reanimated's system check, so colour and opacity changes keep their timing.
 */
export function timingFor(token: { duration: number; easing: EasingToken }): WithTimingConfig {
  return { duration: token.duration, easing: toEasing(token.easing), reduceMotion: ReduceMotion.Never };
}

/** ref.motion.control: 120 ms ease-out. Every press and state colour change. */
export const controlTiming = timingFor(ref.motion.control);

/** ref.motion.sheetRise: a bottom sheet sliding up, a long ease-out with no overshoot. For sheets driven by a shared value. */
export const sheetRiseTiming = timingFor(ref.motion.sheetRise);

/** A bottom sheet's `entering`: it slides up on ref.motion.sheetRise; under reduced motion it fades in. */
export function sheetEntering(reducedMotion: boolean) {
  return reducedMotion
    ? FadeIn.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never)
    : SlideInDown.duration(ref.motion.sheetRise.duration).easing(toEasing(ref.motion.sheetRise.easing)).reduceMotion(ReduceMotion.Never);
}

/** A bottom sheet's `exiting`: it slides away on ref.motion.sheetFall; under reduced motion it fades out. */
export function sheetExiting(reducedMotion: boolean) {
  return reducedMotion
    ? FadeOut.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never)
    : SlideOutDown.duration(ref.motion.sheetFall.duration).easing(toEasing(ref.motion.sheetFall.easing)).reduceMotion(ReduceMotion.Never);
}

/**
 * Press feedback shared by every Noir control: a 0 to 1 value that follows
 * press-in and press-out over ref.motion.control. Blend colours with
 * `interpolateColor(progress.get(), [0, 1], [rest, pressed])`.
 */
export function usePressProgress() {
  const progress = useSharedValue(0);
  const onPressIn = () => progress.set(withTiming(1, controlTiming));
  const onPressOut = () => progress.set(withTiming(0, controlTiming));
  return { progress, onPressIn, onPressOut };
}

/**
 * A 0 to 1 value that eases toward `on` over ref.motion.control whenever it
 * changes: toggles, segment selection, a variant change. Colour and opacity
 * only, so it runs the same under reduced motion.
 */
export function useStateProgress(on: boolean): SharedValue<number> {
  const progress = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(on ? 1 : 0, controlTiming));
  }, [on, progress]);
  return progress;
}

/**
 * A fade in over `duration` ms on mount, and again whenever `key` changes:
 * an opacity style driven by a shared value. Use it instead of a Reanimated
 * `entering`/`exiting` layout animation on anything in the play screen's
 * tray, coach card or toast: layout animations there ran in the same commit
 * as a clue's sheet, a newly mounted tray and a swapped coach card, the
 * likeliest cause of the iOS crash at the first pickup (Fabric, Reanimated's
 * layout animation proxy). A plain style animation never changes the view tree.
 */
export function useFadeIn(duration: number, key?: unknown) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(0);
    opacity.set(withTiming(1, { duration, reduceMotion: ReduceMotion.Never }));
    // Re-run on a new key only; a duration change (reduced motion toggled) needn't fade again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, opacity]);
  return useAnimatedStyle(() => ({ opacity: opacity.get() }));
}

type Palette<K extends string> = Readonly<Record<K, string>>;

function samePalette<K extends string>(a: Palette<K>, b: Palette<K>): boolean {
  return (Object.keys(b) as K[]).every((key) => a[key] === b[key]);
}

/**
 * Colour set that cross-fades over ref.motion.control when `palette` changes
 * (for example a step button turning from primary to signal). Pass a stable
 * object (a module-level constant per variant). Read a colour in a worklet with
 * `paletteColor(transition, key)`.
 */
export function usePaletteTransition<K extends string>(palette: Palette<K>) {
  const from = useSharedValue<Palette<K>>(palette);
  const to = useSharedValue<Palette<K>>(palette);
  const mix = useSharedValue(1);
  useEffect(() => {
    // Compared by value: a JS-side read of a shared object can be a copy.
    const target = to.get();
    if (samePalette(target, palette)) return;
    const m = mix.get();
    const start = from.get();
    const current = {} as Record<K, string>;
    for (const key of Object.keys(palette) as K[]) {
      current[key] = String(interpolateColor(m, [0, 1], [start[key], target[key]]));
    }
    from.set(current);
    to.set(palette);
    mix.set(0);
    mix.set(withTiming(1, controlTiming));
  }, [palette, from, to, mix]);
  return { from, to, mix };
}

export type PaletteTransition<K extends string> = ReturnType<typeof usePaletteTransition<K>>;

/** Worklet: the current colour for `key` in a palette transition. */
export function paletteColor<K extends string>(t: PaletteTransition<K>, key: NoInfer<K>): string {
  "worklet";
  return interpolateColor(t.mix.get(), [0, 1], [t.from.get()[key], t.to.get()[key]]);
}
