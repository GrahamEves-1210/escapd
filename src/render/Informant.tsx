// "Ask the informant" on the play screen: the matchbook in the evidence
// tray's lip opens the informant's sheet, where his tips are his lines,
// typed on paper slips beside his silhouette under a streetlight. Per mode
// he is the informant (noir), the beat cop (crime scene) or the medium
// (paranormal). The hint ladder itself is the server's (informantLadder.ts).
import { useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";
import type { Genre, Id } from "@/lib/puzzle-types";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { DarkSheet, FocusRing, SquashPressable, useFocusRing } from "@/components/noir";
import { WarningIcon } from "@/components/icons";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { ModePill } from "@/capture/ui/ModePill";
import { cluePaper } from "./materials";
import {
  askInformant, informantFor, isDry, nextLadder, visibleLadder, type InformantVoice, type Ladder,
} from "./informantLadder";
import { NoticeLine } from "./parts";

const P = ref.layout.play;
const I = P.informant;
const SLOP = (ref.hit.min - I.matchbook) / 2;

/** The matchbook in the tray's lip: the mode's accent cover, a striker along its foot. */
export function Matchbook({ genre, onPress }: { genre: Genre | null; onPress: () => void }) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  const focus = useFocusRing();
  const voice = informantFor(genre);
  return (
    <SquashPressable
      accessibilityRole="button"
      accessibilityLabel={voice.ask}
      accessibilityHint="Opens a tip. Each new tip counts as a hint."
      onPressIn={feedback.press}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      hitSlop={SLOP}
      testID="informant-ask"
      style={({ pressed }) => [styles.matchbook, { backgroundColor: theme.accent }, pressed && styles.pressed]}
    >
      <Text numberOfLines={1} style={[styles.matchbookLabel, { color: theme.accentInk }]}>{voice.ask}</Text>
      <View pointerEvents="none" style={[styles.striker, { backgroundColor: theme.accentInk }]} />
      <FocusRing visible={focus.focused} shape="panel" radius={ref.space.xs} />
    </SquashPressable>
  );
}

export interface InformantSheetProps {
  genre: Genre;
  sessionId: string | null;
  /** The steps already solved: a ladder pinned to one of them shows nothing. */
  solved: readonly Id[];
  ladder: Ladder;
  onLadder: (ladder: Ladder) => void;
  onClose: () => void;
}

/**
 * The informant's sheet. Opening it asks nothing (and costs nothing): it
 * shows the tips already given for this step. The button asks the server for
 * the next rung; his line is the server's hint, verbatim, under the mode's
 * byline. "disabled" and "no_hints" show the server's own message.
 */
export function InformantSheet({ genre, sessionId, solved, ladder, onLadder, onClose }: InformantSheetProps) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  const voice = informantFor(genre);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const visible = visibleLadder(ladder, solved);
  const lines = visible.rungs.filter(Boolean);
  const dry = isDry(visible);

  const ask = async () => {
    if (!sessionId || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const rung = lines.length + 1;
      let result = await askInformant(sessionId, rung);
      // Our count was behind (another device asked): ask for the rung the server says is next.
      if (result.status === "rung_unavailable" && result.next_rung !== null && result.next_rung !== rung) {
        result = await askInformant(sessionId, result.next_rung);
      }
      const next = nextLadder(visible, result);
      onLadder(next);
      if (result.status === "ok") {
        // His line is typed out: the typewriter cue, once per line.
        feedback.typewriter();
        AccessibilityInfo.announceForAccessibility(`${voice.lead}: ${result.hint}`);
      } else if (result.status === "disabled" || result.status === "no_hints") {
        setNotice(result.message);
      }
    } catch {
      // Offline or refused: nothing was charged that we know of; the player can ask again.
      setNotice(voice.cold);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DarkSheet
      title={voice.name}
      titleStyle="serif"
      meta={lines.length && visible.total ? `Tip ${lines.length} of ${visible.total}` : undefined}
      onClose={onClose}
      testID="informant-sheet"
      footer={dry ? undefined : (
        <ModePill
          variant="ghost"
          label={lines.length ? voice.again : voice.ask}
          onPress={ask}
          busy={busy}
          spinner
          haptic={false}
          disabled={!sessionId}
          testID="informant-request"
        />
      )}
    >
      <View style={styles.booth}>
        <Figure voice={voice} />
        <View style={styles.lines} accessibilityLiveRegion="polite">
          {lines.length === 0 ? (
            <Text style={[styles.waiting, { color: theme.inkMuted }]} testID="informant-waiting">{voice.waiting}</Text>
          ) : null}
          {lines.map((hint, i) => <SpeechSlip key={`${visible.puzzleId}-${i}`} genre={genre} lead={voice.lead} text={hint} />)}
          {dry ? <Text style={[styles.waiting, { color: theme.inkMuted }]} testID="informant-dry">{voice.dry}</Text> : null}
          {notice ? (
            <View testID="informant-notice">
              <NoticeLine icon={WarningIcon} text={notice} />
            </View>
          ) : null}
        </View>
      </View>
    </DarkSheet>
  );
}

/** One of his lines: the byline stamped small, then the tip typed on a paper slip, in quotes. */
function SpeechSlip({ genre, lead, text }: { genre: Genre; lead: string; text: string }) {
  const { reducedMotion } = useTheme();
  const paper = cluePaper(genre);
  return (
    <Animated.View
      entering={FadeIn.duration(reducedMotion ? motion.reducedFade : 260)}
      style={[styles.slip, { backgroundColor: paper.paper }]}
      accessible
      accessibilityLabel={`${lead}: ${text}`}
      testID="informant-line"
    >
      <Text style={[styles.byline, { color: paper.inkMuted }]}>{lead}</Text>
      <Text style={[styles.line, { color: paper.ink }]}>
        {"“"}
        <Text testID="informant-hint">{text}</Text>
        {"”"}
      </Text>
    </Animated.View>
  );
}

/** His silhouette, backlit by a streetlight in the mode's colour: a fedora, a peaked cap, or a medium's veil. */
function Figure({ voice }: { voice: InformantVoice }) {
  const theme = useModeTheme();
  const s = I.figure;
  const light = theme.glow ?? theme.stamp;
  return (
    <View style={[styles.figure, { backgroundColor: theme.raised, borderColor: theme.rim }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`informant-figure-${voice.figure}`}>
      <Svg width={s} height={s} viewBox="0 0 64 64">
        <Defs>
          <RadialGradient id="streetlight" cx="50%" cy="30%" r="60%">
            <Stop offset="0" stopColor={light} stopOpacity={I.glow * 2} />
            <Stop offset="1" stopColor={light} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={32} cy={22} r={30} fill="url(#streetlight)" />
        {voice.figure === "veil" ? (
          <>
            <Path d="M13 64 C13 40 19 13 32 13 C45 13 51 40 51 64 Z" fill={theme.ground} />
            <Circle cx={32} cy={55} r={7} fill={theme.ground} stroke={light} strokeOpacity={0.8} strokeWidth={1} />
          </>
        ) : (
          <>
            <Path d="M7 64 C9 49 21 44 32 44 C43 44 55 49 57 64 Z" fill={theme.ground} />
            <Circle cx={32} cy={32} r={10} fill={theme.ground} />
            <Path d="M28 40 L36 40 L35 46 L29 46 Z" fill={theme.ground} />
            {voice.figure === "fedora" ? (
              <>
                <Ellipse cx={32} cy={24} rx={17} ry={3.5} fill={theme.ground} />
                <Path d="M22 24 C22 14 26 11 32 11 C38 11 42 14 42 24 Z" fill={theme.ground} />
              </>
            ) : (
              <>
                <Path d="M21 25 L22 15 C26 11 38 11 42 15 L43 25 Z" fill={theme.ground} />
                <Path d="M20 25 L44 25 L47 29 L24 28 Z" fill={theme.ground} />
              </>
            )}
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  matchbook: {
    height: I.matchbook,
    paddingHorizontal: I.matchbookPadX,
    paddingBottom: I.striker,
    justifyContent: "center",
    borderRadius: ref.space.xs,
    ...ref.curve,
    overflow: "hidden",
  },
  matchbookLabel: { ...P.type.matchbook },
  striker: { position: "absolute", left: 0, right: 0, bottom: 0, height: I.striker, opacity: I.strikerOpacity },
  pressed: { opacity: P.pressedOpacity },
  booth: { flexDirection: "row", alignItems: "flex-start", gap: I.gap },
  figure: {
    width: I.figure + ref.space.sm * 2,
    height: I.figure + ref.space.sm * 2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: ref.space.sm,
    ...ref.curve,
    borderWidth: P.hairline,
    overflow: "hidden",
  },
  lines: { flex: 1, gap: ref.space.sm },
  waiting: { ...P.type.noteSmall },
  slip: {
    gap: ref.space.xs,
    paddingHorizontal: P.clue.pad,
    paddingVertical: ref.space.sm + ref.space.xs,
    borderRadius: ref.space.xs / 2,
    transform: [{ rotate: `${P.clue.tilt}deg` }],
  },
  byline: { ...P.type.plate },
  line: { ...P.type.note },
});
