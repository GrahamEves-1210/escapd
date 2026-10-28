// /pro's note row lines (05 · Layout "Note row", States "Error" and "Test
// purchases off"), in 03's small grey style on the dark sheet.
// - Error: a Phosphor glyph at ref.layout.pro.noticeIcon (16) in the sheet's
//   ink (as 03's PermissionNotice: no colour accent), centred on the first
//   meta line, ref.space.sm, then the message in ref.type.meta and the
//   sheet's muted ink, in sentence case. It fades in over the kit's
//   controlTiming and is announced: announceForAccessibility on iOS; on
//   Android, the polite live region on the always-mounted region that holds
//   it (ProScreen). The line itself is never a live region: Android sends a
//   live-region event only from an ancestor that is already one, so a line
//   that mounts as a live region is never spoken.
// - Info (test purchases off): the same text style with no glyph, fade or
//   announcement. It's information, not an error.
//
// One screen-reader element labelled by its text (`accessible` on iOS,
// screenReaderFocusable on Android), never a keyboard or switch stop.
import { useEffect } from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { controlTiming, type NoirIcon } from "@/components/noir";
import { ICON_WEIGHT } from "@/components/icons";
import { useCapturePalette } from "@/capture/ui/palette";
import { ref } from "@/theme/tokens";
import { announce } from "@/lib/a11y";

export type ProNoticeLineProps =
  | { kind: "error"; text: string; icon: NoirIcon; testID?: string }
  | { kind: "info"; text: string; testID?: string };

/** Mount a new one for each notice (key it), so every error fades in and is announced. */
export function ProNoticeLine(props: ProNoticeLineProps) {
  const { kind, text, testID } = props;
  const error = kind === "error";
  const Icon = props.kind === "error" ? props.icon : null;
  const { fontScale } = useWindowDimensions();
  const palette = useCapturePalette();

  // An opacity change, not movement, so it stays under reduced motion.
  const opacity = useSharedValue(error ? 0 : 1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  useEffect(() => {
    opacity.set(withTiming(1, controlTiming));
  }, [opacity]);

  useEffect(() => {
    // Android speaks it through the region's polite live region (see above).
    if (error && Platform.OS === "ios") announce(text);
  }, [error, text]);

  return (
    <Animated.View
      testID={testID}
      accessible={Platform.OS === "ios"}
      screenReaderFocusable
      accessibilityRole="text"
      accessibilityLabel={text}
      accessibilityLiveRegion="none"
      style={[styles.row, fadeStyle]}
    >
      {Icon ? (
        // One meta line tall at any text size, so the glyph stays centred on the first line.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.iconBox, { height: ref.type.meta.lineHeight * fontScale }]}
          testID={testID ? `${testID}-icon` : undefined}
        >
          <Icon size={ref.layout.pro.noticeIcon} color={palette.noticeGlyph} weight={ICON_WEIGHT} />
        </View>
      ) : null}
      <Text style={[ref.type.meta, styles.text, { color: palette.sheetMuted }]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: ref.space.sm },
  iconBox: { justifyContent: "center" },
  // The message wraps beside the glyph; nothing shrinks.
  text: { flexShrink: 1 },
});
