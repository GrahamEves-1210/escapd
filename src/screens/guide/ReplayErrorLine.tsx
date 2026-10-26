// Replay error (docs/DESIGN.md 04, States): Phosphor Warning in color.warning
// (an icon, never coloured text), ref.space.sm, then the message in
// ref.type.meta and ref.color.textSecondary, in the status slot above the
// button.
//
// The row is not an accessibility element: making it `accessible` would, on
// Android, also make it focusable (ReactViewManager.setAccessible sets
// isFocusable, which `focusable={false}` does not undo), and keyboard and
// switch focus stay Close -> button. Screen readers read the text itself (an
// Android Text with no press handler is not focusable), the icon is hidden,
// and the words are announced (a polite live region on Android, an
// announcement on iOS). Inside a mode the text is the mode's muted ink
// (src/capture/ui/palette.ts); the glyph stays the warning amber.
import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useCapturePalette } from "@/capture/ui/palette";
import { ICON_WEIGHT, WarningIcon } from "@/components/icons";
import { color, ref } from "@/theme/tokens";
import { COPY } from "./copy";

export function ReplayErrorLine({ testID }: { testID?: string }) {
  const { fontScale } = useWindowDimensions();
  const palette = useCapturePalette();

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
        testID={testID ? `${testID}-icon` : undefined}
      >
        <WarningIcon size={ref.layout.guide.errorIcon} color={color.warning} weight={ICON_WEIGHT} />
      </View>
      <Text style={[styles.text, { color: palette.inkMuted }]}>{COPY.checkError}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: ref.space.sm },
  iconBox: { justifyContent: "center" },
  text: { ...ref.type.meta, flexShrink: 1 },
});
