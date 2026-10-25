// THE STUDY's error notice (docs/DESIGN.md, 01 · States: Error). A panel as
// the case-closed stat panels are drawn: color.surface, a 1 pt brass hairline,
// radius.control, padding 12 x 16. Inside, as /play's failure banner: a
// Phosphor glyph (WifiSlash offline, Warning otherwise) at 18 in
// color.warning, centred on the first caption line, then space.sm and the
// message in `caption`, tone primary. Never error-coloured text: on the dark
// ground the error colour is under 3:1.
// It fades in over the kit's control timing (an opacity change, so it stays
// under reduced motion) and is announced: announceForAccessibility on iOS; on
// Android through the polite live region on the always-mounted slot that holds
// it (HubScreen), since Android speaks a live region when its content changes,
// not when a new one mounts.
// Mount a new one per failure (key it), so a repeat failure fades in and is
// announced again.
import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ICON_WEIGHT, WarningIcon, WifiSlashIcon } from "@/components/icons";
import { controlTiming } from "@/components/noir";
import { Text } from "@/components/Text";
import { color, curve, radius, ref, space, type } from "@/theme/tokens";
import { STUDY_FAILED, STUDY_OFFLINE } from "./caseStatus";

const H = ref.layout.hub;

export function HubNotice({ offline }: { offline: boolean }) {
  const text = offline ? STUDY_OFFLINE : STUDY_FAILED;
  const Icon = offline ? WifiSlashIcon : WarningIcon;
  const { fontScale } = useWindowDimensions();

  const opacity = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  useEffect(() => {
    opacity.set(withTiming(1, controlTiming));
  }, [opacity]);

  useEffect(() => {
    // Android speaks it through the slot's polite live region.
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(text);
  }, [text]);

  return (
    <Animated.View
      testID="hub-notice"
      // One element on iOS. On Android `accessible` would also make the panel a
      // keyboard and D-pad focus stop, so TalkBack groups it through
      // screenReaderFocusable there instead.
      accessible={Platform.OS === "ios"}
      screenReaderFocusable
      importantForAccessibility="yes"
      accessibilityLabel={text}
      style={[styles.panel, fadeStyle]}
    >
      {/* One caption line tall at any text size, so the glyph stays centred on the first line. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.iconBox, { height: type.caption.lineHeight * fontScale }]}
      >
        <Icon size={H.noticeIcon} color={color.warning} weight={ICON_WEIGHT} />
      </View>
      <Text variant="caption" style={styles.text}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: color.surface,
    borderWidth: H.hairline,
    borderColor: color.hairline,
    borderRadius: radius.control,
    ...curve,
  },
  iconBox: { justifyContent: "center" },
  // The message wraps beside the icon; nothing shrinks.
  text: { flexShrink: 1 },
});
