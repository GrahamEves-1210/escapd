// /pro's notice line (docs/DESIGN.md, 05 · Layout "Notice slot", States
// "Error" and "Test purchases off").
// - Error: a Phosphor icon at ref.icon.small in ref.color.error (an icon,
//   never text), centred on the first meta line, ref.space.sm, then the
//   message in ref.type.meta and ref.color.read. It fades in over
//   ref.motion.control and is announced: announceForAccessibility on iOS; on
//   Android, the polite live region on the always-mounted slot that holds it
//   (ProScreen). The line itself is never a live region: Android sends a
//   live-region event only from an ancestor that is already one, so a line
//   that mounts as a live region is never spoken.
// - Info (test purchases off): the same text, with no icon, fade or
//   announcement. It's information, not an error.
//
// Composed here instead of with the kit's NoticeLine, whose row is always
// `accessible`: on Android that makes it a keyboard and D-pad focus stop
// (ReactViewManager.setAccessible sets isFocusable), and 05's keyboard and
// switch focus is only the action pill, then "Not now". Like a benefit row it
// is still one screen-reader element labelled by its text: through
// `accessible` on iOS and screenReaderFocusable on Android.
import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { NoirText, controlTiming, type NoirIcon } from "@/components/noir";
import { ref } from "@/theme/tokens";

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
        // One meta line tall at any text size, so the 16 pt glyph stays centred on the first line.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.iconBox, { height: ref.type.meta.lineHeight * fontScale }]}
        >
          <Icon size={ref.icon.small} color={ref.color.error} weight="regular" />
        </View>
      ) : null}
      <NoirText variant="meta" tone="read" align="left" style={styles.text}>
        {text}
      </NoirText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: ref.space.sm },
  iconBox: { justifyContent: "center" },
  // The message wraps beside the icon; nothing shrinks.
  text: { flexShrink: 1 },
});
