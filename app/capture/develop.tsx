// 06 · Building your case: sends the photos, then follows the case while the
// server builds it. Opened with ?roomId=<id> (home's Continue) it follows a
// case already building. Every state here comes from the server's job row
// through useDevelopment; nothing is guessed. The wait and the ready moment
// are BuildWait (src/screens/develop): the player's photos turning round the
// room under a torch beam, one title, one status line, and a square close in
// the header. The asks and failures are the shared StateScreen. Inside a mode
// (openCapture({ genre }) sets it) every state takes the mode's colours
// (src/capture/ui/palette.ts) and the photos its baked treatment. ?from=hub
// (openCapture's monthly-cap branch, before any photo is taken) only checks
// access: its cap state says nothing about photos.
import { useCallback, useEffect, useRef } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { encodeFlags } from "@/capture/failure";
import { clearPlates, usePlates } from "@/capture/roll";
import { useDevelopment } from "@/capture/useDevelopment";
import { useFeedback } from "@/game/feedback";
import { BuildWait } from "@/screens/develop/BuildWait";
import { StateScreen } from "@/components/StateScreen";

export default function DarkroomScreen() {
  const { roomId, from } = useLocalSearchParams<{ roomId?: string; from?: string }>();
  const { stage, retry } = useDevelopment(roomId || undefined);
  // The photos in slot order: the 360, round the room from photo 1.
  const plates = usePlates();
  // Reached from home's access check (or with no photos at all): nothing taken to talk about.
  const noPhotos = from === "hub" || plates.length === 0;
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

  // A failure is a calm warning. Ready's cues (the stamp, then success) are BuildWait's.
  useEffect(() => {
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

  const home = useCallback(() => router.replace("/"), []);
  const back = () => (router.canGoBack() ? router.back() : home());

  switch (stage.kind) {
    case "checking":
      return <StateScreen title="One moment" loading />;
    case "account":
      return (
        <StateScreen
          title="Keep your cases on an account"
          body="Cases you build are saved to your account so they're never lost. Add an email and confirm it, then build."
          primary={{ label: "Add your email", onPress: addEmail }}
          secondary={{ label: "Back to your photos", onPress: back }}
        />
      );
    case "access":
      return stage.reason === "entitlement" ? (
        <StateScreen
          title="Your own rooms are part of ESCAPD Pro"
          body="ESCAPD Pro isn't on sale in this test build. If you're testing, ask for test access for your account, then try again."
          primary={{ label: "Try again", onPress: () => retry() }}
          secondary={{ label: "Back to your photos", onPress: back }}
        />
      ) : (
        <StateScreen
          title="You've built every case this month allows"
          body={
            noPhotos
              ? "Your allowance comes back over the next few days. Come back then to build your next case."
              : "Your allowance comes back over the next few days. Your photos stay on this phone until you close the app."
          }
          primary={{ label: "Back to home", onPress: home }}
        />
      );
    case "error":
      return (
        <StateScreen
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
        <StateScreen
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
    case "sending":
    case "waiting":
      return (
        <BuildWait
          stage={stage}
          photos={plates}
          onLeave={home}
          open={{
            label: "Open the case",
            testID: "open-case",
            // Committing to play: the weighty press.
            haptic: "thud",
            onPress: () => {
              clearPlates();
              router.replace(`/play/${stage.kind === "ready" ? stage.roomId : ""}`);
            },
          }}
        />
      );
  }
}
