import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref, z } from "@/theme/tokens";

const T = ref.layout.play.toast;

/**
 * Brief, neutral feedback ("Nothing happens."), as 02's privacy note: a
 * see-through void pill with white meta text, at the top of the photo area.
 * Announced politely. It fades in, holds, fades out, then asks to be hidden;
 * a newer toast simply takes its place. Shared-value opacity only, no
 * `entering`/`exiting` layout animations (see InventoryBar: taps that bring
 * a toast can land while a pickup is in flight).
 */
export function Toast({ text, onHide }: { text: string; onHide: () => void }) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const d = reducedMotion ? motion.reducedFade : 200;
  const opacity = useSharedValue(0);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(text);
    const timing = { duration: d, reduceMotion: ReduceMotion.Never };
    opacity.set(withTiming(1, timing));
    const out = setTimeout(() => opacity.set(withTiming(0, timing)), Math.max(0, motion.toast - d));
    const t = setTimeout(onHide, motion.toast);
    return () => {
      clearTimeout(out);
      clearTimeout(t);
    };
    // Once per toast (its caller keys each one); a change of `d` mid-toast needn't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, onHide, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={[styles.toast, fade]} pointerEvents="none" testID="toast">
      <View style={styles.fill} />
      <Text style={[styles.text, { color: theme.ink }]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    top: T.top,
    zIndex: z.toast,
    maxWidth: T.maxWidth,
    paddingHorizontal: T.padX,
    paddingVertical: T.padY,
    borderRadius: ref.radius.round,
    ...ref.curve,
    overflow: "hidden",
  },
  fill: { ...StyleSheet.absoluteFill, backgroundColor: ref.color.void, opacity: T.fillOpacity },
  text: { ...ref.type.meta, color: ref.color.textPrimary, textAlign: "center" },
});
