// 05 · Pro, the test paywall (docs/DESIGN.md), in the play screen's look: a
// case-file cover. The light table's top bar with a centred brass stamp, a
// long quiet void, then a bottom-anchored block of one Playfair statement and
// a manila slip of three benefit lines. Below them, pinned: the notice slot,
// the TEST PURCHASE stamp, one brass pill and a quiet "Not now". Canvas, the
// silk still and the live Grain under everything; no light pool or header control.
import { useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/Grain";
import { WarningIcon, WifiSlashIcon } from "@/components/icons";
import { BackgroundStill, PillButton, controlTiming, useShowAfter } from "@/components/noir";
import { Text, type TextRef } from "@/components/Text";
import { testPurchasesEnabled } from "@/capture/testPurchase";
import { color, hit, ref, space, type } from "@/theme/tokens";
import { BenefitSlip } from "./BenefitSlip";
import * as copy from "./copy";
import { ProNoticeLine } from "./ProNoticeLine";
import { useFocusOnOpen } from "./useFocusOnOpen";
import { useOverflowScroll } from "./useOverflowScroll";
import { capFromParam, useProFlow } from "./useProFlow";

const L = ref.layout.pro;

export function ProScreen() {
  const { cap } = useLocalSearchParams<{ cap?: string }>();
  const { view, busy, notice, unlock, checkAgain, leave } = useProFlow(capFromParam(cap));
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const statementRef = useRef<TextRef>(null);
  const overflow = useOverflowScroll();
  useFocusOnOpen(statementRef, view.kind === "ready");

  // Test builds offer the purchase; otherwise the screen says Pro isn't on sale yet.
  const testBuild = testPurchasesEnabled();
  const working = busy !== "idle";
  // The notice slot is always reserved, so nothing moves when a notice appears.
  const noticeLine = type.caption.lineHeight * fontScale;
  const noteLine = type.stamp.lineHeight * fontScale;
  // Keyed, so each error mounts fresh and fades in. It is announced on iOS by
  // the line itself and on Android by the always-mounted live region that
  // holds it: Android sends a live-region event only from an ancestor that is
  // already a live region, so a line that mounts as one is never spoken.
  const errorLine = notice ? (
    <ProNoticeLine key="error" kind="error" text={notice.text} icon={notice.offline ? WifiSlashIcon : WarningIcon} testID="pro-notice" />
  ) : null;

  return (
    <View style={styles.root} testID={view.kind === "loading" ? "pro-loading" : "pro-screen"}>
      <BackgroundStill />
      <Grain />
      {view.kind === "loading" ? (
        // Loading (no ?cap): the ground only; the brass indicator only if the check outlasts the delay.
        <View pointerEvents="none" style={styles.centre}>
          <LoadingIndicator />
        </View>
      ) : (
        <FadeIn fade={view.fadeIn} style={[styles.fill, { paddingTop: insets.top, paddingBottom: insets.bottom + space.xs }]}>
          {/* The light table's top bar: 48 tall, the brass stamp centred
              between two 48 spaces. No control: "Not now", Android back and
              the iOS edge swipe are the exits. */}
          <View style={styles.topBar}>
            <View style={styles.topSpacer} />
            <Text variant="stamp" tone="accent" align="center" accessibilityLabel={copy.FILE_LABEL_A11Y} style={styles.topStamp}>
              {copy.FILE_LABEL}
            </Text>
            <View style={styles.topSpacer} />
          </View>

          {/* Bottom-anchored: grows upward into the void, and scrolls only if it
              still doesn't fit. It is scrollable only then, so a block that fits
              is never an Android keyboard stop (keyboard focus: the pill, then
              "Not now"). */}
          <ScrollView
            testID="pro-scroll"
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            alwaysBounceVertical={false}
            scrollEnabled={overflow.scrollEnabled}
            onLayout={overflow.onLayout}
            onContentSizeChange={overflow.onContentSizeChange}
          >
            <Text ref={statementRef} variant="caseDisplay" accessibilityRole="header">
              {copy.STATEMENT}
            </Text>
            <BenefitSlip rows={copy.benefitRows(view.cap)} style={styles.slip} />
          </ScrollView>

          <View style={styles.gutter}>
            {testBuild ? (
              <>
                {/* Always mounted (and never flattened away), so adding the
                    error to it is what Android announces. */}
                <View style={{ minHeight: noticeLine }} accessibilityLiveRegion="polite" collapsable={false} testID="pro-notice-slot">
                  {errorLine}
                </View>
                {/* Its words are the button's hint, so screen readers skip it. */}
                <Text
                  variant="stamp"
                  tone="secondary"
                  align="center"
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.testNote}
                >
                  {copy.TEST_NOTE}
                </Text>
              </>
            ) : (
              // The notice and test-note slots together, bottom-aligned: the
              // info line, or the error line in its place after a failed check.
              // Only the error sits in the always-mounted live region (empty and
              // 0 tall otherwise), so the returning info line is never re-announced.
              <View style={[styles.infoSlot, { minHeight: noticeLine + space.sm + noteLine }]} testID="pro-info-slot">
                <View accessibilityLiveRegion="polite" collapsable={false} testID="pro-error-region">
                  {errorLine}
                </View>
                {errorLine ? null : <ProNoticeLine key="info" kind="info" text={copy.NOT_ON_SALE} testID="pro-info" />}
              </View>
            )}

            {testBuild ? (
              <PillButton
                label={copy.UNLOCK}
                scheme="brass"
                variant="primary"
                spinner
                busy={busy === "purchasing"}
                accessibilityHint={copy.UNLOCK_HINT}
                onPress={unlock}
                testID="pro-unlock"
                style={styles.action}
              />
            ) : (
              <PillButton
                label={copy.CHECK_AGAIN}
                scheme="brass"
                variant="primary"
                spinner
                busy={busy === "checking"}
                onPress={checkAgain}
                testID="pro-check-again"
                style={styles.action}
              />
            )}
            <PillButton
              label={copy.NOT_NOW}
              scheme="brass"
              variant="quiet"
              disabled={working}
              onPress={leave}
              testID="pro-not-now"
              style={styles.notNow}
            />
          </View>
        </FadeIn>
      )}
    </View>
  );
}

/**
 * Loading's short wait with no status line: the live pattern, a small native
 * ActivityIndicator in color.accent, shown only once the check has run past
 * ref.layout.pro.spinnerDelay, so a faster check shows nothing. It keeps the
 * platform's own motion under reduced motion. One screen-reader element
 * (role progressbar, "Loading"), never a keyboard stop: on Android
 * `accessible` would make it focusable, so it uses screenReaderFocusable there.
 */
function LoadingIndicator() {
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
        color={color.accent}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="pro-spinner-indicator"
      />
    </View>
  );
}

/**
 * Default fades in over the kit's controlTiming (ref.motion.control, 120 ms)
 * when it replaces Loading. It is an opacity change, not movement, so it stays
 * under reduced motion. With ?cap it renders on the first frame with no fade.
 */
function FadeIn({ fade, style, children }: { fade: boolean; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const opacity = useSharedValue(fade ? 0 : 1);
  useEffect(() => {
    opacity.set(withTiming(1, controlTiming));
  }, [opacity]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[style, fadeStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  fill: { flex: 1 },
  // The indicator centred on the screen: (196.5, 426) on 393 x 852.
  centre: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  gutter: { paddingHorizontal: space.gutter },
  topBar: { flexDirection: "row", alignItems: "center", minHeight: hit.min, paddingHorizontal: space.gutter },
  topSpacer: { width: hit.min },
  topStamp: { flex: 1 },
  // At least 24 of void stays above the statement; the slip ends 32 above the notice slot.
  scroll: { flex: 1, marginTop: space.xl, marginBottom: space.xxl },
  scrollContent: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: space.gutter },
  slip: { marginTop: space.xl },
  testNote: { marginTop: space.sm },
  infoSlot: { justifyContent: "flex-end" },
  action: { marginTop: space.md },
  notNow: { marginTop: space.sm },
});
