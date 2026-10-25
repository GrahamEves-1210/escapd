import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { color, motion, radius, space, z } from "@/theme/tokens";
import { Text } from "@/components/Text";

/** Brief, neutral feedback ("Nothing happens."). Announced politely. */
export function Toast({ text, onHide }: { text: string; onHide: () => void }) {
  const { reducedMotion } = useTheme();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(text);
    const t = setTimeout(onHide, motion.toast);
    return () => clearTimeout(t);
  }, [text, onHide]);
  const d = reducedMotion ? motion.reducedFade : 200;
  return (
    <Animated.View entering={FadeIn.duration(d)} exiting={FadeOut.duration(d)} style={styles.toast} pointerEvents="none">
      <Text variant="control" align="center">{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    top: space.md,
    zIndex: z.toast,
    maxWidth: "86%",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.round,
    backgroundColor: color.photoScrim,
    borderWidth: 1,
    borderColor: color.hairline,
  },
});
