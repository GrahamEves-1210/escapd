import { StyleSheet, Text } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { LightbulbIcon } from "@/components/icons";

const P = ref.layout.play;

/**
 * A tutorial coach mark: 07's card (raised, 8 corners) with a white
 * Lightbulb and the step in white Regular 14. It changes only after the
 * server confirms the step.
 */
export function CoachCard({ text }: { text: string }) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const d = reducedMotion ? motion.reducedFade : 240;
  return (
    <Animated.View
      key={text}
      entering={FadeIn.duration(d)}
      exiting={FadeOut.duration(d)}
      style={[styles.card, { backgroundColor: theme.raised }]}
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={`Tip: ${text}`}
      testID="coach-card"
    >
      <LightbulbIcon size={P.card.icon} weight="regular" color={theme.ink} />
      <Text style={[styles.text, { color: theme.ink }]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: P.card.gap,
    marginHorizontal: ref.space.edge,
    paddingHorizontal: P.card.pad,
    paddingVertical: P.card.padY,
    borderRadius: P.card.radius,
    ...ref.curve,
    backgroundColor: ref.color.raised,
  },
  text: { ...P.type.hint, flex: 1, color: ref.color.textPrimary },
});
