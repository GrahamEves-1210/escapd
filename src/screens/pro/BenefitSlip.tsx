// The benefit slip (docs/DESIGN.md, 05 · Layout): a manila slip like the light
// table's "BEFORE YOU DEVELOP" one. A carbon-ink stamp heading, then three
// lines, each a hidden mono numeral and its sentence in body ink.
import { Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "@/components/Text";
import { color, curve, radius, space, type } from "@/theme/tokens";
import * as copy from "./copy";

const NUMERALS = ["01", "02", "03"] as const;
const GROUP_WITH_ACCESSIBLE = Platform.OS === "ios";

// Centres the numeral's 14 stamp line on the sentence's first 23 body line
// (4.5 below its top at the default size); both scale with the system text size.
const NUMERAL_DROP = (type.body.lineHeight - type.stamp.lineHeight) / 2;

export interface BenefitSlipProps {
  /** The three sentences, in order. Each line is one accessibility element labelled by its sentence. */
  rows: readonly string[];
  style?: StyleProp<ViewStyle>;
}

export function BenefitSlip({ rows, style }: BenefitSlipProps) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={[styles.slip, style]} testID="pro-slip">
      <Text variant="stamp" tone="ink" accessibilityLabel={copy.SLIP_HEADING_A11Y}>
        {copy.SLIP_HEADING}
      </Text>
      {rows.map((sentence, index) => (
        <View
          key={NUMERALS[index] ?? sentence}
          // One screen-reader element per line, never a keyboard or switch
          // stop: on Android `accessible` would also make the line keyboard
          // focusable, so it uses screenReaderFocusable there instead.
          accessible={GROUP_WITH_ACCESSIBLE}
          screenReaderFocusable
          accessibilityRole="text"
          accessibilityLabel={sentence}
          style={styles.row}
        >
          <View style={styles.numeralColumn}>
            <Text
              variant="stamp"
              tone="ink"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ marginTop: NUMERAL_DROP * fontScale }}
            >
              {NUMERALS[index]}
            </Text>
          </View>
          <Text variant="body" tone="ink" style={styles.sentence}>
            {sentence}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The light table's slip exactly: manila, 8 continuous corners, 16 in, 4 between lines.
  slip: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.slip,
    ...curve,
    backgroundColor: color.manila,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  // At least 24 (space.xl), so the sentence starts 24 in from the slip's
  // padding. With larger text the numeral pushes the sentence right and keeps
  // an 8 gap after its glyphs.
  numeralColumn: { minWidth: space.xl, paddingRight: space.sm },
  sentence: { flex: 1 },
});
