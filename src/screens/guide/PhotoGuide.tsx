// 04 · Photo guide (docs/DESIGN.md), in Apple Health's look
// (docs/refs/04-photo-tutorial.png). Four steps on pure black: the light grey
// glass close disc at the top right, one line drawing floating in the middle,
// then a bold white title over a regular grey instruction and one dark
// hairline pill. No step label on screen (the reference has none): screen
// readers hear "Step n of 4" when a step opens and in the button's hint.
// It shows before every new room (openCapture always opens it), and both the
// last step continues to the camera; the X goes back to the menu. Opened directly
// (/capture/guide?replay=1, with no access check behind it), that continue
// runs the access check first (useReplayCheck).
//
// Layout on 393 x 852 (safe 59 / 34), top to bottom: the close disc at
// x 311-361, y 69-119; the drawing at y 266-532; the title (613-641) and body
// (644-700), bottom-anchored; a 62 gap that holds the check's status line
// (723-739); the pill at 762-814; then safe bottom + ref.space.ctaBottom.
// Large text grows the block upward from 814.
// Inside a mode (openCapture({ genre }) sets it) the guide takes the mode's
// colours (src/capture/ui/palette.ts): its ground, ink and muted ink, the
// close disc in its muted ink, and the step button as the mode's primary
// button. The line drawings keep their greys.
import { useCallback, useEffect, useRef } from "react";
import { AccessibilityInfo, BackHandler, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { router, useFocusEffect, useNavigation, type NativeStackNavigationProp } from "expo-router";
import { markCaptureGuideSeen } from "@/capture/guideSeen";
import { useCapturePalette } from "@/capture/ui/palette";
import { useFeedback } from "@/game/feedback";
import { ThinkingStates } from "@/components/noir";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { CloseButton } from "./CloseButton";
import { COPY, LAST_STEP, STEPS, stepAnnouncement } from "./copy";
import { GuideArt } from "./GuideArt";
import { GuideText, type TitleRef } from "./GuideText";
import { ReplayErrorLine } from "./ReplayErrorLine";
import { StepButton } from "./StepButton";
import { layersOf, useStepper } from "./stepper";
import { SWIPE_OFFSETS, swipeStep } from "./swipe";
import { useReplayCheck } from "./useReplayCheck";

const G = ref.layout.guide;

/** The route's search params, as expo-router hands them over. */
export type GuideParams = Record<string, string | string[] | undefined>;

export interface PhotoGuideProps {
  /** Opened directly, with no access check behind it (/capture/guide?replay=1): the continue checks access first. */
  replay: boolean;
  /** The route's other params, carried on to /capture. */
  carry: GuideParams;
}

export function PhotoGuide({ replay, carry }: PhotoGuideProps) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const palette = useCapturePalette();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const { state, clock, goTo, isMoving, currentStep } = useStepper(
    STEPS.length,
    reducedMotion ? motion.reducedFade : motion.sceneCrossfade,
  );
  // Set once the guide navigates away (or its access check does), so no later
  // tap, swipe or back press can navigate a second time.
  const gone = useRef(false);
  const markGone = useCallback(() => {
    gone.current = true;
  }, []);
  const check = useReplayCheck(markGone);
  const { cancel: cancelCheck, start: startCheck } = check;
  const titleRef = useRef<TitleRef>(null);

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

  /**
   * Moves to another step with the crossfade; ignored mid-transition. Leaving
   * step 4 drops a running access check. A step that really changes (Next, a
   * swipe, Android back) gives the light `tick` haptic.
   */
  const moveTo = useCallback(
    (target: number) => {
      if (gone.current) return;
      if (goTo(target)) {
        feedback.tick();
        cancelCheck();
      }
    },
    [goTo, cancelCheck, feedback],
  );

  /** Back to whoever opened the guide, without marking it shown (iOS swipe-back's twin). */
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

  /** On to the camera: straight there after openCapture's check, or through the check when opened directly. */
  const continueToCamera = () => {
    if (replay) startCheck();
    else openCamera();
  };

  // Taps during a step transition are ignored (never shown as disabled). The
  // X leaves: back to the menu. The camera is only ever reached by the steps.
  const onClose = () => {
    if (gone.current || isMoving()) return;
    gone.current = true;
    router.dismissTo("/");
  };

  const onStepButton = () => {
    if (gone.current || isMoving()) return;
    if (!last) moveTo(currentStep() + 1);
    else continueToCamera();
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

  return (
    <View style={[styles.root, { backgroundColor: palette.well, paddingBottom: insets.bottom + ref.space.ctaBottom }]} testID="guide-root">
      <View style={[styles.header, { paddingTop: insets.top + G.close.top }]}>
        <CloseButton accessibilityLabel={COPY.skip} onPress={onClose} />
      </View>

      <GestureDetector gesture={pan}>
        <View style={styles.swipeArea} testID="guide-swipe-area">
          <GuideArt layers={layers} clock={clock} />
          <GuideText layers={layers} clock={clock} titleRef={titleRef} />
          <View style={styles.status}>
            {check.status === "checking" ? (
              <ThinkingStates
                lines={COPY.checkingLines}
                variant="meta"
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

      <StepButton step={step} last={last} busy={check.busy} onPress={onStepButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Pure black (the palette's well), as the reference: no still, grain or glow.
  root: { flex: 1 },
  // The disc's outer edge 10 below the safe top and 32 from the right edge.
  header: { flexDirection: "row", justifyContent: "flex-end", paddingRight: G.close.right },
  // y 119-762 on the base device: the swipe area, between the disc and the pill.
  swipeArea: { flex: 1 },
  // The 62 gap above the pill (y 700-762), holding the check's status line at y 723-739.
  status: {
    minHeight: G.ctaGap,
    paddingTop: G.statusTop,
    paddingBottom: G.statusBottom,
    paddingHorizontal: ref.space.reading,
  },
});
