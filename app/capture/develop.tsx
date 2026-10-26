// The darkroom: sends the plates, then follows the case while the server
// develops it. Opened with ?roomId=<id> it follows a case already in progress.
// Every state here comes from the server's job row; nothing is guessed. While
// a real wait runs, the painted glass drifts over the plates with a thinking
// line under it (src/screens/develop, ref.layout.develop). Reference look:
// 07's ground and tiles in miniature, 01's tag pill, title and subtitle, and
// the state screen's pinned band (white bar, quiet text button).
// Inside a mode (openCapture({ genre }) sets it) every state takes the mode's
// colours (src/capture/ui/palette.ts, src/screens/develop/ModeState.tsx):
// its ground, ink and muted ink, the stamp in the mode's stamp colour, the
// bar as the mode's primary button, and the photos in the mode's baked
// treatment.
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { encodeFlags } from "@/capture/failure";
import { clearPlates, usePlates, useSlots } from "@/capture/roll";
import { useDevelopment } from "@/capture/useDevelopment";
import { useCapturePalette } from "@/capture/ui/palette";
import { useFeedback } from "@/game/feedback";
import { formatDuration } from "@/game/format";
import { waitingCopy, type WaitLine } from "@/screens/develop/copy";
import { DarkroomHero } from "@/screens/develop/DarkroomHero";
import { DevelopActions, DevelopStateScreen } from "@/screens/develop/ModeState";
import { PlateStrip } from "@/screens/develop/PlateStrip";
import { ref } from "@/theme/tokens";
import { trackingPad } from "@/components/noir";
import type { StateAction } from "@/components/StateScreen";

const L = ref.layout.develop;
const S = ref.layout.state;
const TAG = ref.button.gameCard;

export default function DarkroomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  const { stage, retry } = useDevelopment(roomId || undefined);
  const plates = usePlates();
  // The strip numbers each photo by its slot, so a removed photo leaves a gap in the numbers, not a renumbering.
  const slots = useSlots();
  const numbered = slots.flatMap((plate, slot) => (plate ? [{ uri: plate.uri, number: slot + 1 }] : []));
  const feedback = useFeedback();

  // Coming back from the account screen: check again.
  const awaitingAccount = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!awaitingAccount.current) return;
    awaitingAccount.current = false;
    retry();
  }, [retry]));
  const addEmail = () => {
    awaitingAccount.current = true;
    router.push({ pathname: "/account", params: { next: "back" } });
  };

  useEffect(() => {
    if (stage.kind === "ready") feedback.success();
    if (stage.kind === "failed") feedback.warning();
  }, [stage.kind, feedback]);

  // A tick each time a photo finishes sending (the count steps), never on mount.
  const sentCount = stage.kind === "sending" ? stage.sent : null;
  const lastSent = useRef(sentCount);
  useEffect(() => {
    const before = lastSent.current;
    lastSent.current = sentCount;
    if (sentCount !== null && before !== null && sentCount > before) feedback.tick();
  }, [sentCount, feedback]);

  const home = () => router.replace("/");
  const back = () => (router.canGoBack() ? router.back() : home());

  switch (stage.kind) {
    case "checking":
      return <DevelopStateScreen title="One moment" loading />;
    case "account":
      return (
        <DevelopStateScreen
          title="Keep your cases on an account"
          body="Cases you build are saved to your account so they're never lost. Add an email and confirm it, then build."
          primary={{ label: "Add your email", onPress: addEmail }}
          secondary={{ label: "Back to your photos", onPress: back }}
        />
      );
    case "access":
      return stage.reason === "entitlement" ? (
        <DevelopStateScreen
          title="Your own rooms are part of ESCAPD Pro"
          body="Pro isn't on sale in this test build. If you're testing, ask for test access for your account, then try again."
          primary={{ label: "Try again", onPress: () => retry() }}
          secondary={{ label: "Back to your photos", onPress: back }}
        />
      ) : (
        <DevelopStateScreen
          title="You've built every case this month allows"
          body="Your allowance comes back over the next few days. Your photos stay on this phone until you close the app."
          primary={{ label: "Back to home", onPress: home }}
        />
      );
    case "error":
      return (
        <DevelopStateScreen
          title="The case didn't go through"
          body={stage.message}
          primary={{ label: "Try again", onPress: () => retry() }}
          secondary={{ label: "Back to your photos", onPress: back }}
        />
      );
    case "failed": {
      const { copy } = stage;
      const retake = () => {
        // Back to the photos with each flagged photo's reason (?flag=0:person,2:private_text)
        // and, for a failure about the whole set, its note (?issue=too_few_objects).
        if (plates.length) {
          router.dismissTo({
            pathname: "/capture/review",
            params: { flag: encodeFlags(copy.flagged), ...(copy.issue ? { issue: copy.issue } : {}) },
          });
        } else {
          clearPlates();
          router.replace("/capture");
        }
      };
      return (
        <DevelopStateScreen
          title={copy.title}
          body={copy.body}
          primary={copy.action === "retake" ? { label: plates.length ? "Retake photos" : "Take the photos again", onPress: retake }
            : copy.action === "retry" ? { label: "Try again", onPress: () => retry(stage.roomId) }
            : { label: "Back to home", onPress: home }}
          secondary={copy.action === "later" ? undefined : { label: "Back to home", onPress: home }}
        />
      );
    }
    case "ready":
      return (
        <Darkroom
          stamp="CASE READY"
          title="Your case is ready"
          body="Everything you need is somewhere in your photos."
          plates={numbered}
          developed
          primary={{
            label: "Open the case",
            testID: "open-case",
            // Committing to play: the weighty press.
            haptic: "thud",
            onPress: () => {
              clearPlates();
              router.replace(`/play/${stage.roomId}`);
            },
          }}
        />
      );
    case "sending":
    case "waiting": {
      const { thinking, ...copy } = waitingCopy(stage);
      return (
        <Darkroom
          {...copy}
          wait={thinking}
          plates={numbered}
          sent={stage.kind === "sending" ? stage.sent : plates.length}
          since={stage.kind === "waiting" ? stage.job.created_at : undefined}
          secondary={stage.kind === "waiting" ? { label: "Leave it building", onPress: home } : undefined}
        />
      );
    }
  }
}

function Darkroom({ stamp, title, body, plates, sent, developed, since, wait, primary, secondary }: {
  stamp: string;
  title: string;
  body: string;
  plates: readonly { uri: string; number?: number }[];
  sent?: number;
  developed?: boolean;
  since?: string;
  /** Only during a real wait: the drifting glass over the plates and this thinking line under it (they replace the spinner). */
  wait?: WaitLine;
  /** The white bar (Open the case). */
  primary?: StateAction;
  /** The quiet text button (Leave it building). */
  secondary?: StateAction;
}) {
  const insets = useSafeAreaInsets();
  const palette = useCapturePalette();
  const strip = plates.length ? <PlateStrip plates={plates} sent={sent} developed={developed} /> : null;
  const hero = strip || wait;
  return (
    <View style={[styles.root, { backgroundColor: palette.page, paddingTop: insets.top }]} testID="darkroom-root">
      <View style={styles.center}>
        {hero ? <DarkroomHero wait={wait}>{strip}</DarkroomHero> : null}
        {/* The thinking line is its own polite live region, so it sits outside this one. */}
        <View style={[styles.copy, hero ? styles.copyUnderHero : null]} accessibilityLiveRegion="polite">
          <Stamp label={stamp} />
          <Text style={[styles.title, { color: palette.ink }]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted }]}>{body}</Text>
        </View>
        {/* Outside the live region, so the clock's ticks aren't read out (TalkBack). */}
        {since ? <Elapsed since={since} /> : null}
      </View>
      <DevelopActions primary={primary} secondary={secondary} bottom={insets.bottom} />
    </View>
  );
}

/** 01's tag pill as the stamp: no fill, a 1 pt rim, ref.type.tag in textLabel. In a mode, rim and text in the mode's stamp colour. */
function Stamp({ label }: { label: string }) {
  const palette = useCapturePalette();
  return (
    <View style={[styles.stamp, { borderColor: palette.stampRim }]} testID="darkroom-stamp">
      <Text style={[styles.stampText, { color: palette.stamp }, trackingPad(ref.type.tag)]}>{label}</Text>
    </View>
  );
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  const palette = useCapturePalette();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const ms = Math.max(0, now - new Date(since).getTime());
  return (
    <View style={[styles.clock, { backgroundColor: palette.well }]} testID="darkroom-elapsed">
      <Text style={[styles.clockText, { color: palette.inkMuted }]} accessibilityLabel={`Elapsed ${formatDuration(ms)}`}>
        {formatDuration(ms)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The flat ground: the palette's page.
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: ref.space.edge },
  copy: { alignSelf: "stretch", alignItems: "center", paddingHorizontal: S.textInset - ref.space.edge },
  copyUnderHero: { marginTop: L.gap.copy },
  stamp: {
    minHeight: TAG.tagHeight,
    // The 9 to the text includes the 1 pt stroke.
    paddingHorizontal: TAG.tagPadX - L.plate.rim,
    paddingVertical: (TAG.tagHeight - ref.type.tag.lineHeight) / 2 - L.plate.rim,
    borderWidth: L.plate.rim,
    borderRadius: TAG.tagRadius,
    justifyContent: "center",
  },
  stampText: { ...ref.type.tag, textAlign: "center" },
  title: { ...ref.type.title, textAlign: "center", marginTop: L.gap.title },
  body: { ...ref.type.subtitle, textAlign: "center", marginTop: L.gap.body },
  clock: {
    minHeight: L.clock.height,
    paddingHorizontal: L.clock.padX,
    marginTop: L.gap.clock,
    borderRadius: ref.radius.round,
    justifyContent: "center",
  },
  clockText: { ...ref.type.meta, textAlign: "center" },
});
