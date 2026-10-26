// A slam: something heavy dropped onto the page (a rubber stamp; paranormal's
// "The presence is gone."). It falls from `from` times its size, overshoots
// to slam.overshoot as it hits and settles back to rest, its opacity up to
// full on the way down; at the impact its ink spreads (an outline of it grows
// to slam.inkTo and fades from slam.inkPeak) and `onLanded` runs, for the
// haptic and the screen's nudge. Under reduced motion it only fades in, over
// motion.reducedFade, and lands as the fade ends. All on the UI thread.
import { useEffect } from "react";
import { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { motion, ref } from "@/theme/tokens";

const S = ref.layout.play.stamp;
const L = ref.layout.play.complete.slam;

export function useSlam({ enabled, delay, from = S.slamFrom, reducedMotion, onLanded }: {
  /** False: at rest from the start (and onLanded never runs). */
  enabled: boolean;
  delay: number;
  from?: number;
  reducedMotion: boolean;
  onLanded?: () => void;
}) {
  const opacity = useSharedValue(enabled ? 0 : 1);
  const scale = useSharedValue(enabled && !reducedMotion ? from : 1);
  const inkScale = useSharedValue(1);
  const inkOpacity = useSharedValue(0);

  useEffect(() => {
    if (!enabled) return;
    const landed = () => onLanded?.();
    if (reducedMotion) {
      opacity.set(withDelay(delay, withTiming(1, { duration: motion.reducedFade }, (done) => {
        if (done) scheduleOnRN(landed);
      })));
      return;
    }
    opacity.set(withDelay(delay, withTiming(1, { duration: S.slam / 2 })));
    scale.set(withDelay(delay, withSequence(
      withTiming(L.overshoot, { duration: S.slam, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) scheduleOnRN(landed);
      }),
      withTiming(1, { duration: L.settle, easing: Easing.out(Easing.quad) }),
    )));
    inkOpacity.set(withDelay(delay + S.slam, withSequence(
      withTiming(L.inkPeak, { duration: 0 }),
      withTiming(0, { duration: L.ink, easing: Easing.out(Easing.quad) }),
    )));
    inkScale.set(withDelay(delay + S.slam, withTiming(L.inkTo, { duration: L.ink, easing: Easing.out(Easing.cubic) })));
    // Once, on mount: a slam lands once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const body = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }));
  const ink = useAnimatedStyle(() => ({ opacity: inkOpacity.get(), transform: [{ scale: inkScale.get() }] }));
  return { body, ink, opacity, scale };
}
