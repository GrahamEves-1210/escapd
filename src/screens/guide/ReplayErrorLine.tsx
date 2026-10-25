// Replay error (docs/DESIGN.md 04, States): Warning in color.warning (the
// error red is 2.3:1 on dark, so on this ground the icon is warning and the
// words carry the message), 8 pt, then the message in caption type and the
// secondary tone, in the y 724-742 slot.
//
// Built here rather than with the kit's NoticeLine because NoticeLine makes its
// row `accessible`, and on Android that also makes the row focusable
// (ReactViewManager.setAccessible sets isFocusable, which `focusable={false}`
// does not undo). The spec keeps keyboard and switch focus to Close -> button,
// so this row is not an accessibility element: screen readers read the text
// itself (an Android Text with no press handler is not focusable), the icon is
// hidden, and the words are announced (a polite live region on Android, an
// announcement on iOS).
import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { ICON_WEIGHT, WarningIcon } from "@/components/icons";
import { Text } from "@/components/Text";
import { color, ref, space, type as typeScale } from "@/theme/tokens";
import { COPY } from "./copy";

export interface ReplayErrorLineProps {
  testID?: string;
}

export function ReplayErrorLine({ testID }: ReplayErrorLineProps) {
  const { fontScale } = useWindowDimensions();

  useEffect(() => {
    // Android announces through the polite live region below.
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(COPY.checkError);
  }, []);

  return (
    <View testID={testID} accessibilityLiveRegion="polite" style={styles.row}>
      {/* Centred on the first line at any text size; the glyph itself stays 16. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.iconBox, { height: typeScale.caption.lineHeight * fontScale }]}
        testID={testID ? `${testID}-icon` : undefined}
      >
        <WarningIcon size={ref.layout.guide.errorIcon} color={color.warning} weight={ICON_WEIGHT} />
      </View>
      <Text variant="caption" tone="secondary" style={styles.text}>
        {COPY.checkError}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  iconBox: { justifyContent: "center" },
  text: { flexShrink: 1 },
});
