// The mono state note under a card's tag (docs/DESIGN.md, 01 Layout: State
// note; States: Developing). ref.type.note in read, one 18 pt line. While a
// case develops it is the kit's one-line Thinking state (no rotation, the
// shimmer repeats); when the case flips, the shimmer stops and the new note
// eases from the shimmer's meta to read over ref.motion.control.
import { useEffect } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { NoirText, ThinkingStates, controlTiming, trackingPad } from "@/components/noir";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";

export interface CardNoteProps {
  /** Null while YOUR CASE loads: the line is kept, blank. */
  text: string | null;
  /** The case is developing: the note is the shimmering Thinking state. */
  developing: boolean;
  /** This note replaces a shimmer that just stopped (a flip seen on the hub): ease its colour in. */
  fromShimmer: boolean;
  /** "center" in the fan (the iOS trailing tracking is padded back); "left" in a stacked card. */
  align: "center" | "left";
  style?: StyleProp<ViewStyle>;
}

export function CardNote({ text, developing, fromShimmer, align, style }: CardNoteProps) {
  if (text === null) {
    // A non-breaking space keeps the 18 pt line (scaled with the text size) without showing anything.
    return (
      <NoirText variant="note" style={style} accessible={false}>
        {" "}
      </NoirText>
    );
  }
  if (developing) {
    // Decorative: the card is one accessibility element and its label carries the status.
    return <ThinkingStates lines={[text]} variant="note" decorative style={[style, align === "left" && styles.start]} />;
  }
  return <StaticNote text={text} fromShimmer={fromShimmer} align={align} style={style} />;
}

function StaticNote({ text, fromShimmer, align, style }: { text: string; fromShimmer: boolean; align: "center" | "left"; style?: StyleProp<ViewStyle> }) {
  const { reducedMotion } = useTheme();
  // Under reduced motion the developing line was already static read, so there is nothing to ease.
  const tone = useSharedValue(fromShimmer && !reducedMotion ? 0 : 1);
  useEffect(() => {
    tone.set(withTiming(1, controlTiming));
  }, [tone]);
  const colorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(tone.get(), [0, 1], [ref.motion.thinking.shimmer.base, ref.color.read]),
  }));
  return (
    <Animated.Text
      accessible={false}
      style={[ref.type.note, align === "center" ? [styles.center, trackingPad(ref.type.note)] : null, colorStyle, style]}
    >
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  // In a stacked card the line sits at the start of the text column.
  start: { alignItems: "flex-start" },
});
