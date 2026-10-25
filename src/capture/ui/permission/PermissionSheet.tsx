// 03 · Camera permission: the sheet that holds the screen's one decision
// (docs/DESIGN.md 03, Hosting, Layout and States). A custom bottom-anchored
// view in the live Sheet's look (src/components/Sheet.tsx): walnut
// color.surface with the live Grain, radius.sheet top corners, a 1 pt
// color.hairline top edge and the inner 1 pt color.brassRule inset space.xs.
// No brass handle, scrim, eyebrow or X: it is the route's own state, not a
// modal, so nothing suggests it can be dragged or tapped away. It reuses the
// live Sheet's enter motion (motion.sheetSpring; a motion.reducedFade fade
// under reduced motion) and its move-focus-to-title behaviour.
//
// Top to bottom: the illustration zone (the film-plate mount), the title and
// body (and the notice slot), then the pinned controls. Content-sized and
// bottom-anchored: when its content changes height, its top moves with
// motion.sheetSpring and its bottom stays fixed, the buttons with it. With
// large text it grows up to a cap space.sm below the back control; past that
// the zone is dropped, then the text scrolls while the controls stay pinned.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  ReduceMotion,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/Grain";
import { Text, type TextRef } from "@/components/Text";
import { useTheme } from "@/theme/ThemeProvider";
import { color, curve, hit, motion, radius, ref, space } from "@/theme/tokens";
import { IllustrationZone, ZONE_HEIGHT } from "./IllustrationZone";

const P = ref.layout.permission;
const SPRING = motion.sheetSpring;
const EDGE = P.hairline;

const RISE = SlideInDown.springify().damping(SPRING.damping).stiffness(SPRING.stiffness).mass(SPRING.mass).reduceMotion(ReduceMotion.Never);
const FALL = SlideOutDown.springify().damping(SPRING.damping).stiffness(SPRING.stiffness).mass(SPRING.mass).reduceMotion(ReduceMotion.Never);
const RESIZE = LinearTransition.springify().damping(SPRING.damping).stiffness(SPRING.stiffness).mass(SPRING.mass).reduceMotion(ReduceMotion.Never);
// motion.reducedFade: the text crossfade (Denied copy, notice in or out) in
// every mode, and the sheet's enter and exit under reduced motion.
const FADE_IN = FadeIn.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never);
const FADE_OUT = FadeOut.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never);

/** The sheet's top never rises above the back control's 48 box plus space.sm: y 121 under a 59 safe area (6 + 48 + 8 below it). */
export const CAP_BELOW_SAFE_TOP = P.back.top + hit.min + space.sm;

export interface SheetNotice {
  /** The slot's identity: a new key crossfades it. */
  key: string;
  node: ReactNode;
  /** False for a thinking line, which stops the moment its wait ends (no fade out). */
  fadeOut: boolean;
}

export interface PermissionSheetProps {
  /** The copy set ("default" | "denied"). A change crossfades the text and moves accessibility focus to the title. */
  copyKey: string;
  title: string;
  body: string;
  /** The inline notice or thinking line, space.sm below the body; null when unset. */
  notice: SheetNotice | null;
  /** The pinned controls: the primary button, then the quiet button(s). */
  children: ReactNode;
  testID?: string;
}

export function PermissionSheet({ copyKey, title, body, notice, children, testID }: PermissionSheetProps) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useTheme();
  const titleRef = useRef<TextRef>(null);
  const [hostHeight, setHostHeight] = useState(0);
  const [textHeight, setTextHeight] = useState(0);
  const [controlsHeight, setControlsHeight] = useState(0);

  // The last button's bottom edge sits space.xs above the home indicator; with
  // no bottom inset, a 4 pt edge is too tight, so it's space.lg.
  const bottomPad = insets.bottom > 0 ? insets.bottom + space.xs : space.lg;
  const capTop = insets.top + CAP_BELOW_SAFE_TOP;

  // Large text: drop the decorative zone once the sheet would pass the cap,
  // then let the text scroll. Text and controls heights don't depend on either
  // choice, so the decision is stable.
  const measured = hostHeight > 0 && textHeight > 0 && controlsHeight > 0;
  const room = hostHeight - capTop;
  const content = EDGE + textHeight + controlsHeight;
  const scroll = measured && content > room;
  const zone = !measured || content + ZONE_HEIGHT <= room;

  // Accessibility focus moves to the title when the sheet enters and after
  // any switch to or from Denied (the title is keyed by copyKey).
  useEffect(() => {
    const timer = setTimeout(
      () => {
        const node = titleRef.current;
        if (node) AccessibilityInfo.sendAccessibilityEvent(node, "focus");
      },
      reducedMotion ? motion.reducedFade : P.titleFocusDelay,
    );
    return () => clearTimeout(timer);
  }, [copyKey, reducedMotion]);

  const onHost = (e: LayoutChangeEvent) => setHostHeight(e.nativeEvent.layout.height);
  const onText = (e: LayoutChangeEvent) => setTextHeight(e.nativeEvent.layout.height);
  const onControls = (e: LayoutChangeEvent) => setControlsHeight(e.nativeEvent.layout.height);

  // The text enters with the sheet (no fade of its own) and leaves with it
  // (no fade as it slides out); only later swaps crossfade.
  const text = (
    <LayoutAnimationConfig skipEntering skipExiting>
      <View style={styles.text} onLayout={onText} testID="permission-text">
        <Animated.View key={`title-${copyKey}`} entering={FADE_IN} exiting={FADE_OUT}>
          <Text ref={titleRef} variant="narrativeTitle" accessibilityRole="header">
            {title}
          </Text>
        </Animated.View>
        <Animated.View key={`body-${copyKey}`} entering={FADE_IN} exiting={FADE_OUT} style={styles.body}>
          <Text variant="body" tone="secondary">
            {body}
          </Text>
        </Animated.View>
        {notice ? (
          <Animated.View key={notice.key} entering={FADE_IN} exiting={notice.fadeOut ? FADE_OUT : undefined} style={styles.notice}>
            {notice.node}
          </Animated.View>
        ) : null}
      </View>
    </LayoutAnimationConfig>
  );

  // The sheet's frame springs (top moves, bottom fixed). The controls get the
  // same spring for their offset inside it, which cancels the sheet's, so they
  // hold still on screen. Reduced motion: the top moves at once.
  const resize = reducedMotion ? undefined : RESIZE;

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.host, { paddingTop: capTop }]}
      onLayout={onHost}
      testID="permission-sheet-host"
    >
      <Animated.View
        testID={testID}
        entering={reducedMotion ? FADE_IN : RISE}
        exiting={reducedMotion ? FADE_OUT : FALL}
        layout={resize}
        style={styles.sheet}
      >
        <Grain />
        <View pointerEvents="none" style={styles.rule} testID="permission-sheet-rule" />
        {zone ? <IllustrationZone /> : null}
        {scroll ? (
          <ScrollView style={styles.scroll} bounces={false} alwaysBounceVertical={false} testID="permission-scroll">
            {text}
          </ScrollView>
        ) : (
          text
        )}
        <Animated.View
          layout={resize}
          style={[styles.controls, { paddingBottom: bottomPad }]}
          onLayout={onControls}
          testID="permission-controls"
        >
          {children}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { justifyContent: "flex-end" },
  // The live Sheet's frame: walnut, radius.sheet top corners with continuous
  // curves, the 1 pt brass hairline along the top edge and round its corners,
  // square bottom corners at the screen edge. Opaque, no shadow.
  sheet: {
    flexShrink: 1,
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    ...curve,
    borderTopWidth: EDGE,
    borderColor: color.hairline,
    overflow: "hidden",
  },
  // The live Sheet's inner rule: 1 pt color.brassRule, space.xs inside the
  // top and sides, concentric with the corners, open at the bottom.
  rule: {
    position: "absolute",
    top: space.xs,
    left: space.xs,
    right: space.xs,
    bottom: 0,
    borderTopLeftRadius: radius.sheet - space.xs,
    borderTopRightRadius: radius.sheet - space.xs,
    ...curve,
    borderWidth: EDGE,
    borderBottomWidth: 0,
    borderColor: color.brassRule,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  // Title box space.xl below the mount (or below the top hairline when the zone is dropped).
  text: { paddingHorizontal: space.gutter, paddingTop: space.xl },
  body: { marginTop: space.sm },
  notice: { marginTop: space.sm },
  // The primary button sits space.xl below the body (or notice); the quiet buttons space.sm apart.
  controls: { paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.sm },
});
