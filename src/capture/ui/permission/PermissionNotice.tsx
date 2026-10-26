// 03 · Camera permission: the inline notice under the body (docs/DESIGN.md 03,
// Layout: Inline notice; States: Library partial, Library error, Request
// error), on the white sheet. ref.type.meta in ref.color.inkMuted, lowercase
// like the rest of the screen. Progress: the text alone. Error: a Phosphor
// Warning (ref.layout.permission.noticeIcon, the raised ink glyphs take on
// paper) centred on the first line, ref.space.sm before the same grey text.
// The reference has no colour accent, so neither does the notice.
//
// The row is not an accessibility element: on Android `accessible` makes a
// view a keyboard and D-pad focus stop, and 03's keyboard and switch focus
// never lands on text (the pill, then the quiet button(s)). Screen readers
// read its text in place (after the body, before the pill), the icon is
// hidden, and a new message is spoken through the polite live region
// (Android) or an announcement (iOS).
import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ICON_WEIGHT, WarningIcon } from "@/components/icons";
import { ref } from "@/theme/tokens";

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
  // The icon box is one meta line tall at any text size, so the glyph stays
  // centred on the first line.
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
          <WarningIcon size={ref.layout.permission.noticeIcon} color={ref.color.raised} weight={ICON_WEIGHT} />
        </View>
      ) : null}
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: ref.space.sm },
  iconBox: { justifyContent: "center" },
  // The message wraps in the column beside the icon; nothing shrinks.
  text: { ...ref.type.meta, color: ref.color.inkMuted, textTransform: "lowercase", flexShrink: 1 },
});
