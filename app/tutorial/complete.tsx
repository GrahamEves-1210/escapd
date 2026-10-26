// Tutorial result: noir's case closed (src/render/CaseClosed.tsx), the
// victory moment. CASE CLOSED slams down in brass on The Study's case file,
// then the server's message and exit line, the session's time, hints and
// wrong codes landing one by one, the magnifier rating (observation, not
// speed), and the pinned band: the photo guide's pill (Start a new case: the
// player's own room, in noir), then two quiet pills: Back to Detective Noir
// (home, where noir's card is) and Replay The Study.
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { getLatestSession } from "@/lib/escapd-api";
import { openCapture } from "@/capture/openCapture";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { ModePill } from "@/capture/ui/ModePill";
import { CaseClosed } from "@/render/CaseClosed";
import { PLAY_COPY } from "@/render/voice";
import { caseSummary, type CaseSummary } from "@/render/victory";

export default function TutorialCompleteScreen() {
  const { message, exit } = useLocalSearchParams<{ message?: string; exit?: string }>();
  // undefined while the session loads; null when there is none to read.
  const [summary, setSummary] = useState<CaseSummary | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getLatestSession(TUTORIAL_ROOM_ID, "completed")
      .then((s) => {
        if (!cancelled) setSummary(caseSummary(s));
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The next case is the player's own room, in noir: access is checked on the
  // way (a guest goes to /account, no Pro to /pro). Offline, the camera's own
  // backstop still shows the guide first.
  const newCase = () => {
    openCapture({ genre: "noir", replace: true }).catch(() => router.replace("/capture"));
  };

  return (
    <CaseClosed
      genre="noir"
      title="The Study"
      message={message || undefined}
      exit={exit || "The door swings open."}
      summary={summary}
      next="The next case is your own room."
      actions={(
        <>
          <ModePill variant="ghost" label={PLAY_COPY.newCase} onPress={newCase} testID="complete-capture" />
          <ModePill
            variant="quiet"
            ground="dark"
            fullWidth
            label="Back to Detective Noir"
            onPress={() => router.dismissTo("/")}
            testID="complete-mode"
          />
          <ModePill variant="quiet" ground="dark" fullWidth label="Replay The Study" onPress={() => router.replace("/tutorial")} />
        </>
      )}
    />
  );
}
