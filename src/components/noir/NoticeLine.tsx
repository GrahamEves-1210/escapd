import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { WarningIcon } from "@/components/icons";
import { ref } from "@/theme/tokens";
import { controlTiming } from "./motion";
import { NoirText } from "./NoirText";
import type { NoirIcon } from "./types";

export interface NoticeLineProps {
  /** The words. A notice never relies on colour or an icon alone. */
  text: string;
  /**
   * "error" (default): icon in ref.color.error (an icon, never text), text in read.
   * "warning": icon and text in ref.color.warning.
   * "info": no icon; text in `infoTone`.
   */
  tone?: "error" | "warning" | "info";
  /** Phosphor icon at ref.icon.small. Default WarningIcon for error and warning (pass e.g. WifiSlashIcon for offline). */
  icon?: NoirIcon;
  /** Text style: "meta" (default) or "body" (01's notice panel). */
  variant?: "meta" | "body";
  /** Text colour for tone "info": "read" (default) or "meta" (03's progress notice). */
  infoTone?: "read" | "meta";
  /** Icon to text gap. Default ref.space.sm (8); 02's error line uses ref.space.xs. */
  gap?: number;
  /** "start" (default): left-aligned row. "center": the group is centred and its text lines are centred. */
  align?: "start" | "center";
  /** Polite live region on Android and announceForAccessibility on iOS, on appearing and on each new text. Default true. */
  announce?: boolean;
  /** Fades in over ref.motion.control on mount (an opacity change, so it stays under reduced motion). Default false. */
  fadeIn?: boolean;
  /**
   * Draws the notice in a ref.panel (fill, 1 pt hairline, radius 6) with 12
   * vertical and 16 horizontal padding: 01's error notice. The panel fades with
   * the text. Default false.
   */
  framed?: boolean;
  testID?: string;
  /** Layout only (position, margins, max width). */
  style?: StyleProp<ViewStyle>;
}

/**
 * An inline notice: a 16 pt icon centred on the first line, a gap, then the
 * message, which wraps (nothing shrinks). `framed` for 01's panel notice; bare
 * for 02-05's notice lines. The row is one accessibility element whose label
 * is the text.
 */
export function NoticeLine({
  text,
  tone = "error",
  icon,
  variant = "meta",
  infoTone = "read",
  gap = ref.space.sm,
  align = "start",
  announce = true,
  fadeIn = false,
  framed = false,
  testID,
  style,
}: NoticeLineProps) {
  const { fontScale } = useWindowDimensions();
  const opacity = useSharedValue(fadeIn ? 0 : 1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  useEffect(() => {
    opacity.set(withTiming(1, controlTiming));
  }, [opacity]);

  useEffect(() => {
    // Android announces through the polite live region below.
    if (announce && Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(text);
  }, [announce, text]);

  const Icon = tone === "info" ? null : (icon ?? WarningIcon);
  const iconColor = tone === "warning" ? ref.color.warning : ref.color.error;
  const textTone = tone === "warning" ? "warning" : tone === "info" ? infoTone : "read";
  // Centre the icon on the first line at any text size; the glyph itself stays 16.
  const firstLine = ref.type[variant].lineHeight * fontScale;

  return (
    <Animated.View
      testID={testID}
      // One element on iOS. On Android `accessible` would also make the row a
      // keyboard and D-pad focus stop (ReactViewManager.setAccessible sets
      // isFocusable; focusable={false} can't undo it), so TalkBack groups it
      // through screenReaderFocusable there instead.
      accessible={Platform.OS === "ios"}
      screenReaderFocusable
      importantForAccessibility="yes"
      accessibilityLabel={text}
      accessibilityLiveRegion={announce ? "polite" : "none"}
      style={[styles.row, { gap }, framed && styles.framed, align === "center" && styles.centered, fadeStyle, style]}
    >
      {Icon ? (
        <View style={[styles.iconBox, { height: firstLine }]}>
          <Icon size={ref.icon.small} color={iconColor} weight="regular" />
        </View>
      ) : null}
      <NoirText variant={variant} tone={textTone} align={align === "center" ? "center" : "left"} style={styles.text}>
        {text}
      </NoirText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  framed: {
    backgroundColor: ref.panel.fill,
    borderWidth: ref.panel.borderWidth,
    borderColor: ref.panel.border,
    borderRadius: ref.panel.radius,
    paddingVertical: ref.space.md,
    paddingHorizontal: ref.space.lg,
    ...ref.curve,
  },
  centered: { alignSelf: "center", justifyContent: "center" },
  iconBox: { justifyContent: "center" },
  text: { flexShrink: 1 },
});
