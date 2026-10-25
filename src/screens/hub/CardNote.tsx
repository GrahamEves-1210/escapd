// The status note under a card's plate label (docs/DESIGN.md, 01 · Layout:
// Status note; States: Developing). Live `caption` in tone secondary, one line.
// While a case develops it is the kit's one-line warm Thinking state (the live
// `stamp` type, no rotation, the shimmer from textSecondary to text repeats);
// when the case flips, the shimmer stops and the new note shows at once (both
// rest in textSecondary, so there is no colour to ease).
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { ThinkingStates } from "@/components/noir";
import { Text } from "@/components/Text";

export interface CardNoteProps {
  /** Null while YOUR CASE loads: the line is kept, blank. */
  text: string | null;
  /** The case is developing: the note is the shimmering Thinking state. */
  developing: boolean;
  /** "center" in the fan; "left" in a stacked card. */
  align: "center" | "left";
  style?: StyleProp<ViewStyle>;
}

export function CardNote({ text, developing, align, style }: CardNoteProps) {
  if (text === null) {
    // A non-breaking space keeps the caption line (scaled with the text size) without showing anything.
    return (
      <Text variant="caption" accessible={false} style={style}>
        {" "}
      </Text>
    );
  }
  if (developing) {
    // Decorative: the card is one accessibility element and its label carries the status.
    return (
      <ThinkingStates lines={[text]} variant="note" tone="warm" decorative style={[style, align === "left" && styles.start]} />
    );
  }
  return (
    <Text variant="caption" tone="secondary" align={align} accessible={false} style={style}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  // In a stacked card the line sits at the start of the text column.
  start: { alignItems: "flex-start" },
});
