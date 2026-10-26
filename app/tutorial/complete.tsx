// Tutorial result: noir's case closed (src/render/CaseClosed.tsx). The CASE
// CLOSED stamp slams down in brass over The Study's name, the server's message
// and the exit line, then the time and hints on 07's cards, and 07's pinned
// band: the bar, then two quiet pills. Celebrates observation, not speed.
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { getLatestSession } from "@/lib/escapd-api";
import { openCapture } from "@/capture/openCapture";
import { formatDuration } from "@/game/format";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { PillButton } from "@/components/noir";
import { CaseClosed, type CaseSummary } from "@/render/CaseClosed";
import { WhiteBar } from "@/render/parts";

export default function TutorialCompleteScreen() {
  const { message, exit } = useLocalSearchParams<{ message?: string; exit?: string }>();
  const [summary, setSummary] = useState<CaseSummary | null>(null);

  useEffect(() => {
    getLatestSession(TUTORIAL_ROOM_ID, "completed")
      .then((s) => {
        if (!s?.completed_at) return;
        setSummary({
          time: formatDuration(new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()),
          hints: s.hints_used,
        });
      })
      .catch(() => {});
  }, []);

  // The next case is the player's own room, in noir: access is checked on the
  // way (a guest goes to /account, no Pro to /pro). Offline, the camera's own
  // backstop still shows the guide first.
  const photograph = () => {
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
          <WhiteBar label="Photograph your room" onPress={photograph} testID="complete-capture" />
          <PillButton
            variant="quiet"
            ground="dark"
            fullWidth
            label="Back to Detective Noir"
            onPress={() => router.dismissTo({ pathname: "/mode/[genre]", params: { genre: "noir" } })}
          />
          <PillButton variant="quiet" ground="dark" fullWidth label="Replay The Study" onPress={() => router.replace("/tutorial")} />
        </>
      )}
    />
  );
}
