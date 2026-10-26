// Paranormal's "the presence" (docs/DESIGN.md, Modes · Paranormal): a slim
// meter in the header, one segment per anomaly in the room, lit in the
// mode's glow as each is found (selectors.presence). A segment lights with
// an opacity fade on the UI thread; under reduced motion, reducedFade. On
// case closed every segment goes dark: the presence is gone. One element for
// screen readers, "The presence: 2 of 5", with the same count as its value.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { presenceLabel, type Presence } from "@/game/selectors";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";

const M = ref.layout.play.presence;

export function PresenceMeter({ presence, gone = false }: { presence: Presence; gone?: boolean }) {
  const theme = useModeTheme();
  const found = gone ? 0 : presence.found;
  const label = gone ? "The presence is gone" : presenceLabel(presence);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: presence.total, now: found }}
      testID="presence-meter"
    >
      <Text style={[styles.label, { color: theme.glow ?? theme.inkMuted }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        The presence
      </Text>
      <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: presence.total }, (_, i) => (
          <Segment key={i} lit={i < found} testID={`presence-${i}${i < found ? "-lit" : ""}`} />
        ))}
      </View>
    </View>
  );
}

function Segment({ lit, testID }: { lit: boolean; testID: string }) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const on = useSharedValue(lit ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(lit ? 1 : 0, { duration: reducedMotion ? motion.reducedFade : M.rise }));
  }, [lit, reducedMotion, on]);
  const fill = useAnimatedStyle(() => ({ opacity: on.get() }));
  return (
    <View style={[styles.segment, { backgroundColor: theme.rim }]} testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: theme.glow ?? theme.ink, shadowColor: theme.glow ?? theme.ink }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: M.labelGap, minHeight: ref.type.meta.lineHeight },
  label: { ...ref.layout.play.type.presence },
  segments: { flexDirection: "row", gap: M.gap },
  segment: { width: M.segment, height: M.height, borderRadius: ref.radius.round, ...ref.curve },
  // A soft halo in the glow where the platform draws coloured shadows.
  fill: { borderRadius: ref.radius.round, shadowOpacity: M.halo.opacity, shadowRadius: M.halo.radius, shadowOffset: { width: 0, height: 0 } },
});
