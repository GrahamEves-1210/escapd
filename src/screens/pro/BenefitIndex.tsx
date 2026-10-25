// The benefit index (docs/DESIGN.md, 05 · Layout): three rows ruled off by
// hairlines like a form. Each row is 16 + its sentence + 16, with a hidden
// mono numeral in the gutter and the sentence 32 in from it.
import { Fragment } from "react";
import { Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { NoirText, Rule } from "@/components/noir";
import { ref } from "@/theme/tokens";

const NUMERALS = ["01", "02", "03"] as const;
const GROUP_WITH_ACCESSIBLE = Platform.OS === "ios";

// Centres the numeral's 16 line box on the sentence's first 24 line (4 below
// its top at the default size); both scale with the system text size.
const NUMERAL_DROP = (ref.type.body.lineHeight - ref.type.label.lineHeight) / 2;

export interface BenefitIndexProps {
  /** The three sentences, in order. Each row is one accessibility element labelled by its sentence. */
  rows: readonly string[];
  style?: StyleProp<ViewStyle>;
}

export function BenefitIndex({ rows, style }: BenefitIndexProps) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={style}>
      <Rule />
      {rows.map((sentence, index) => (
        <Fragment key={NUMERALS[index] ?? sentence}>
          <View
            // One screen-reader element per row, never a keyboard or switch
            // stop: on Android `accessible` would also make the row keyboard
            // focusable, so it uses screenReaderFocusable there instead.
            accessible={GROUP_WITH_ACCESSIBLE}
            screenReaderFocusable
            accessibilityRole="text"
            accessibilityLabel={sentence}
            style={styles.row}
          >
            <View style={styles.numeralColumn}>
              <NoirText
                variant="label"
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ marginTop: NUMERAL_DROP * fontScale }}
              >
                {NUMERALS[index]}
              </NoirText>
            </View>
            <NoirText variant="body" style={styles.sentence}>
              {sentence}
            </NoirText>
          </View>
          <Rule />
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: ref.space.lg },
  // At least 32 (ref.space.xxl), so the sentence starts 32 in from the gutter.
  // With larger text the numeral pushes the sentence right and keeps a 16 gap
  // after its glyphs: the label's 1.2 tracking after the last glyph is part
  // of that gap.
  numeralColumn: { minWidth: ref.space.xxl, paddingRight: ref.space.lg - ref.type.label.letterSpacing },
  sentence: { flex: 1 },
});
