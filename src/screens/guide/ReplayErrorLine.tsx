// Replay error (docs/DESIGN.md 04, States): Warning in the error colour, 8 pt,
// then the message in meta type and the read colour, in the y 724-742 slot.
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
import { WarningIcon } from "@/components/icons";
import { NoirText } from "@/components/noir";
import { ref } from "@/theme/tokens";
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
        style={[styles.iconBox, { height: ref.type.meta.lineHeight * fontScale }]}
      >
        <WarningIcon size={ref.icon.small} color={ref.color.error} weight="regular" />
      </View>
      <NoirText variant="meta" tone="read" style={styles.text}>
        {COPY.checkError}
      </NoirText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: ref.space.sm },
  iconBox: { justifyContent: "center" },
  text: { flexShrink: 1 },
});
