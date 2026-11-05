// Words as a typewriter struck them (src/play2/letters): each word's ink a
// little heavier or lighter (paper.ts, inkWords), and, with `slip`, one word
// first misspelled and struck through before it was typed again
// (strikeover). The reader hears only the text itself: the whole is one
// Text whose label is the text.
import type { StyleProp, TextStyle } from "react-native";
import { Text } from "react-native";
import { alpha } from "@/theme/payoff";
import { inkWords, strikeover } from "./paper";

export function Typed({ text, seed, color, style, slip = false, testID }: {
  text: string;
  seed: string;
  /** The ribbon's ink (a hex colour). */
  color: string;
  style: StyleProp<TextStyle>;
  slip?: boolean;
  testID?: string;
}) {
  const words = inkWords(text, seed);
  const typo = slip ? strikeover(text, seed) : null;
  return (
    <Text style={[style, { color }]} accessibilityLabel={text} testID={testID}>
      {words.map((w, i) => (
        <Text key={i} style={w.ink < 1 ? { color: alpha(color, w.ink) } : null}>
          {typo?.index === i ? (
            <Text style={{ textDecorationLine: "line-through", textDecorationColor: color, color: alpha(color, 0.8) }}>{`${typo.typo}`}</Text>
          ) : null}
          {typo?.index === i ? " " : null}
          {w.word}
        </Text>
      ))}
    </Text>
  );
}

