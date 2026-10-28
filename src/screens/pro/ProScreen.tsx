// 05 · Pro, the test paywall, laid out as 03 (the camera permission): the
// same kind of decision in the same capture flow, on the app's dark look in
// the capture palette (the shell's, or the active mode's). A flat dark ground
// and a full-bleed dark sheet rising from the bottom: the raised panel with
// the case-file art, the ESCAPD Pro kicker, the title in the theme's display
// face, three grey benefit lines, the note row (test note, info or error),
// the pill and the quiet pill, all in sentence case. "Not now", Android back,
// the iOS edge swipe and VoiceOver's escape gesture are the exits.
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WarningIcon, WifiSlashIcon } from "@/components/icons";
import { sheetRiseTiming, useShowAfter } from "@/components/noir";
import { ModePill } from "@/capture/ui/ModePill";
import { useCapturePalette } from "@/capture/ui/palette";
import { useModeTheme } from "@/game/mode";
import type { TextRef } from "@/components/Text";
import { testPurchasesEnabled } from "@/capture/testPurchase";
import { useTheme } from "@/theme/ThemeProvider";
import { ctaBottomPad, motion, ref } from "@/theme/tokens";
import { CaseFilePanel } from "./CaseFilePanel";
import * as copy from "./copy";
import { ProNoticeLine } from "./ProNoticeLine";
import { useFocusOnOpen } from "./useFocusOnOpen";
import { useOverflowScroll } from "./useOverflowScroll";
import { capFromParam, useProFlow } from "./useProFlow";

const L = ref.layout.pro;
const S = ref.space;

export function ProScreen() {
  const { cap } = useLocalSearchParams<{ cap?: string }>();
  const { view, busy, notice, unlock, checkAgain, leave } = useProFlow(capFromParam(cap));
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const titleRef = useRef<TextRef>(null);
  const overflow = useOverflowScroll();
  const [hostHeight, setHostHeight] = useState(0);
  const [controlsHeight, setControlsHeight] = useState(0);
  useFocusOnOpen(titleRef, view.kind === "ready");
  const palette = useCapturePalette();
  const theme = useModeTheme();
  // The shell's quiet kit pill is white on dark; a mode's is its muted ink.
  const quietGround = palette.genre === null ? "dark" : "paper";

  // Test builds offer the purchase; otherwise the sheet says Pro isn't on sale yet.
  const testBuild = testPurchasesEnabled();
  const working = busy !== "idle";
  // The last button's bottom sits ref.space.ctaBottom above the home
  // indicator, never closer than ref.space.ctaFloor to the screen's edge.
  const bottomPad = ctaBottomPad(insets.bottom);
  // The sheet's top never rises above ref.space.lg below the safe top (as 03).
  const capTop = insets.top + S.lg;
  // Large text: drop the decorative panel once the sheet would pass the cap,
  // then let the title and lines scroll. Their heights and the controls' don't
  // depend on either choice, so the decision is stable.
  const measured = hostHeight > 0 && overflow.contentHeight > 0 && controlsHeight > 0;
  const showPanel = !measured || overflow.contentHeight + controlsHeight + L.panelHeight <= hostHeight - capTop;
  const onHost = (e: LayoutChangeEvent) => setHostHeight(e.nativeEvent.layout.height);
  const onControls = (e: LayoutChangeEvent) => setControlsHeight(e.nativeEvent.layout.height);
  // The note row is always reserved (one meta line, two for the info), so an
  // error never moves the sheet.
  const noteRow = ref.type.meta.lineHeight * fontScale * (testBuild ? L.noteLines : L.infoLines);
  // Keyed, so each error mounts fresh and fades in. It is announced on iOS by
  // the line itself and on Android by the always-mounted live region that
  // holds it: Android sends a live-region event only from an ancestor that is
  // already a live region, so a line that mounts as one is never spoken.
  const errorLine = notice ? (
    <ProNoticeLine key="error" kind="error" text={notice.text} icon={notice.offline ? WifiSlashIcon : WarningIcon} testID="pro-notice" />
  ) : null;
  // What the row shows when there is no error. The test note's words are the
  // pill's hint, so screen readers skip it; the info line is read, never announced.
  const restingLine = errorLine ? null : testBuild ? (
    <Text
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.note, { color: palette.sheetMuted }]}
      testID="pro-test-note"
    >
      {copy.TEST_NOTE}
    </Text>
  ) : (
    <ProNoticeLine key="info" kind="info" text={copy.NOT_ON_SALE} testID="pro-info" />
  );

  return (
    <View
      style={[styles.root, { backgroundColor: palette.sheetGround }]}
      // VoiceOver's two-finger scrub: the same as "not now".
      onAccessibilityEscape={leave}
      testID={view.kind === "loading" ? "pro-loading" : "pro-screen"}
    >
      {view.kind === "loading" ? (
        // Loading (no ?cap): the ground only; the indicator only if the check outlasts the delay.
        <View pointerEvents="none" style={styles.centre}>
          <LoadingIndicator color={palette.inkMuted} />
        </View>
      ) : (
        // The sheet sits on the bottom edge and grows upward with its content,
        // never past the cap; past it the panel goes, then the text scrolls.
        <View style={[styles.fill, { paddingTop: capTop }]} onLayout={onHost} testID="pro-host">
          <SheetEnter enter={view.fadeIn} style={[styles.sheet, { backgroundColor: palette.sheet, borderColor: palette.rim }]}>
            {showPanel ? <CaseFilePanel /> : null}
            {/* Scrollable only while it overflows (large text), so a block that
                fits is never an Android keyboard stop (keyboard focus: the
                pill, then "not now"). */}
            <ScrollView
              testID="pro-scroll"
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              alwaysBounceVertical={false}
              scrollEnabled={overflow.scrollEnabled}
              onLayout={overflow.onLayout}
              onContentSizeChange={overflow.onContentSizeChange}
            >
              <Text style={[styles.kicker, { color: palette.sheetMuted }]}>{copy.KICKER}</Text>
              <Text ref={titleRef} accessibilityRole="header" style={[theme.display, styles.title, { color: palette.sheetInk }]}>
                {copy.TITLE}
              </Text>
              {/* Each line is one screen-reader element (a Text), never a keyboard stop. */}
              <View style={styles.lines} testID="pro-lines">
                {copy.benefitRows(view.cap).map((line) => (
                  <Text key={line} style={[styles.line, { color: palette.sheetMuted }]}>
                    {line}
                  </Text>
                ))}
              </View>
            </ScrollView>

            {/* Pinned under the scroll: the note row, the pill and "not now". */}
            <View style={[styles.actions, { paddingBottom: bottomPad }]} onLayout={onControls} testID="pro-controls">
              <View style={{ minHeight: noteRow }} testID="pro-note-row">
                {/* Always mounted (and never flattened away), holding only errors,
                    so adding one is what Android announces; the resting line
                    returns outside it, so it is never re-announced. */}
                <View accessibilityLiveRegion="polite" collapsable={false} testID="pro-error-region">
                  {errorLine}
                </View>
                {restingLine}
              </View>
              {testBuild ? (
                <ModePill
                  label={copy.UNLOCK}
                  accessibilityHint={copy.UNLOCK_HINT}
                  busy={busy === "purchasing"}
                  spinner
                  onPress={unlock}
                  testID="pro-unlock"
                  style={styles.pill}
                />
              ) : (
                <ModePill
                  label={copy.CHECK_AGAIN}
                  busy={busy === "checking"}
                  spinner
                  onPress={checkAgain}
                  testID="pro-check-again"
                  style={styles.pill}
                />
              )}
              {/* The quiet way out. */}
              <ModePill
                variant="quiet"
                ground={quietGround}
                label={copy.NOT_NOW}
                disabled={working}
                onPress={leave}
                testID="pro-not-now"
                style={styles.quiet}
              />
            </View>
          </SheetEnter>
        </View>
      )}
    </View>
  );
}

/**
 * Loading's short wait with no status line: a small native ActivityIndicator
 * in the palette's muted ink (03's Checking indicator), shown only once the check
 * has run past ref.layout.pro.spinnerDelay, so a faster check shows nothing.
 * It keeps the platform's own motion under reduced motion. One screen-reader
 * element (role progressbar, "Loading"), never a keyboard stop: on Android
 * `accessible` would make it focusable, so it uses screenReaderFocusable there.
 */
function LoadingIndicator({ color }: { color: string }) {
  const shown = useShowAfter(true, L.spinnerDelay);
  if (!shown) return null;
  return (
    <View
      accessible={Platform.OS === "ios"}
      screenReaderFocusable
      importantForAccessibility="yes"
      accessibilityRole="progressbar"
      accessibilityLabel={copy.LOADING}
      focusable={false}
      testID="pro-spinner"
    >
      <ActivityIndicator
        size="small"
        color={color}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="pro-spinner-indicator"
      />
    </View>
  );
}

const reducedFade = { duration: motion.reducedFade, reduceMotion: ReduceMotion.Never };

/**
 * When Default replaces Loading, the sheet slides up from below the screen on
 * ref.motion.sheetRise (03's sheet entry); under reduced motion it fades in over
 * motion.reducedFade instead, with no movement. With ?cap it is in place on
 * the first frame.
 */
function SheetEnter({ enter, style, children }: { enter: boolean; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const { reducedMotion } = useTheme();
  const { height } = useWindowDimensions();
  const [start] = useState(() => ({
    offset: enter && !reducedMotion ? height : 0,
    opacity: enter && reducedMotion ? 0 : 1,
  }));
  const offset = useSharedValue(start.offset);
  const opacity = useSharedValue(start.opacity);
  useEffect(() => {
    offset.set(withTiming(0, sheetRiseTiming));
    opacity.set(withTiming(1, reducedFade));
  }, [offset, opacity]);
  const enterStyle = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateY: offset.get() }] }));
  return (
    <Animated.View style={[style, enterStyle]} testID="pro-sheet">
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1, justifyContent: "flex-end" },
  // The indicator centred on the screen: (196.5, 426) on 393 x 852.
  centre: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  // Full-bleed, 16 continuous top corners with a 1 pt rim, square bottom
  // corners, no shadow, grabber or scrim. It shrinks (and its text scrolls)
  // only when large text would push it past the top.
  sheet: {
    flexShrink: 1,
    overflow: "hidden",
    borderTopWidth: ref.layout.hub.hairline,
    borderLeftWidth: ref.layout.hub.hairline,
    borderRightWidth: ref.layout.hub.hairline,
    borderTopLeftRadius: ref.radius.bottomSheet,
    borderTopRightRadius: ref.radius.bottomSheet,
    ...ref.curve,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: S.xl, paddingTop: S.xl },
  // ESCAPD Pro, over the title.
  kicker: { ...ref.type.meta, marginBottom: S.sm },
  // The theme's display face (the shell's serif, a mode's own), in sentence case.
  title: { textTransform: "none" },
  // Title baseline to first body baseline 39, as 03's.
  lines: { marginTop: L.titleGap },
  // The body: system 17/22, the sheet's grey.
  line: { ...ref.type.body },
  actions: { paddingHorizontal: S.xl, paddingTop: S.sm },
  note: { ...ref.type.meta },
  pill: { marginTop: S.band },
  quiet: { marginTop: S.sm },
});
