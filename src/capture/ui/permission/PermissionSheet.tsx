// 03 · Camera permission: the sheet that holds the screen's one decision
// (docs/DESIGN.md 03, Hosting, Layout and States). pushr's sheet: full-bleed
// ref.color.paper rising from below, top corners ref.radius.bottomSheet
// (continuous), square at the foot, no shadow, scrim, grabber, hairline or
// grain. It is the route's own state, not a modal: nothing suggests it can be
// dragged or tapped away. It slides up on ref.motion.sheetRise (a
// motion.reducedFade fade under reduced motion) and moves accessibility focus
// to the title.
//
// Top to bottom: the illustration panel, the title and body (and the notice
// slot) in the ref.space.xl gutter, then the pinned controls. Content-sized
// and bottom-anchored: when its content changes height, its top moves with
// ref.motion.sheetRise and its bottom stays fixed, the buttons with it. With
// large text it grows up to ref.space.lg below the safe top; past that the
// panel is dropped, then the text scrolls while the controls stay pinned.
// Inside a mode the sheet, title and body take the mode's sheet colours
// (src/capture/ui/palette.ts): a dark `surface` sheet, ink and muted ink.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View, type HostInstance, type LayoutChangeEvent } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { sheetEntering, sheetExiting, toEasing } from "@/components/noir";
import { useCapturePalette } from "../palette";
import { IllustrationPanel } from "./IllustrationPanel";

const P = ref.layout.permission;
const RISE = sheetEntering(false);
const FALL = sheetExiting(false);
// A height change moves the sheet's top on the same no-overshoot curve as its rise.
const RESIZE = LinearTransition.duration(ref.motion.sheetRise.duration).easing(toEasing(ref.motion.sheetRise.easing)).reduceMotion(ReduceMotion.Never);
// motion.reducedFade: the text crossfade (Denied copy, notice in or out) in
// every mode, and the sheet's enter and exit under reduced motion.
const FADE_IN = FadeIn.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never);
const FADE_OUT = FadeOut.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never);

/** The sheet's top never rises above this far below the safe top. */
export const CAP_BELOW_SAFE_TOP = ref.space.lg;

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
  /** The inline notice or thinking line, ref.space.sm below the body; null when unset. */
  notice: SheetNotice | null;
  /** The pinned controls: the pill, then the quiet button(s). */
  children: ReactNode;
  testID?: string;
}

export function PermissionSheet({ copyKey, title, body, notice, children, testID }: PermissionSheetProps) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useTheme();
  const palette = useCapturePalette();
  const titleRef = useRef<HostInstance>(null);
  const [hostHeight, setHostHeight] = useState(0);
  const [textHeight, setTextHeight] = useState(0);
  const [controlsHeight, setControlsHeight] = useState(0);

  // The last button's bottom edge sits ref.space.ctaBottom above the home
  // indicator; with no bottom inset, that is too tight, so it's ref.space.lg.
  const bottomPad = insets.bottom > 0 ? insets.bottom + ref.space.ctaBottom : ref.space.lg;
  const capTop = insets.top + CAP_BELOW_SAFE_TOP;

  // Large text: drop the decorative panel once the sheet would pass the cap,
  // then let the text scroll. Text and controls heights don't depend on either
  // choice, so the decision is stable.
  const measured = hostHeight > 0 && textHeight > 0 && controlsHeight > 0;
  const room = hostHeight - capTop;
  const content = textHeight + controlsHeight;
  const scroll = measured && content > room;
  const panel = !measured || content + P.panel <= room;

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
          <Text ref={titleRef} accessibilityRole="header" style={[styles.title, { color: palette.sheetInk }]}>
            {title}
          </Text>
        </Animated.View>
        <Animated.View key={`body-${copyKey}`} entering={FADE_IN} exiting={FADE_OUT} style={styles.body}>
          <Text style={[styles.bodyText, { color: palette.sheetMuted }]}>{body}</Text>
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
        style={[styles.sheet, { backgroundColor: palette.sheet }]}
      >
        {panel ? <IllustrationPanel /> : null}
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
  // pushr's sheet: white, full-bleed, ref.radius.bottomSheet continuous top corners,
  // square at the screen's foot, clipping the panel. Opaque, no shadow.
  sheet: {
    flexShrink: 1,
    borderTopLeftRadius: ref.radius.bottomSheet,
    borderTopRightRadius: ref.radius.bottomSheet,
    ...ref.curve,
    overflow: "hidden",
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  // Title box ref.space.xl below the panel (or the sheet's top when the panel is dropped).
  text: { paddingHorizontal: ref.space.xl, paddingTop: ref.space.xl },
  // pushr's title: Archivo Black 30/36, lowercase (ref.type.display), black, left-aligned.
  title: { ...ref.type.display },
  // The body: the system font 17/22, the reference's grey, lowercase, ragged right; its box
  // titleToBody 14 below the title's (title baseline to first body baseline 39, as measured).
  body: { marginTop: P.titleToBody },
  bodyText: { ...ref.type.body, textTransform: "lowercase" },
  notice: { marginTop: ref.space.sm },
  // The pill sits ref.space.band below the body's box (or the notice); the quiet buttons ref.space.sm below it, and apart.
  controls: { paddingHorizontal: ref.space.xl, paddingTop: ref.space.band, gap: ref.space.sm },
});
