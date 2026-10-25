// 05 · Pro, the test paywall (docs/DESIGN.md). A case-file cover sheet: a mono
// file label pinned at the top, a long quiet void, then a bottom-anchored
// block of one statement and a ruled three-row index. Below them, pinned: the
// notice slot, the TEST PURCHASE note, one action pill and a quiet "Not now".
// The black silk still under everything; no light pool, Grain or header control.
import { useEffect, useRef, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WarningIcon, WifiSlashIcon } from "@/components/icons";
import { BackgroundStill, Dither, NoirText, PillButton, controlTiming, type NoirTextRef } from "@/components/noir";
import { testPurchasesEnabled } from "@/capture/testPurchase";
import { ref } from "@/theme/tokens";
import { BenefitIndex } from "./BenefitIndex";
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
  const statementRef = useRef<NoirTextRef>(null);
  const overflow = useOverflowScroll();
  useFocusOnOpen(statementRef, view.kind === "ready");

  // Loading (no ?cap): flat ground; the dither only if the check outlasts the delay.
  if (view.kind === "loading") {
    return (
      <View style={styles.root} testID="pro-loading">
        <View pointerEvents="none" style={styles.centre}>
          <Dither showDelay={L.ditherDelay} testID="pro-dither" />
        </View>
      </View>
    );
  }

  // Test builds offer the purchase; otherwise the screen says Pro isn't on sale yet.
  const testBuild = testPurchasesEnabled();
  const working = busy !== "idle";
  // The notice slot is always reserved, so nothing moves when a notice appears.
  const noticeLine = ref.type.meta.lineHeight * fontScale;
  const noteLine = ref.type.note.lineHeight * fontScale;
  // Keyed, so each error mounts fresh and fades in. It is announced on iOS by
  // the line itself and on Android by the always-mounted live region that
  // holds it: Android sends a live-region event only from an ancestor that is
  // already a live region, so a line that mounts as one is never spoken.
  const errorLine = notice ? (
    <ProNoticeLine key="error" kind="error" text={notice.text} icon={notice.offline ? WifiSlashIcon : WarningIcon} testID="pro-notice" />
  ) : null;

  return (
    <View style={styles.root} testID="pro-screen">
      <FadeIn fade={view.fadeIn} style={styles.fill}>
        <BackgroundStill />
        <View style={[styles.fill, { paddingTop: insets.top + L.labelTop, paddingBottom: insets.bottom + ref.space.ctaBottom }]}>
          <View style={styles.gutter}>
            <NoirText variant="label" accessibilityLabel={copy.FILE_LABEL_A11Y}>
              {copy.FILE_LABEL}
            </NoirText>
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
            <NoirText ref={statementRef} variant="statement" accessibilityRole="header">
              {copy.STATEMENT}
            </NoirText>
            <BenefitIndex rows={copy.benefitRows(view.cap)} style={styles.index} />
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
                <NoirText
                  variant="note"
                  align="center"
                  centerTracking
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.testNote}
                >
                  {copy.TEST_NOTE}
                </NoirText>
              </>
            ) : (
              // The notice and test-note slots together, bottom-aligned: the
              // info line, or the error line in its place after a failed check.
              // Only the error sits in the always-mounted live region (empty and
              // 0 tall otherwise), so the returning info line is never re-announced.
              <View style={[styles.infoSlot, { minHeight: noticeLine + ref.space.sm + noteLine }]} testID="pro-info-slot">
                <View accessibilityLiveRegion="polite" collapsable={false} testID="pro-error-region">
                  {errorLine}
                </View>
                {errorLine ? null : <ProNoticeLine key="info" kind="info" text={copy.NOT_ON_SALE} testID="pro-info" />}
              </View>
            )}

            {testBuild ? (
              <PillButton
                label={copy.UNLOCK}
                variant="signal"
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
                variant="primary"
                spinner
                busy={busy === "checking"}
                onPress={checkAgain}
                testID="pro-check-again"
                style={styles.action}
              />
            )}
            <PillButton label={copy.NOT_NOW} variant="quiet" disabled={working} onPress={leave} testID="pro-not-now" style={styles.notNow} />
          </View>
        </View>
      </FadeIn>
    </View>
  );
}

/**
 * Default fades in over ref.motion.control when it replaces Loading. It is an
 * opacity change, not movement, so it stays under reduced motion. With ?cap
 * it renders on the first frame with no fade.
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
  root: { flex: 1, backgroundColor: ref.color.ground },
  fill: { flex: 1 },
  // The dither's box centred on the screen: (196.5, 426) on 393 x 852.
  centre: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  gutter: { paddingHorizontal: ref.space.reading },
  // At least 24 of void stays above the statement; the index ends 32 above the notice slot.
  scroll: { flex: 1, marginTop: ref.space.xl, marginBottom: ref.space.xxl },
  scrollContent: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: ref.space.reading },
  index: { marginTop: ref.space.band },
  testNote: { marginTop: ref.space.sm },
  infoSlot: { justifyContent: "flex-end" },
  action: { marginTop: ref.space.md },
  // The kit pads a quiet button by a fixed (44 − label line) / 2, so it would
  // outgrow 44 as soon as text scales up and lift the pill off 762. Its
  // minHeight (ref.button.quiet.height) with the label centred keeps it 44
  // until the label line itself passes 44; at the default size nothing moves.
  notNow: { marginTop: ref.space.sm, paddingVertical: 0 },
});
