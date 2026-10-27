import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { LightbulbIcon } from "@/components/icons";
import { useFadeIn } from "@/components/noir";

const P = ref.layout.play;

/**
 * A tutorial coach mark: 07's card (raised, 8 corners) with a white
 * Lightbulb and the step in white Regular 14. It changes only after the
 * server confirms the step, fading the new step in over the same card.
 *
 * No layout animations (no keyed swap with `entering`/`exiting`): the step
 * changes in the very commit that opens a solve's clue and fills the tray,
 * and that swap there is the likeliest cause of the iOS crash at the first
 * pickup ("the game crashed when I picked up the key"). The fade is a plain
 * opacity style.
 */
export function CoachCard({ text }: { text: string }) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const fade = useFadeIn(reducedMotion ? motion.reducedFade : 240, text);
  return (
    <Animated.View
      style={[styles.card, { backgroundColor: theme.raised }, fade]}
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
