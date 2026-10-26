import { useEffect, useRef, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { color, curve, motion, ref, space, z } from "@/theme/tokens";
import { Grain } from "./Grain";
import { sheetEntering, sheetExiting } from "./noir/motion";
import { IconButton } from "./IconButton";
import { ICON_SIZE, ICON_WEIGHT, XIcon } from "./icons";
import { Text, type TextRef } from "./Text";

export interface SheetProps {
  title: string;
  /** Playfair for narrative reveals, Jakarta for utility sheets. */
  titleStyle?: "narrative" | "utility";
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Dim the scene behind. Inspection sheets keep it light so the object stays visible. */
  scrim?: boolean;
  /** Compartment ground colour. Defaults to the walnut drawer. */
  ground?: string;
  maxHeight?: `${number}%`;
  testID?: string;
}

/**
 * Bottom sheet. Render it conditionally; it animates in on mount and out on
 * unmount. Accessibility focus moves to its title when it opens.
 */
export function Sheet({ title, titleStyle = "narrative", eyebrow, onClose, children, footer, scrim = true, ground, maxHeight = "64%", testID }: SheetProps) {
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const titleRef = useRef<TextRef>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
    }, reducedMotion ? 50 : 300);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  const entering = sheetEntering(reducedMotion);
  const exiting = sheetExiting(reducedMotion);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: z.sheet }]} pointerEvents="box-none">
      <Animated.View
        entering={FadeIn.duration(reducedMotion ? motion.reducedFade : 200)}
        exiting={FadeOut.duration(reducedMotion ? motion.reducedFade : 160)}
        style={[StyleSheet.absoluteFill, scrim && { backgroundColor: color.sheetScrim }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />
      </Animated.View>
      <Animated.View
        entering={entering}
        exiting={exiting}
        accessibilityViewIsModal
        testID={testID}
        style={[styles.sheet, { maxHeight, paddingBottom: insets.bottom + space.lg, backgroundColor: ground ?? color.surface }]}
      >
        <Grain />
        <View pointerEvents="none" style={styles.rule} />
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            {eyebrow ? <Text variant="stamp" tone="accent">{eyebrow}</Text> : null}
            <Text ref={titleRef} accessibilityRole="header" variant={titleStyle === "narrative" ? "narrativeTitle" : "sectionTitle"}>
              {title}
            </Text>
          </View>
          <IconButton
            accessibilityLabel="Close"
            onPress={onClose}
            icon={<XIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.textSecondary} />}
          />
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false}>
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.surface,
    borderTopLeftRadius: ref.radius.bottomSheet,
    borderTopRightRadius: ref.radius.bottomSheet,
    ...curve,
    borderTopWidth: 1,
    borderColor: color.hairline,
    overflow: "hidden",
  },
  rule: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    bottom: 0,
    borderTopLeftRadius: ref.radius.bottomSheet - 4,
    borderTopRightRadius: ref.radius.bottomSheet - 4,
    ...curve,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: color.brassRule,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.accent,
    marginTop: space.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingLeft: space.gutter,
    paddingRight: space.sm,
    paddingTop: space.sm,
  },
  headerText: { flex: 1, paddingTop: space.md, gap: space.xs },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.sm, gap: space.lg },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.md, gap: space.sm },
});
