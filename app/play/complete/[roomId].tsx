// Case closed for a custom room, per mode (src/render/CaseClosed.tsx): the
// victory moment. Noir's CASE CLOSED slammed onto the case file, crime
// scene's accused under GUILTY, paranormal's room snapping back to its own
// colours; then the completed session's stats (time, hints, wrong answers)
// and the magnifier rating they earn. The player passes the mode, the case's name, the
// server's lines and the accused suspect's id as params, and the case in
// memory (closedCase.ts); after a reload the case's name and the accused are
// read from the completed session's definition instead (a v2 room's: its name
// only). Then the pinned
// actions: Start a new case in the same mode (the photo guide's pill,
// openCapture({ genre })), Back to <mode> (home, where the mode's card is),
// or this case again.
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import type { AccuseOption } from "@/lib/puzzle-types";
import { getLatestSession, getPlayableDefinition } from "@/lib/escapd-api";
import { openCapture } from "@/capture/openCapture";
import { parseGenre, themeFor } from "@/game/mode";
import { suspectById } from "@/game/selectors";
import { ModePill } from "@/capture/ui/ModePill";
import { CaseClosed } from "@/render/CaseClosed";
import { closedCaseFor } from "@/render/closedCase";
import { PLAY_COPY } from "@/render/voice";
import { caseSummary, type CaseSummary } from "@/render/victory";

export default function PlayCompleteScreen() {
  const params = useLocalSearchParams<{ roomId: string; genre?: string; title?: string; message?: string; exit?: string; suspect?: string }>();
  const { roomId } = params;
  const [stash] = useState(() => closedCaseFor(roomId));
  const genre = parseGenre(params.genre) ?? stash?.genre ?? "noir";
  const theme = themeFor(genre);
  // undefined while the session loads; null when there is none to read.
  const [summary, setSummary] = useState<CaseSummary | null | undefined>(undefined);
  const [fetched, setFetched] = useState<{ title?: string; accused?: AccuseOption & { contradicted?: boolean } } | null>(null);
  const suspect = params.suspect || undefined;
  const needsDefinition = !stash || (!!suspect && !stash.accused);

  useEffect(() => {
    let cancelled = false;
    getLatestSession(roomId, "completed")
      .then(async (s) => {
        if (cancelled) return;
        setSummary(caseSummary(s));
        if (!s || !needsDefinition) return;
        const def = await getPlayableDefinition(s.puzzle_version_id);
        // A v2 room has no suspects to look up: just its name.
        if (def.schema_version !== 1) {
          if (!cancelled) setFetched({ title: def.title });
          return;
        }
        const contradicted = (s.state as { contradicted?: string[] } | null)?.contradicted ?? [];
        const accused = suspectById(def, suspect);
        if (!cancelled) setFetched({ title: def.title, accused: accused && { ...accused, contradicted: contradicted.includes(accused.id) } });
      })
      .catch(() => {
        if (!cancelled) setSummary((current) => current ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, suspect, needsDefinition]);

  const title = params.title || stash?.title || fetched?.title || "Untitled case";
  const accused = stash?.accused ?? fetched?.accused;

  const newCase = () => {
    // Offline or a server error: the camera's own backstop still shows the guide first.
    openCapture({ genre, replace: true }).catch(() => router.replace("/capture"));
  };

  return (
    <CaseClosed
      genre={genre}
      title={title}
      message={params.message || undefined}
      exit={params.exit || undefined}
      summary={summary}
      accused={accused}
      photo={stash?.photo}
      actions={(
        <>
          <ModePill variant="ghost" label={PLAY_COPY.newCase} onPress={newCase} testID="complete-new-case" />
          {/* No "Back to <mode>" and no replay: one way on, and Done to go home. */}
          <ModePill variant="quiet" ground="dark" fullWidth label="Done" onPress={() => router.dismissTo("/")} testID="complete-mode" />
        </>
      )}
    />
  );
}
