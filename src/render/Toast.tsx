import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref, z } from "@/theme/tokens";

const T = ref.layout.play.toast;

/**
 * Brief, neutral feedback ("Nothing happens."), as 02's privacy note: a
 * see-through void pill with white meta text, at the top of the photo area.
 * Announced politely.
 */
export function Toast({ text, onHide }: { text: string; onHide: () => void }) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(text);
    const t = setTimeout(onHide, motion.toast);
    return () => clearTimeout(t);
  }, [text, onHide]);
  const d = reducedMotion ? motion.reducedFade : 200;
  return (
    <Animated.View entering={FadeIn.duration(d)} exiting={FadeOut.duration(d)} style={styles.toast} pointerEvents="none" testID="toast">
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
