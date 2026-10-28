// Home's error notice when a mode card's tap can't go on (offline, or the server; docs/DESIGN.md, 01 · States: Error), in the
// chips' material: a capsule in ref.color.ground (the chips' fill) with a 1 pt rim
// (white 10 %), padding 8 x 16. Inside: a Phosphor glyph (WifiSlash offline,
// Warning otherwise) at 16 in textPrimary, centred on the first meta line,
// then sm 8 and the message in ref.type.meta, textPrimary. No colour: the
// reference has none but its line art.
// It fades in over motion.control (an opacity change, so it stays under
// reduced motion) and is announced: announceForAccessibility on iOS; on
// Android through the polite live region on the always-mounted slot that
// holds it (HubScreen), since Android speaks a live region when its content
// changes, not when a new one mounts.
// Mount a new one per failure (key it), so a repeat failure fades in and is
// announced again.
import { useEffect } from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ICON_WEIGHT, WarningIcon, WifiSlashIcon } from "@/components/icons";
import { controlTiming } from "@/components/noir";
import { ref } from "@/theme/tokens";
import { NOTICE_FAILED, NOTICE_OFFLINE } from "./caseStatus";
import { announce } from "@/lib/a11y";

const H = ref.layout.hub;
const T = ref.type.meta;

export function HubNotice({ offline }: { offline: boolean }) {
  const text = offline ? NOTICE_OFFLINE : NOTICE_FAILED;
  const Icon = offline ? WifiSlashIcon : WarningIcon;
  const { fontScale } = useWindowDimensions();

  const opacity = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  useEffect(() => {
    opacity.set(withTiming(1, controlTiming));
  }, [opacity]);

  useEffect(() => {
    // Android speaks it through the slot's polite live region.
    if (Platform.OS === "ios") announce(text);
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
      {/* One meta line tall at any text size, so the glyph stays centred on the first line. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.iconBox, { height: T.lineHeight * fontScale }]}
      >
        <Icon size={H.noticeIcon} color={ref.color.textPrimary} weight={ICON_WEIGHT} />
      </View>
      <Text style={[T, styles.text]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: ref.space.sm,
    paddingVertical: ref.space.sm,
    paddingHorizontal: ref.space.lg,
    backgroundColor: ref.color.ground,
    borderWidth: H.hairline,
    borderColor: ref.color.rim,
    borderRadius: ref.radius.round,
  },
  iconBox: { justifyContent: "center" },
  // The message wraps beside the icon; nothing shrinks.
  text: { flexShrink: 1, color: ref.color.textPrimary },
});
