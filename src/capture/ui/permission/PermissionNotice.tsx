// 03 · Camera permission: the inline notice under the body (docs/DESIGN.md 03,
// Layout "Inline notice", States "Library partial", "Library error" and
// "Request error"). Progress: text in ref.color.meta. Error: Phosphor Warning
// at ref.icon.small in ref.color.error (an icon, never text), centred on the
// first line, ref.space.sm before the text in ref.color.read.
//
// Composed here instead of with the kit's NoticeLine, whose row is
// `accessible`: on Android that makes the row a keyboard and D-pad focus stop
// (ReactViewManager.setAccessible sets isFocusable), and 03's keyboard and
// switch focus never lands on text (back arrow, pill, quiet button(s) only).
// The row is not an accessibility element: screen readers read its text in
// place (after the body, before the pill), the icon is hidden, and a new
// message is spoken through the polite live region (Android) or an
// announcement (iOS), as the spec asks.
import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { WarningIcon } from "@/components/icons";
import { NoirText } from "@/components/noir";
import { ref } from "@/theme/tokens";

export interface PermissionNoticeProps {
  /** "error": the Warning icon and the text in read. "progress": no icon, the text in meta. */
  kind: "error" | "progress";
  text: string;
  testID?: string;
}

export function PermissionNotice({ kind, text, testID }: PermissionNoticeProps) {
  const { fontScale } = useWindowDimensions();

  useEffect(() => {
    // Android speaks the new text through the polite live region below.
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(text);
  }, [text]);

  const error = kind === "error";
  // The icon box is one text line tall at any text size, so the 16 pt glyph
  // stays centred on the first line.
  const firstLine = ref.type.meta.lineHeight * fontScale;

  return (
    <View testID={testID} accessible={false} accessibilityLiveRegion="polite" style={styles.row}>
      {error ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.iconBox, { height: firstLine }]}
          testID={testID ? `${testID}-icon` : undefined}
        >
          <WarningIcon size={ref.icon.small} color={ref.color.error} weight="regular" />
        </View>
      ) : null}
      <NoirText variant="meta" tone={error ? "read" : "meta"} align="left" style={styles.text}>
        {text}
      </NoirText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: ref.space.sm },
  iconBox: { justifyContent: "center" },
  // The message wraps in the column beside the icon; nothing shrinks.
  text: { flexShrink: 1 },
});
