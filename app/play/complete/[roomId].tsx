// Case closed for a custom room, per mode (src/render/CaseClosed.tsx): noir's
// CASE CLOSED stamp, crime scene's accused under GUILTY, paranormal's room
// back in its own colours. The player passes the mode, the case's name, the
// server's lines and the accused suspect's id as params, and the case in
// memory (closedCase.ts); after a reload the case's name and the accused are
// read from the completed session's definition instead. Then: a new case in
// the same mode, back to the mode's cases, or this case again.
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import type { AccuseOption } from "@/lib/puzzle-types";
import { getLatestSession, getPlayableDefinition } from "@/lib/escapd-api";
import { openCapture } from "@/capture/openCapture";
import { formatDuration } from "@/game/format";
import { parseGenre, themeFor } from "@/game/mode";
import { suspectById } from "@/game/selectors";
import { ModePill } from "@/capture/ui/ModePill";
import { CaseClosed, type CaseSummary } from "@/render/CaseClosed";
import { closedCaseFor } from "@/render/closedCase";

export default function PlayCompleteScreen() {
  const params = useLocalSearchParams<{ roomId: string; genre?: string; title?: string; message?: string; exit?: string; suspect?: string }>();
  const { roomId } = params;
  const [stash] = useState(() => closedCaseFor(roomId));
  const genre = parseGenre(params.genre) ?? stash?.genre ?? "noir";
  const theme = themeFor(genre);
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [fetched, setFetched] = useState<{ title?: string; accused?: AccuseOption & { contradicted?: boolean } } | null>(null);
  const suspect = params.suspect || undefined;
  const needsDefinition = !stash || (!!suspect && !stash.accused);

  useEffect(() => {
    let cancelled = false;
    getLatestSession(roomId, "completed")
      .then(async (s) => {
        if (!s || cancelled) return;
        if (s.completed_at) {
          setSummary({
            time: formatDuration(new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()),
            hints: s.hints_used,
          });
        }
        if (!needsDefinition) return;
        const def = await getPlayableDefinition(s.puzzle_version_id);
        const contradicted = (s.state as { contradicted?: string[] } | null)?.contradicted ?? [];
        const accused = suspectById(def, suspect);
        if (!cancelled) setFetched({ title: def.title, accused: accused && { ...accused, contradicted: contradicted.includes(accused.id) } });
      })
      .catch(() => {});
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
          <ModePill variant="ghost" label="New case" onPress={newCase} testID="complete-new-case" />
          <ModePill
            variant="quiet"
            ground="dark"
            fullWidth
            label={`Back to ${theme.name}`}
            // Back down the stack to the mode's screen (or to it, in place of this one, when it isn't there).
            onPress={() => router.dismissTo({ pathname: "/mode/[genre]", params: { genre } })}
            testID="complete-mode"
          />
          <ModePill
            variant="quiet"
            ground="dark"
            fullWidth
            label="Play this case again"
            onPress={() => router.replace({ pathname: "/play/[roomId]", params: { roomId } })}
            testID="complete-replay"
          />
        </>
      )}
    />
  );
}
