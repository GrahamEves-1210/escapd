// The darkroom: sends the plates, then follows the case while the server
// develops it. Opened with ?roomId=<id> it follows a case already in progress.
// Every state here comes from the server's job row; nothing is guessed.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { clearPlates, usePlates } from "@/capture/roll";
import { promptFor } from "@/capture/slots";
import { useDevelopment, type DevStage } from "@/capture/useDevelopment";
import { useFeedback } from "@/game/feedback";
import { formatDuration } from "@/game/format";
import type { GenerationJob } from "@/lib/escapd-api";
import { color, curve, radius, space } from "@/theme/tokens";
import { Button } from "@/components/Button";
import { Grain } from "@/components/Grain";
import { StateScreen } from "@/components/StateScreen";
import { Text } from "@/components/Text";

export default function DarkroomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  const { stage, retry } = useDevelopment(roomId || undefined);
  const plates = usePlates();
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

  const home = () => router.replace("/");
  const back = () => (router.canGoBack() ? router.back() : home());

  switch (stage.kind) {
    case "checking":
      return <StateScreen title="Opening the darkroom" loading />;
    case "account":
      return (
        <StateScreen
          title="Keep your cases on an account"
          body="Cases you develop are saved to your account so they're never lost. Add an email and confirm it, then develop."
          primary={{ label: "Add your email", onPress: addEmail }}
          secondary={{ label: "Back to the light table", onPress: back }}
        />
      );
    case "access":
      return stage.reason === "entitlement" ? (
        <StateScreen
          title="Your own rooms are part of ESCAPD Pro"
          body="Pro isn't on sale in this test build. If you're testing, ask for test access for your account, then try again."
          primary={{ label: "Try again", onPress: () => retry() }}
          secondary={{ label: "Back to the light table", onPress: back }}
        />
      ) : (
        <StateScreen
          title="You've developed every case this month allows"
          body="Your allowance comes back over the next few days. Your plates stay on this phone until you close the app."
          primary={{ label: "Back to the title", onPress: home }}
        />
      );
    case "error":
      return (
        <StateScreen
          title="The case didn't go through"
          body={stage.message}
          primary={{ label: "Try again", onPress: () => retry() }}
          secondary={{ label: "Back to the light table", onPress: back }}
        />
      );
    case "failed": {
      const { copy } = stage;
      const retake = () => {
        if (plates.length) router.dismissTo({ pathname: "/capture/review", params: { flag: copy.plates.join(",") } });
        else {
          clearPlates();
          router.replace("/capture");
        }
      };
      return (
        <StateScreen
          title={copy.title}
          body={copy.body}
          primary={copy.action === "retake" ? { label: plates.length ? "Retake plates" : "Photograph the room again", onPress: retake }
            : copy.action === "retry" ? { label: "Try again", onPress: () => retry(stage.roomId) }
            : { label: "Back to the title", onPress: home }}
          secondary={copy.action === "later" ? undefined : { label: "Back to the title", onPress: home }}
        />
      );
    }
    case "ready":
      return (
        <Darkroom
          stamp="CASE DEVELOPED"
          title="Your room is a case now"
          body="Everything you need is somewhere in the plates."
          plates={plates}
          developed
          footer={(
            <Button
              label="Open the case"
              testID="open-case"
              onPress={() => {
                clearPlates();
                router.replace(`/play/${stage.roomId}`);
              }}
            />
          )}
        />
      );
    case "sending":
    case "waiting":
      return (
        <Darkroom
          {...waitingCopy(stage)}
          plates={plates}
          sent={stage.kind === "sending" ? stage.sent : plates.length}
          since={stage.kind === "waiting" ? stage.job.created_at : undefined}
          footer={stage.kind === "waiting" ? (
            <Button label="Leave it developing" variant="quiet" onPress={home} />
          ) : null}
        />
      );
  }
}

function waitingCopy(stage: Extract<DevStage, { kind: "sending" | "waiting" }>) {
  if (stage.kind === "sending") {
    return {
      stamp: "SENDING PLATES",
      title: "Sending your plates",
      body: `Plate ${Math.min(stage.sent + 1, stage.total)} of ${stage.total}. Keep the app open until they're all sent.`,
    };
  }
  return jobCopy(stage.job);
}

function jobCopy(job: GenerationJob) {
  if (job.status === "running") {
    return {
      stamp: "DEVELOPING",
      title: "Developing your case",
      body: "Finding the objects, choosing what to hide, and writing the case. This usually takes a minute or two.",
    };
  }
  if (job.attempt_count > 0) {
    return {
      stamp: "SECOND ATTEMPT",
      title: "Trying again",
      body: "The first attempt didn't finish. The darkroom will try again shortly; you don't need to do anything.",
    };
  }
  return {
    stamp: "IN THE QUEUE",
    title: "Waiting for the darkroom",
    body: "Your case is next. You can leave this screen; it keeps developing, and you'll find it on the title screen.",
  };
}

function Darkroom({ stamp, title, body, plates, sent, developed, since, footer }: {
  stamp: string;
  title: string;
  body: string;
  plates: readonly { uri: string }[];
  sent?: number;
  developed?: boolean;
  since?: string;
  footer?: ReactNode;
}) {
  return (
    <View style={styles.root}>
      <Grain />
      <SafeAreaView style={styles.safe}>
        <View style={styles.center} accessibilityLiveRegion="polite">
          {plates.length ? (
            <View style={styles.strip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {plates.map((plate, i) => (
                <View key={plate.uri} style={styles.plate}>
                  <Image source={{ uri: plate.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  {/* Unsent and developing plates sit under the safelight. */}
                  {!developed ? <View style={[styles.safelight, sent !== undefined && i < sent && styles.safelightSent]} /> : null}
                  <Text variant="stamp" tone="accent" style={styles.plateNumeral}>{promptFor(i).numeral}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text variant="stamp" tone="accent">{stamp}</Text>
          <Text variant="narrativeTitle" align="center" accessibilityRole="header">{title}</Text>
          <Text tone="secondary" align="center">{body}</Text>
          {developed ? null : <ActivityIndicator color={color.accent} accessibilityLabel={title} />}
          {since ? <Elapsed since={since} /> : null}
        </View>
        {footer ? <View style={styles.actions}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const ms = Math.max(0, now - new Date(since).getTime());
  return <Text variant="slip" tone="secondary" accessibilityLabel={`Elapsed ${formatDuration(ms)}`}>{formatDuration(ms)}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  safe: { flex: 1, paddingHorizontal: space.gutter },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  strip: { flexDirection: "row", gap: space.sm, marginBottom: space.lg },
  plate: {
    width: 48,
    height: 64,
    borderRadius: radius.control,
    ...curve,
    overflow: "hidden",
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.rim,
  },
  safelight: { ...StyleSheet.absoluteFill, backgroundColor: color.velvet, opacity: 0.85 },
  safelightSent: { opacity: 0.45 },
  plateNumeral: { position: "absolute", left: space.xs, bottom: space.xxs },
  actions: { gap: space.sm, paddingBottom: space.xl },
});
