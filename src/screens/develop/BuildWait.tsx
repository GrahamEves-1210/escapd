// 06 · Building your case: the wait itself, and the moment it's ready. The
// screen is a darkroom (Darkroom.tsx): the player's own photos lie in a tray
// of developer under a red safelight, blank as each is sent, their pictures
// coming up while the case is built, and the cat behind the bench watches
// them. Under it, one small title in the mode's display face, and nothing
// else unless the room can't say it (a second try: one handwritten line). A
// quiet way out sits in the header: the camera's square button, which goes
// home; the case keeps building and home's Continue comes back to it.
// Android's back does the same. While the photos are still sending there is
// no way out (they must all go first), as before.
//
// Ready is the reward: the prints are lifted out and pegged on the line, the
// lights come up on them, a gold-foil CASE READY seal is pressed onto the
// picture (`stamp`), the cat cheers, `success` follows it, and only then does
// "Open the case" (the guide's pill, `thud`) fade in at the foot, where its
// space was kept all along so nothing jumps.
//
// Screen readers can't see the room: the status (a polite live region) tells
// them each wait in full.
//
// Sound: `typewriter` when the status changes meaning (queued, building,
// trying again), never for a photo count, and never twice within
// TYPEWRITER_GAP.
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCapturePalette } from "@/capture/ui/palette";
import { SquareButton } from "@/capture/ui/rangefinder/SquareButton";
import { XIcon } from "@/components/icons";
import { StateActions, type StateAction } from "@/components/StateScreen";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { PeekingCat, type CatReaction } from "@/play2/PeekingCat";
import { FoilSeal } from "@/render/keepsake";
import { handType } from "@/theme/payoff";
import { useTheme } from "@/theme/ThemeProvider";
import { ctaBottomPad, ref } from "@/theme/tokens";
import { BUILD_TITLE, READY_TITLE, STAMP_TEXT, waitStatus, type WaitStage } from "./copy";
import { Darkroom, type DarkroomPhoto } from "./Darkroom";

const D = ref.layout.develop;
const SQ = ref.button.square;
const NUDGE = ref.layout.play.complete.slam.nudge;
/** The typewriter cue's minimum spacing, in ms: a change of meaning, at most this often. */
export const TYPEWRITER_GAP = 4000;
export const LEAVE_LABEL = "Leave. Your case keeps building.";
export const HOME_LABEL = "Back to home";

/** The ready seal across. */
const SEAL = 132;
/** The title: small, in the mode's display face (its capitals carry it), one line at 375. */
export const TITLE_SIZE = { shell: 16, noir: 16, crime_scene: 14, paranormal: 19 } as const;
/** The one line under it, handwritten. */
const STATUS_SIZE = 17;
const STATUS_LINE = 22;
const LINE_IN = FadeIn.duration(360).reduceMotion(ReduceMotion.Never);

/**
 * The status. Screen readers hear `label` through a polite live region (they
 * can't see the room). On screen it is empty unless there is a `line` the
 * room can't show (a second try): then that line, handwritten, three dots
 * being written after it (still under reduced motion).
 */
function HandStatus({ line, color, label, reduced }: {
  line: string | null;
  color: string;
  label: string;
  reduced: boolean;
}) {
  const text = handType(STATUS_SIZE, STATUS_LINE);
  return (
    <View
      style={styles.statusLine}
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      testID="build-status"
    >
      {line ? (
        <Animated.View key={line} entering={LINE_IN} style={styles.statusRow}>
          <Text style={[text, { color }]} numberOfLines={1}>{line}</Text>
          <Dots style={text} color={color} reduced={reduced} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Three dots, written one after another and rubbed out again. */
function Dots({ style, color, reduced }: { style: object; color: string; reduced: boolean }) {
  const t = useSharedValue(reduced ? 3 : 0);
  useEffect(() => {
    if (reduced) return;
    t.set(withRepeat(withTiming(4, { duration: 1800 }), -1, false));
  }, [reduced, t]);
  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((i) => <Dot key={i} t={t} index={i} style={style} color={color} />)}
    </View>
  );
}

function Dot({ t, index, style, color }: { t: SharedValue<number>; index: number; style: object; color: string }) {
  const shown = useAnimatedStyle(() => ({ opacity: Math.floor(t.get()) > index ? 1 : 0 }));
  return <Animated.Text style={[style, { color }, shown]}>.</Animated.Text>;
}

const TITLE_IN = FadeIn.duration(ref.motion.treatment.duration).reduceMotion(ReduceMotion.Never);
const PILL_IN = FadeIn.duration(D.ready.pillFade).reduceMotion(ReduceMotion.Never);

export function BuildWait({ stage, photos, onLeave, open }: {
  stage: WaitStage | { kind: "ready"; roomId: string };
  photos: readonly DarkroomPhoto[];
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
  const status = stage.kind === "ready" ? null : waitStatus(stage);

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
  // The cat watches the tray from behind the bench while the case is built, and cheers the stamp.
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

  const titleSize = TITLE_SIZE[palette.genre ?? "shell"];
  const title = ready ? READY_TITLE : BUILD_TITLE;
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
          <Darkroom
            photos={photos}
            sent={stage.kind === "sending" ? stage.sent : photos.length}
            developing={status?.phase === "running"}
            ready={ready}
            style={styles.room}
            seal={ready ? (
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <FoilSeal
                  text={STAMP_TEXT}
                  foil={theme.foil}
                  size={SEAL}
                  fontSize={20}
                  tilt={-8}
                  slam={!reducedMotion}
                  delay={D.ready.stampDelay}
                  reduced={reducedMotion}
                  onLanded={() => {
                    feedback.stamp();
                    land();
                  }}
                  testID="build-stamp"
                />
              </View>
            ) : null}
          >
            {({ width, look }) => (
              <PeekingCat width={width} beamX={still.x} beamY={still.y} frame={null} reaction={catReaction} lookAt={look} />
            )}
          </Darkroom>
        </Animated.View>
        <Animated.Text
          key={title}
          entering={ready ? TITLE_IN : undefined}
          style={[styles.title, { ...theme.display, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.3), color: palette.ink }]}
          accessibilityRole="header"
          testID="build-title"
        >
          {title}
        </Animated.Text>
        <View style={styles.status}>
          {status ? (
            <HandStatus line={status.line} color={palette.inkMuted} label={status.label} reduced={reducedMotion} />
          ) : (
            // Ready: the title says it; this tells a screen reader the wait is over.
            <View accessible accessibilityLabel={READY_TITLE} accessibilityLiveRegion="polite" testID="build-status-ready" />
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
  title: { textAlign: "center", marginTop: 18 },
  statusLine: { alignSelf: "stretch", alignItems: "center", minHeight: STATUS_LINE },
  statusRow: { flexDirection: "row", alignItems: "baseline" },
  dots: { flexDirection: "row", width: 16 },
  status: { marginTop: 4, minHeight: STATUS_LINE, alignSelf: "stretch", alignItems: "center" },
  foot: { justifyContent: "flex-end" },
});
