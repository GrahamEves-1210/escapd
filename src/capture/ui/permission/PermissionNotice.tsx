// 03 · Camera permission: the inline notice under the body (docs/DESIGN.md 03,
// Layout "Inline notice", States "Library partial", "Library error" and
// "Request error"), in the play screen's notice style (as Pro's and /play's
// failure banner). Progress: the text alone in `caption`, tone secondary.
// Error: a Phosphor Warning at ref.layout.permission.noticeIcon (18) in
// color.warning (an icon, never coloured text: on dark grounds the error
// colour is under 3:1), centred on the first caption line, space.sm before
// the same secondary text.
//
// Composed here instead of with the kit's NoticeLine, whose row is
// `accessible`: on Android that makes the row a keyboard and D-pad focus stop
// (ReactViewManager.setAccessible sets isFocusable), and 03's keyboard and
// switch focus never lands on text (back, primary, quiet button(s) only).
// The row is not an accessibility element: screen readers read its text in
// place (after the body, before the primary button), the icon is hidden, and
// a new message is spoken through the polite live region (Android) or an
// announcement (iOS).
import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { ICON_WEIGHT, WarningIcon } from "@/components/icons";
import { Text } from "@/components/Text";
import { color, ref, space, type } from "@/theme/tokens";

export interface PermissionNoticeProps {
  /** "error": the Warning icon, then the text. "progress": the text alone. */
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
  // The icon box is one caption line tall at any text size, so the glyph
  // stays centred on the first line.
  const firstLine = type.caption.lineHeight * fontScale;

  return (
    <View testID={testID} accessible={false} accessibilityLiveRegion="polite" style={styles.row}>
      {error ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.iconBox, { height: firstLine }]}
          testID={testID ? `${testID}-icon` : undefined}
        >
          <WarningIcon size={ref.layout.permission.noticeIcon} color={color.warning} weight={ICON_WEIGHT} />
        </View>
      ) : null}
      <Text variant="caption" tone="secondary" align="left" style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  iconBox: { justifyContent: "center" },
  // The message wraps in the column beside the icon; nothing shrinks.
  text: { flexShrink: 1 },
});
