// Case closed's 1–3 rating (victory.ts, magnifierRating): three magnifying
// glasses in line art. The row comes in empty, in the mode's muted ink; each
// earned glass then fills one by one, in the mode's stamp colour (its accent
// as a colour that reads on the ground: crime scene's accent red is too dark
// to draw with), its lens tinted, popping from rating.pop to rest. Under
// reduced motion the earned ones are simply filled as the row fades in. The
// word "Observation" sits before the glasses on the same line, so the rating
// is one compact row. One element for screen readers: "Rating: 2 of 3 magnifiers".
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import type { ModeTheme } from "@/theme/tokens";
import { ref } from "@/theme/tokens";
import type { Rating } from "./victory";

const R = ref.layout.play.complete.rating;
const B = ref.layout.play.complete.beat;

/** One glass: a ring and its handle; `filled` tints the lens and adds a glint. */
export function MagnifierGlyph({ color, filled, size = R.size }: { color: string; filled: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx={13} cy={13} r={9} stroke={color} strokeWidth={R.stroke} fill={filled ? color : "none"} fillOpacity={filled ? R.lens : 0} />
      <Line x1={19.6} y1={19.6} x2={28} y2={28} stroke={color} strokeWidth={R.stroke * 1.6} strokeLinecap="round" />
      {filled ? <Path d="M8.6 11.2 A5 5 0 0 1 11.2 8.6" stroke={color} strokeWidth={R.stroke * 0.8} strokeLinecap="round" /> : null}
    </Svg>
  );
}

/** An earned glass filling in over its empty one, `delay` ms from now. */
function Fill({ color, delay, reduced, testID }: { color: string; delay: number; reduced: boolean; testID: string }) {
  const opacity = useSharedValue(reduced ? 1 : 0);
  const scale = useSharedValue(reduced ? 1 : R.pop);
  useEffect(() => {
    if (reduced) return;
    opacity.set(withDelay(delay, withTiming(1, { duration: B.magnifier * 0.6 })));
    scale.set(withDelay(delay, withTiming(1, { duration: B.magnifier, easing: Easing.out(Easing.back(2)) })));
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} testID={testID}>
      <MagnifierGlyph color={color} filled />
    </Animated.View>
  );
}

export function MagnifierRating({ rating, theme, delays, reduced, label = "Observation", testID }: {
  rating: Rating;
  /** The word before the glasses, in the mode's voice. */
  label?: string;
  theme: ModeTheme;
  /** When each earned glass fills, in ms from now (one per earned glass). */
  delays: number[];
  reduced: boolean;
  testID?: string;
}) {
  return (
    <View
      style={styles.rating}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Rating: ${rating} of 3 magnifiers`}
      testID={testID}
    >
      <Text style={[ref.type.meta, { color: theme.inkMuted }]}>{label}</Text>
      <View style={styles.row}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.slot}>
            <MagnifierGlyph color={theme.inkMuted} filled={false} />
            {i < rating ? (
              <Fill color={theme.stamp} delay={delays[i] ?? 0} reduced={reduced} testID={testID ? `${testID}-filled-${i}` : `filled-${i}`} />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rating: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: R.labelGap },
  row: { flexDirection: "row", gap: R.gap },
  slot: { width: R.size, height: R.size },
});
