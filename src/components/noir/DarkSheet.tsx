// The reference look's dark bottom sheet, generalised from the hub's How you
// play sheet (docs/DESIGN.md, 01 · How you play sheet), so every dark sheet is
// one sheet: fill ref.color.ground, top corners ref.radius.bottomSheet 40 (the camera's)
// (continuous), a 1 pt ref.color.rim along its top and sides, over a black
// 55 % scrim (or a clear one, so the scene stays visible). The header is the
// title on the 24 gutter, an optional grey meta line under it, and Close as
// 01's round chip (36 disc, diagonal 1 pt specular ring, Phosphor X at 18)
// 16 from the sheet's top and right edges. Content scrolls; an optional
// footer stays pinned under it. It shares the hub sheet's timings
// (ref.layout.hub.sheet): it slides up on ref.motion.sheetRise and away on ref.motion.sheetFall
// (cross-fades over motion.reducedFade under reduced motion),
// moves screen-reader focus to its title once it has risen, and traps
// VoiceOver (accessibilityViewIsModal). Tapping the scrim closes it.
// Render it conditionally: it animates in on mount and out on unmount.
import { useEffect, useId, useRef, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View, type DimensionValue, type HostInstance } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient } from "react-native-svg";
import { XIcon } from "phosphor-react-native/src/icons/X";
import { useTheme } from "@/theme/ThemeProvider";
import { useFeedback } from "@/game/feedback";
import { motion, ref, z } from "@/theme/tokens";
import { sheetEntering, sheetExiting } from "./motion";
import { FocusRing, useFocusRing } from "./focus";
import { gradientStops } from "./gradient";

const H = ref.layout.hub;
const S = H.sheet;
const C = ref.button.chip;
const MID = C.size / 2;
const CHIP_PAD = (C.hit - C.size) / 2;
// Close's disc centred on the corner's centre of curvature: 40 - 18 = 22 in from the top and right.
const CLOSE_INSET = ref.radius.bottomSheet - C.size / 2;

export interface DarkSheetProps {
  title: string;
  /** "headline" (system Semibold 17, a utility sheet) or "serif" (Roboto Serif 17, 02's title: a narrative moment). */
  titleStyle?: "headline" | "serif";
  /** A grey ref.type.meta line under the title. */
  meta?: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the scrolling content. */
  footer?: ReactNode;
  /** Default true: black 55 %. False keeps the screen behind visible (the scrim still closes the sheet). */
  scrim?: boolean;
  /** Default the hub sheet's 64 %. */
  maxHeight?: DimensionValue;
  testID?: string;
  closeTestID?: string;
  /** Default true. False holds the content still (a picker inside is being dragged). */
  scrollEnabled?: boolean;
}

export function DarkSheet({
  title,
  titleStyle = "headline",
  meta,
  onClose,
  children,
  footer,
  scrim = true,
  maxHeight = S.maxHeight,
  testID,
  closeTestID,
  scrollEnabled = true,
}: DarkSheetProps) {
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const titleRef = useRef<HostInstance>(null);

  // Screen-reader focus to the title once the sheet has risen.
  useEffect(() => {
    const t = setTimeout(
      () => {
        if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
      },
      reducedMotion ? S.titleFocusReduced : S.titleFocus,
    );
    return () => clearTimeout(t);
  }, [reducedMotion]);

  const entering = sheetEntering(reducedMotion);
  const exiting = sheetExiting(reducedMotion);

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Animated.View
        entering={FadeIn.duration(reducedMotion ? motion.reducedFade : S.scrimIn)}
        exiting={FadeOut.duration(reducedMotion ? motion.reducedFade : S.scrimOut)}
        style={[StyleSheet.absoluteFill, scrim && styles.scrim]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />
      </Animated.View>
      <Animated.View
        entering={entering}
        exiting={exiting}
        accessibilityViewIsModal
        testID={testID}
        style={[styles.sheet, { maxHeight, paddingBottom: insets.bottom + ref.space.lg }]}
      >
        <View style={styles.header}>
          <View style={styles.titleColumn}>
            <Text ref={titleRef} accessibilityRole="header" style={[titleStyle === "serif" ? ref.type.serifTitle : ref.type.headline, styles.title]}>
              {title}
            </Text>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          </View>
          <CloseChip onPress={onClose} testID={closeTestID} />
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false} scrollEnabled={scrollEnabled}>
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Animated.View>
    </View>
  );
}

/** 01's round chip as Close: a 36 ground disc with the diagonal specular ring, in a 48 hit box. */
function CloseChip({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const id = `sheetchip${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPressIn={feedback.press}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [styles.chipHit, pressed && styles.chipPressed]}
    >
      <View style={styles.chip}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width={C.size} height={C.size}>
            <Defs>
              <LinearGradient id={id} x1={1} y1={0} x2={0} y2={1}>
                {gradientStops(H.chipRing)}
              </LinearGradient>
            </Defs>
            <Circle cx={MID} cy={MID} r={MID - C.ringWidth / 2} fill="none" stroke={`url(#${id})`} strokeWidth={C.ringWidth} />
          </Svg>
        </View>
        <XIcon size={ref.icon.chip} weight="regular" color={ref.color.textPrimary} />
        <FocusRing visible={focus.focused} shape="pill" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: z.sheet },
  scrim: { backgroundColor: S.scrim },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: ref.color.ground,
    borderTopLeftRadius: ref.radius.bottomSheet,
    borderTopRightRadius: ref.radius.bottomSheet,
    ...ref.curve,
    borderTopWidth: H.hairline,
    borderLeftWidth: H.hairline,
    borderRightWidth: H.hairline,
    borderColor: ref.color.rim,
    overflow: "hidden",
  },
  // The title on the 24 gutter; Close's disc sits concentric with the sheet's 40 pt corner (CLOSE_INSET from the top and right edges).
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: CLOSE_INSET - CHIP_PAD,
    paddingLeft: ref.space.xl,
    paddingRight: CLOSE_INSET - CHIP_PAD,
    gap: ref.space.sm,
  },
  titleColumn: { flex: 1, gap: ref.space.xs },
  title: { color: ref.color.textPrimary },
  meta: { ...ref.type.meta, color: ref.color.textSecondary },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: ref.space.xl, paddingTop: ref.space.sm, paddingBottom: ref.space.sm, gap: ref.space.xl },
  footer: { paddingHorizontal: ref.space.xl, paddingTop: ref.space.lg, gap: ref.space.sm },
  chipHit: { width: C.hit, height: C.hit, alignItems: "center", justifyContent: "center" },
  chip: {
    width: C.size,
    height: C.size,
    borderRadius: C.radius,
    backgroundColor: C.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  chipPressed: { opacity: C.pressedOpacity },
});
