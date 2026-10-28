// Paranormal's "the presence" (docs/DESIGN.md, Modes · Paranormal): a meter
// in the header, one segment per step. It reads like a spirit's strength:
//   - `wanes` (the v2 player, the default): it starts full, in the mode's
//     glow, and each step the player takes toward the ritual snuffs one out
//     (a flicker, then dark: an empty ring is left), down to none when the
//     door opens. "The presence: 4 of 6 left".
//   - otherwise (the v1 player): it lights one segment per anomaly found
//     (selectors.presence), "The presence: 2 of 5"; on case closed every
//     segment goes dark.
// Segments change over `rise` ms on the UI thread (reduced motion: a plain
// reducedFade). One element for screen readers, with the count as its value.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { presenceLabel, type Presence } from "@/game/selectors";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";

const M = ref.layout.play.presence;
/** Big enough to read at a glance: a segment's height, and its width between these, shared out over about `span` pt. */
const SEG = { height: 6, min: 8, max: 20, span: 120 };

export function PresenceMeter({ presence, gone = false, wanes = true }: { presence: Presence; gone?: boolean; wanes?: boolean }) {
  const theme = useModeTheme();
  const { total } = presence;
  // How many segments glow: what's left of it (waning), or what's been found.
  const lit = gone ? 0 : wanes ? Math.max(0, total - presence.found) : presence.found;
  const label = gone ? "The presence is gone" : wanes ? `The presence: ${lit} of ${total} left` : presenceLabel(presence);
  const width = Math.max(SEG.min, Math.min(SEG.max, Math.floor(SEG.span / Math.max(1, total)) - M.gap));
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityHint={wanes && !gone ? "It weakens with each step you take" : undefined}
      accessibilityValue={{ min: 0, max: total, now: lit }}
      testID="presence-meter"
    >
      <Text style={[styles.label, { color: theme.glow ?? theme.inkMuted }]} numberOfLines={1} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        The presence
      </Text>
      <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: total }, (_, i) => (
          <Segment key={i} lit={i < lit} width={width} hollow={wanes} testID={`presence-${i}${i < lit ? "-lit" : ""}`} />
        ))}
      </View>
    </View>
  );
}

/** One segment. `hollow`: dark, it's an empty ring (what was there); otherwise a dim bar. Going dark while hollow, it flickers out. */
function Segment({ lit, width, hollow, testID }: { lit: boolean; width: number; hollow: boolean; testID: string }) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const on = useSharedValue(lit ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) {
      on.set(withTiming(lit ? 1 : 0, { duration: motion.reducedFade }));
    } else if (!lit && hollow) {
      // A candle going out: a gutter, a last flare, gone.
      const t = M.rise / 6;
      on.set(withSequence(withTiming(0.35, { duration: t }), withTiming(0.9, { duration: t }), withTiming(0.2, { duration: t }), withTiming(0, { duration: t * 3 })));
    } else {
      on.set(withTiming(lit ? 1 : 0, { duration: M.rise }));
    }
  }, [lit, hollow, reducedMotion, on]);
  const fill = useAnimatedStyle(() => ({ opacity: on.get() }));
  const glow = theme.glow ?? theme.ink;
  return (
    <View style={[styles.segment, { width }, !hollow && { backgroundColor: theme.rim }]} testID={testID}>
      {/* What was there: a faint ring in the glow. */}
      {hollow ? <View style={[StyleSheet.absoluteFill, styles.ring, { borderColor: glow }]} /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: glow, shadowColor: glow }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: M.labelGap, minHeight: ref.type.meta.lineHeight },
  label: { ...ref.layout.play.type.presence },
  segments: { flexDirection: "row", alignItems: "center", gap: M.gap + 1 },
  segment: { height: SEG.height, borderRadius: ref.radius.round, ...ref.curve },
  ring: { borderWidth: 1, borderRadius: ref.radius.round, opacity: 0.4 },
  // A soft halo in the glow where the platform draws coloured shadows.
  fill: { borderRadius: ref.radius.round, shadowOpacity: M.halo.opacity, shadowRadius: M.halo.radius, shadowOffset: { width: 0, height: 0 } },
});
