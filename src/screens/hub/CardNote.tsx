// The state line under a card's tag pill (docs/DESIGN.md, 01 · Layout: State
// line; States: Developing). ref.type.meta (Regular 13/16) in
// ref.color.textSecondary, one line. While a case develops it is the kit's
// one-line thinking line in the same type (no rotation; the shimmer from
// textSecondary to textPrimary repeats); when the case flips, the shimmer
// stops and the new state shows at once (both rest in textSecondary).
import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { ThinkingStates } from "@/components/noir";
import { ref } from "@/theme/tokens";

const T = ref.type.meta;

export interface CardNoteProps {
  /** Null while YOUR CASE loads: the line is kept, blank. */
  text: string | null;
  /** The case is developing: the line is the shimmering thinking line. */
  developing: boolean;
  /** "center" in the fan; "left" in a stacked card. */
  align: "center" | "left";
  style?: StyleProp<ViewStyle>;
}

export function CardNote({ text, developing, align, style }: CardNoteProps) {
  if (text === null) {
    // A non-breaking space keeps the meta line (scaled with the text size) without showing anything.
    return (
      <Text accessible={false} style={[T, style]}>
        {" "}
      </Text>
    );
  }
  if (developing) {
    // Decorative: the card is one accessibility element and its label carries the status.
    return <ThinkingStates lines={[text]} variant="meta" decorative style={[style, align === "left" && styles.start]} />;
  }
  return (
    <Text accessible={false} style={[T, styles.text, { textAlign: align }, style]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { color: ref.color.textSecondary },
  // In a stacked card the line sits at the start of the text column.
  start: { alignItems: "flex-start" },
});
