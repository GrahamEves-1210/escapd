import { StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { color, motion, radius, space } from "@/theme/tokens";
import { Text } from "@/components/Text";
import { ICON_WEIGHT, LightbulbIcon } from "@/components/icons";

/** A tutorial coach mark. It changes only after the server confirms the step. */
export function CoachCard({ text }: { text: string }) {
  const { reducedMotion } = useTheme();
  const d = reducedMotion ? motion.reducedFade : 240;
  return (
    <Animated.View
      key={text}
      entering={FadeIn.duration(d)}
      exiting={FadeOut.duration(d)}
      style={styles.card}
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={`Tip: ${text}`}
      testID="coach-card"
    >
      <LightbulbIcon size={18} weight={ICON_WEIGHT} color={color.ink} />
      <Text variant="caption" tone="ink" style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginHorizontal: space.gutter,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    backgroundColor: color.manila,
    borderLeftWidth: 2,
    borderLeftColor: color.accent,
  },
  text: { flex: 1 },
});
