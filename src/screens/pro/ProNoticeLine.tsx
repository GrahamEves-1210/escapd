// /pro's notice line (docs/DESIGN.md, 05 · Layout "Notice slot", States
// "Error" and "Test purchases off").
// - Error: a Phosphor glyph at ref.layout.pro.noticeIcon (18) in
//   color.warning (an icon, never coloured text: on the dark ground the error
//   colour is under 3:1), centred on the first caption line, space.sm, then
//   the message in `caption`, tone secondary. It fades in over the kit's
//   controlTiming and is announced: announceForAccessibility on iOS; on
//   Android, the polite live region on the always-mounted slot that holds it
//   (ProScreen). The line itself is never a live region: Android sends a
//   live-region event only from an ancestor that is already one, so a line
//   that mounts as a live region is never spoken.
// - Info (test purchases off): the same text, with no icon, fade or
//   announcement. It's information, not an error.
//
// Composed here instead of with the kit's NoticeLine (Noir type and colours,
// and a row that is always `accessible`: on Android that makes it a keyboard
// and D-pad focus stop, and 05's keyboard and switch focus is only the action
// button, then "Not now"). Like a slip line it is still one screen-reader
// element labelled by its text: through `accessible` on iOS and
// screenReaderFocusable on Android.
import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { controlTiming, type NoirIcon } from "@/components/noir";
import { ICON_WEIGHT } from "@/components/icons";
import { Text } from "@/components/Text";
import { color, ref, space, type } from "@/theme/tokens";

export type ProNoticeLineProps =
  | { kind: "error"; text: string; icon: NoirIcon; testID?: string }
  | { kind: "info"; text: string; testID?: string };

/** Mount a new one for each notice (key it), so every error fades in and is announced. */
export function ProNoticeLine(props: ProNoticeLineProps) {
  const { kind, text, testID } = props;
  const error = kind === "error";
  const Icon = props.kind === "error" ? props.icon : null;
  const { fontScale } = useWindowDimensions();

  // An opacity change, not movement, so it stays under reduced motion.
  const opacity = useSharedValue(error ? 0 : 1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  useEffect(() => {
    opacity.set(withTiming(1, controlTiming));
  }, [opacity]);

  useEffect(() => {
    // Android speaks it through the slot's polite live region (see above).
    if (error && Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(text);
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
        // One caption line tall at any text size, so the glyph stays centred on the first line.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.iconBox, { height: type.caption.lineHeight * fontScale }]}
          testID={testID ? `${testID}-icon` : undefined}
        >
          <Icon size={ref.layout.pro.noticeIcon} color={color.warning} weight={ICON_WEIGHT} />
        </View>
      ) : null}
      <Text variant="caption" tone="secondary" align="left" style={styles.text}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  iconBox: { justifyContent: "center" },
  // The message wraps beside the icon; nothing shrinks.
  text: { flexShrink: 1 },
});
