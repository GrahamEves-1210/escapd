// 04 · First-time photo guide (docs/DESIGN.md), in the play screen's look.
// Four steps, each a warm line drawing on a film plate (SceneView's walnut
// mount with a brass plate label), a Playfair title and a Jakarta instruction,
// and one brass pill: the walnut "Next" for three steps, the brass "Open the
// camera" on step 4. Silk still and grain under everything; no light pool.
//
// Layout on 393 x 852 (safe 59 / 34), top to bottom: the light table's top bar
// at y 59-107 (gutter 20): Close (48, x 325-373) on the right, the brass step
// stamp centred on it (line box 76-90), a 48 spacer on the left; the mount at
// y 178-564; the title (620-650) and body (654-700), bottom-anchored; a 62
// gap that holds the replay status line (724-742); the button at 762-814;
// then safe bottom + space.xs, as Pro. Large text grows the block upward
// from 814.
import { useCallback, useEffect, useRef } from "react";
import { AccessibilityInfo, BackHandler, StyleSheet, View, useWindowDimensions } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { router, useFocusEffect, useNavigation, type NativeStackNavigationProp } from "expo-router";
import { markCaptureGuideSeen } from "@/capture/guideSeen";
import { Grain } from "@/components/Grain";
import { BackgroundStill, ThinkingStates } from "@/components/noir";
import { Text, type TextRef } from "@/components/Text";
import { useTheme } from "@/theme/ThemeProvider";
import { color, hit, motion, ref, space, type as typeScale } from "@/theme/tokens";
import { CloseButton } from "./CloseButton";
import { COPY, LAST_STEP, STEPS, stampLabel, stampText, stepAnnouncement } from "./copy";
import { GuideArt } from "./GuideArt";
import { GuideText } from "./GuideText";
import { CLOSE_SLOP } from "./layout";
import { ReplayErrorLine } from "./ReplayErrorLine";
import { StepButton } from "./StepButton";
import { FadeLayer, layersOf, useStepper } from "./stepper";
import { SWIPE_OFFSETS, swipeStep } from "./swipe";
import { useReplayCheck } from "./useReplayCheck";

const G = ref.layout.guide;

/** The route's search params, as expo-router hands them over. */
export type GuideParams = Record<string, string | string[] | undefined>;

export interface PhotoGuideProps {
  /** Opened from 01's How you play sheet (/capture/guide?replay=1). */
  replay: boolean;
  /** First run: the route's other params, carried on to /capture. */
  carry: GuideParams;
}

export function PhotoGuide({ replay, carry }: PhotoGuideProps) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { reducedMotion } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const { state, clock, goTo, isMoving, currentStep } = useStepper(
    STEPS.length,
    reducedMotion ? motion.reducedFade : motion.sceneCrossfade,
  );
  // Set once the guide navigates away (or replay's check does), so no later
  // tap, swipe or back press can navigate a second time.
  const gone = useRef(false);
  const markGone = useCallback(() => {
    gone.current = true;
  }, []);
  const check = useReplayCheck(markGone);
  const { cancel: cancelCheck, start: startCheck } = check;
  const titleRef = useRef<TextRef>(null);

  const step = state.current.step;
  const last = step === LAST_STEP;
  const layers = layersOf(state);

  // Screen readers: focus the title and say where the player is, when the
  // screen opens and after every step change.
  const announce = useCallback(() => {
    const title = titleRef.current;
    if (title) AccessibilityInfo.sendAccessibilityEvent(title, "focus");
    AccessibilityInfo.announceForAccessibilityWithOptions(stepAnnouncement(currentStep()), { queue: true });
  }, [currentStep]);

  useEffect(
    () =>
      navigation.addListener("transitionEnd", (e) => {
        if (!e.data.closing) announce();
      }),
    [navigation, announce],
  );

  const settled = state.changes > 0 && state.leaving === null;
  useEffect(() => {
    if (settled) announce();
  }, [settled, state.changes, announce]);

  // iOS swipe-back only on step 1: on steps 2-4 a right swipe means "previous".
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: step === 0 });
  }, [navigation, step]);

  /** Moves to another step with the crossfade; ignored mid-transition. Leaving step 4 drops a replay check. */
  const moveTo = useCallback(
    (target: number) => {
      if (gone.current) return;
      if (goTo(target)) cancelCheck();
    },
    [goTo, cancelCheck],
  );

  /** Back to whoever opened the guide, without marking it seen (iOS swipe-back's twin). */
  const leaveToOpener = useCallback(() => {
    gone.current = true;
    cancelCheck();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [cancelCheck]);

  /** Into the camera. The opener has already checked access; /capture shows 03 if the camera isn't allowed yet. */
  const openCamera = useCallback(() => {
    gone.current = true;
    void markCaptureGuideSeen();
    router.replace({ pathname: "/capture", params: carry });
  }, [carry]);

  // Taps during a step transition are ignored (never shown as disabled).
  const onClose = () => {
    if (gone.current || isMoving()) return;
    if (!replay) {
      // First run: skip the guide, mark it seen and open the camera.
      openCamera();
      return;
    }
    // Replay: mark it seen (it already is) and go back to the hub.
    void markCaptureGuideSeen();
    leaveToOpener();
  };

  const onStepButton = () => {
    if (gone.current || isMoving()) return;
    if (!last) moveTo(currentStep() + 1);
    else if (replay) startCheck();
    else openCamera();
  };

  // Android hardware back: the previous step, or out to the opener from step 1.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (gone.current || isMoving()) return true;
        if (currentStep() > 0) moveTo(currentStep() - 1);
        else leaveToOpener();
        return true;
      });
      return () => sub.remove();
    }, [currentStep, isMoving, leaveToOpener, moveTo]),
  );

  // Swipe: left is next (steps 1-3), right is previous (steps 2-4). Nothing
  // tracks the finger; a committed swipe runs the same crossfade. A left
  // swipe on step 4 does nothing: only the button opens the camera.
  const onSwipe = useCallback(
    (delta: number) => {
      const target = currentStep() + delta;
      if (target >= 0 && target <= LAST_STEP) moveTo(target);
    },
    [currentStep, moveTo],
  );
  const pan = usePanGesture({
    // Listed one by one: the worklets plugin can't workletize a config with a spread.
    activeOffsetX: SWIPE_OFFSETS.activeOffsetX,
    failOffsetY: SWIPE_OFFSETS.failOffsetY,
    testID: "guide-swipe",
    onDeactivate: (e) => {
      "worklet";
      if (e.canceled) return;
      const delta = swipeStep(e.translationX, e.velocityX);
      if (delta !== 0) scheduleOnRN(onSwipe, delta);
    },
  });

  // The stamp's first line is centred on Close (y 83); a wrapped stamp grows downward.
  const stampTop = Math.max(0, (hit.min - typeScale.stamp.lineHeight * fontScale) / 2);

  return (
    <View style={styles.root}>
      <BackgroundStill />
      <Grain />
      <View style={[styles.frame, { paddingBottom: insets.bottom + space.xs }]}>
        {/* Row-reverse: Close comes first for screen readers and focus, and sits on the right. */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <CloseButton accessibilityLabel={replay ? COPY.close : COPY.skip} onPress={onClose} />
          <View style={[styles.stampSlot, { marginTop: stampTop }]}>
            {layers.map((layer) => (
              <FadeLayer key={layer.step} clock={clock} layer={layer} style={layer.leftAt !== null && styles.stampLeaving}>
                <Text variant="stamp" tone="accent" align="center" accessibilityLabel={stampLabel(layer.step)}>
                  {stampText(layer.step)}
                </Text>
              </FadeLayer>
            ))}
          </View>
          {/* Balances Close, so the stamp is centred on the screen (the light table's top bar). */}
          <View style={styles.headerSpacer} />
        </View>

        <GestureDetector gesture={pan}>
          <View style={styles.swipeArea} testID="guide-swipe-area">
            <GuideArt layers={layers} clock={clock} />
            <GuideText layers={layers} clock={clock} titleRef={titleRef} />
            <View style={styles.status}>
              {check.status === "checking" ? (
                <ThinkingStates
                  lines={COPY.checkingLines}
                  tone="warm"
                  accessibilityLabel={COPY.checkingLabel}
                  showDelay={G.thinkingDelay}
                  announceOnMount
                  testID="guide-checking"
                />
              ) : check.status === "failed" ? (
                <ReplayErrorLine testID="guide-check-error" />
              ) : null}
            </View>
          </View>
        </GestureDetector>

        <StepButton last={last} busy={check.busy} onPress={onStepButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  frame: { flex: 1 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: space.xs,
    paddingHorizontal: space.gutter,
    // Keeps Close's 56 x 56 hit area inside the header (see CLOSE_SLOP).
    paddingBottom: CLOSE_SLOP,
  },
  // x 72-321 on the base device: between the spacer and Close, 4 clear of each.
  stampSlot: { flex: 1 },
  stampLeaving: { position: "absolute", top: 0, left: 0, right: 0 },
  headerSpacer: { width: hit.min },
  // y 111-762 on the base device: the swipe area, between the header and the button.
  swipeArea: { flex: 1 },
  // The 62 gap above the button (y 700-762), holding replay's status line at y 724-742.
  status: {
    minHeight: G.ctaGap,
    paddingTop: G.statusTop,
    paddingBottom: G.statusBottom,
    paddingHorizontal: space.gutter,
  },
});
