// Case closed's 1–3 rating (victory.ts, magnifierRating). Noir and crime
// scene earn magnifying glasses in brass (the heirloom the art direction keeps
// in every mode); paranormal's "Second sight" earns moons in the mode's glow.
// The row comes in empty, in the mode's muted ink; each earned mark then fills
// one by one, popping from rating.pop to rest with a sparkle. Under reduced
// motion the earned ones are simply filled as the row fades in. The word
// ("Observation", "Second sight") is handwritten before the marks on the same
// line, so the rating is one compact row. One element for screen readers:
// "Rating: 2 of 3 magnifiers" (paranormal: moons).
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import type { ModeTheme } from "@/theme/tokens";
import { ref } from "@/theme/tokens";
import { handType } from "@/theme/payoff";
import { MoonMark } from "./keepsake";
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

export type RatingMark = "magnifier" | "moon";

function Mark({ mark, color, filled, size }: { mark: RatingMark; color: string; filled: boolean; size: number }) {
  return mark === "moon" ? <MoonMark size={size} color={color} filled={filled} /> : <MagnifierGlyph color={color} filled={filled} size={size} />;
}

/** An earned mark filling in over its empty one, `delay` ms from now. */
function Fill({ mark, color, size, delay, reduced, testID }: { mark: RatingMark; color: string; size: number; delay: number; reduced: boolean; testID: string }) {
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
      <Mark mark={mark} color={color} filled size={size} />
    </Animated.View>
  );
}

export function MagnifierRating({ rating, theme, delays, reduced, label = "Observation", mark = "magnifier", color, emptyColor, labelColor, size = R.size, testID }: {
  rating: Rating;
  /** The word before the marks, in the mode's voice. */
  label?: string;
  theme: ModeTheme;
  /** When each earned mark fills, in ms from now (one per earned mark). */
  delays: number[];
  reduced: boolean;
  /** Magnifying glasses (noir, crime scene) or moons (paranormal). */
  mark?: RatingMark;
  /** The earned marks' colour: brass for glasses, the mode's glow for moons. Default the mode's stamp colour. */
  color?: string;
  /** The empty marks and the word (default the mode's muted ink: on paper, the page's). */
  emptyColor?: string;
  labelColor?: string;
  size?: number;
  testID?: string;
}) {
  const noun = mark === "moon" ? "moons" : "magnifiers";
  return (
    <View
      style={styles.rating}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Rating: ${rating} of 3 ${noun}`}
      testID={testID}
    >
      <Text style={[handType(18, 24), { color: labelColor ?? theme.inkMuted }]}>{label}</Text>
      <View style={styles.row}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: size, height: size }}>
            <Mark mark={mark} color={emptyColor ?? theme.inkMuted} filled={false} size={size} />
            {i < rating ? (
              <Fill
                mark={mark}
                color={color ?? theme.stamp}
                size={size}
                delay={delays[i] ?? 0}
                reduced={reduced}
                testID={testID ? `${testID}-filled-${i}` : `filled-${i}`}
              />
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
});
