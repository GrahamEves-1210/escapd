// 06 · Building your case: the wait itself, and the moment it's ready.
// Nothing on screen but the room (RoomPanorama: the player's photos turning
// under a torch beam), one short title in the mode's display face and one
// status line under it (the kit's ThinkingStates at "status" size, its sweep
// in the mode's colours). A quiet way out sits in the header: the camera's
// square button, which goes home; the case keeps building and home's
// Continue comes back to it. Android's back does the same. While the photos
// are still sending there is no way out (they must all go first), as before.
//
// Ready is the reward: the drift settles and the lights come up, CASE READY
// slams onto the room in the mode's stamp colour (`stamp`), `success` follows
// it, and only then does "Open the case" (the guide's pill, `thud`) fade in at
// the foot, where its space was kept all along so nothing jumps.
//
// Sound: `typewriter` when the status
// changes meaning (queued, building, trying again), never on the rotating
// lines or a photo count, and never twice within cue.typewriterGap.
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCapturePalette } from "@/capture/ui/palette";
import { SquareButton } from "@/capture/ui/rangefinder/SquareButton";
import { XIcon } from "@/components/icons";
import { ThinkingStates } from "@/components/noir";
import { StateActions, type StateAction } from "@/components/StateScreen";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { PeekingCat, type CatReaction } from "@/play2/PeekingCat";
import { Stamp } from "@/render/Stamp";
import { useTheme } from "@/theme/ThemeProvider";
import { ctaBottomPad, ref } from "@/theme/tokens";
import { BUILD_TITLE, READY_LINE, READY_TITLE, STAMP_TEXT, waitStatus, type WaitStage } from "./copy";
import { RoomPanorama, type PanoramaPhoto } from "./RoomPanorama";

const D = ref.layout.develop;
const SQ = ref.button.square;
const NUDGE = ref.layout.play.complete.slam.nudge;
/** The typewriter cue's minimum spacing, in ms: a change of meaning, at most this often. */
export const TYPEWRITER_GAP = 4000;
export const LEAVE_LABEL = "Leave. Your case keeps building.";
export const HOME_LABEL = "Back to home";

const TITLE_IN = FadeIn.duration(ref.motion.treatment.duration).reduceMotion(ReduceMotion.Never);
const PILL_IN = FadeIn.duration(D.ready.pillFade).reduceMotion(ReduceMotion.Never);

export function BuildWait({ stage, photos, onLeave, open }: {
  stage: WaitStage | { kind: "ready"; roomId: string };
  photos: readonly PanoramaPhoto[];
  /** Home, with the case still building (or ready) for home's Continue. */
  onLeave: () => void;
  /** Open the case: the guide's pill, once the stamp has landed. */
  open: StateAction;
}) {
  const insets = useSafeAreaInsets();
  const palette = useCapturePalette();
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const ready = stage.kind === "ready";
  const sending = stage.kind === "sending";
  const status = stage.kind === "ready" ? null : waitStatus(stage, palette.genre);


  // Android's back is the close square: home, the case still building. Not while photos send.
  useFocusEffect(
    useCallback(() => {
      if (sending) return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        onLeave();
        return true;
      });
      return () => subscription.remove();
    }, [sending, onLeave]),
  );

  // The typewriter: when the status changes meaning, not on mount, at most every TYPEWRITER_GAP.
  const phase = status?.phase ?? "ready";
  const lastPhase = useRef(phase);
  const lastTyped = useRef(-Infinity);
  useEffect(() => {
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    if (phase === "ready" || phase === "sending") return;
    const now = Date.now();
    if (now - lastTyped.current < TYPEWRITER_GAP) return;
    lastTyped.current = now;
    feedback.typewriter();
  }, [phase, feedback]);

  // Ready: the stamp lands (its own `stamp` cue), success after it, then the pill.
  const [landed, setLanded] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // As the stamp hits, the room jolts down and shakes once (case closed's nudge).
  const nudgeX = useSharedValue(0);
  const nudgeY = useSharedValue(0);
  const nudgeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: nudgeX.get() }, { translateY: nudgeY.get() }] }));
  // Success follows the stamp's own cue.
  const succeed = useCallback(() => {
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => feedback.success(), D.ready.success);
  }, [feedback]);
  // The cat peers over the room while the case is built, thinking, and cheers the stamp.
  const [catReaction, setCatReaction] = useState<CatReaction>(null);
  const still = { x: useSharedValue(0.5), y: useSharedValue(0.5) };
  const land = () => {
    setCatReaction({ kind: "found", at: Date.now() });
    const { x, y, step } = NUDGE;
    const t = (to: number) => withTiming(to, { duration: step });
    nudgeY.set(withSequence(t(y), t(-y / 2), t(0)));
    nudgeX.set(withSequence(t(x), t(-x), t(x / 2), t(0)));
    succeed();
    setLanded(true);
  };
  useEffect(() => () => {
    if (successTimer.current) clearTimeout(successTimer.current);
  }, []);
  // Reduced motion: the stamp is simply there and the pill with it; the stamp's cue and success still come, in order.
  useEffect(() => {
    if (!ready || !reducedMotion) return;
    feedback.stamp();
    succeed();
  }, [ready, reducedMotion, feedback, succeed]);
  const showOpen = ready && (landed || reducedMotion);

  const titleSize = D.titleSize[palette.genre ?? "shell"];
  const title = ready ? READY_TITLE : BUILD_TITLE;
  const colors = { base: palette.inkMuted, highlight: palette.genre ? palette.stamp : palette.ink, still: palette.inkMuted };
  const foot = ref.layout.state.footer.pad + ref.button.ghost.height + ctaBottomPad(insets.bottom);

  return (
    <View style={[styles.root, { backgroundColor: palette.page, paddingTop: insets.top }]} testID="darkroom-root">
      <View style={styles.header}>
        {sending ? null : (
          <SquareButton icon={XIcon} accessibilityLabel={ready ? HOME_LABEL : LEAVE_LABEL} onPress={onLeave} testID="build-close" />
        )}
      </View>
      <View style={styles.column}>
        <Animated.View style={[styles.stage, nudgeStyle]}>
          <RoomPanorama photos={photos} ready={ready} style={styles.room} />
          <View style={styles.cat} pointerEvents="box-none">
            <PeekingCat width={60} beamX={still.x} beamY={still.y} frame={null} reaction={catReaction} mood={ready ? "idle" : "thinking"} />
          </View>
          {ready ? (
            <View style={styles.stampSlot} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Stamp
                text={STAMP_TEXT}
                size="large"
                slam={!reducedMotion}
                delay={D.ready.stampDelay}
                onLanded={land}
                testID="build-stamp"
              />
            </View>
          ) : null}
        </Animated.View>
        <Animated.Text
          key={title}
          entering={ready ? TITLE_IN : undefined}
          style={[styles.title, { ...theme.display, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.22), color: palette.ink }]}
          accessibilityRole="header"
          testID="build-title"
        >
          {title}
        </Animated.Text>
        <View style={styles.status}>
          {status ? (
            <ThinkingStates
              variant="status"
              lines={status.lines}
              sizeTo={status.sizeTo}
              colors={colors}
              hold={D.status.hold}
              accessibilityLabel={status.label}
              testID="build-status"
              style={styles.line}
            />
          ) : (
            <Animated.View entering={TITLE_IN} accessibilityLiveRegion="polite" testID="build-status-ready">
              <Text style={[styles.readyLine, { color: palette.inkMuted }]}>{READY_LINE}</Text>
            </Animated.View>
          )}
        </View>
      </View>
      <View style={[styles.foot, { height: foot }]}>
        {showOpen ? (
          <Animated.View entering={PILL_IN}>
            <StateActions primary={open} bottom={insets.bottom} />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: D.header.top + SQ.size, paddingTop: D.header.top, paddingHorizontal: D.header.edge, flexDirection: "row", alignItems: "flex-start" },
  column: { flex: 1, justifyContent: "center", paddingHorizontal: ref.space.edge, paddingTop: D.header.below },
  stage: { flexShrink: 1, flexGrow: 1, maxHeight: D.frame.maxHeight, minHeight: D.frame.minHeight, justifyContent: "center" },
  room: { flex: 1 },
  cat: { position: "absolute", right: ref.space.lg, bottom: "100%" },
  stampSlot: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  title: { textAlign: "center", marginTop: D.gap.title },
  status: { marginTop: D.gap.status, minHeight: ref.type.status.lineHeight, alignSelf: "stretch", alignItems: "center" },
  line: { alignSelf: "stretch" },
  readyLine: { ...ref.type.status, textAlign: "center" },
  foot: { justifyContent: "flex-end" },
});
