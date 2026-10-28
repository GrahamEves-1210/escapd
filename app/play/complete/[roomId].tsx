// Case closed for a custom room, per mode (src/render/CaseClosed.tsx): the
// victory moment as the last page of her mystery. The room's polaroid with
// the case's name, the mode's gold seal (CASE CLOSED; crime scene's GUILTY
// with the culprit, motive and method; paranormal's THE PRESENCE IS GONE as
// the room snaps back to its own colours); then how the game went (time,
// tips, wrong answers) and the rating they earn.
//
// The player passes the mode, the case's name, its lines, the accused
// suspect's id and (a v2 game) its own stats as params, and the case in the
// closed-case stash (closedCase.ts: in memory, and kept on the device for a
// reload). The stats are the v2 game's own count when there is one, else the
// completed session's (a v1 game is played on the server). After a reload
// with nothing kept, the case's name and the accused are read from the
// completed session's definition (a v2 room's: its name only). The room's
// photo (the polaroid on case closed's last page) is signed again when it
// isn't in memory.
//
// Then the pinned actions: Start a new case in the same mode (the photo
// guide's pill, openCapture({ genre })), or Done (home).
import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { AccuseOption } from "@/lib/puzzle-types";
import { getLatestSession, getPlayableDefinition } from "@/lib/escapd-api";
import { openCapture } from "@/capture/openCapture";
import { parseGenre, themeFor } from "@/game/mode";
import { suspectById } from "@/game/selectors";
import { ModePill } from "@/capture/ui/ModePill";
import { CaseClosed } from "@/render/CaseClosed";
import { closedCaseFor, loadClosedCase, resolveClosedPhoto, statsFromParams, type ClosedCase } from "@/render/closedCase";
import type { SceneSource } from "@/render/SceneView";
import { PLAY_COPY } from "@/render/voice";
import { caseSummary, caseSummaryFromStats, type CaseSummary } from "@/render/victory";

/** How long a reload waits for the room's photo before it shows the case without it (ms). */
const PHOTO_WAIT = 1500;

type Params = {
  roomId: string; genre?: string; title?: string; message?: string; exit?: string; suspect?: string;
  hints?: string; wrong?: string; ms?: string;
};

export default function PlayCompleteScreen() {
  const params = useLocalSearchParams<Params>();
  const { roomId } = params;
  // The stash: in memory right after play (at once), else as kept on the device (a reload; undefined while it loads).
  const [stash, setStash] = useState<ClosedCase | null | undefined>(() => closedCaseFor(roomId) ?? undefined);
  useEffect(() => {
    if (stash !== undefined) return;
    let cancelled = false;
    loadClosedCase(roomId).then((kept) => {
      if (!cancelled) setStash(kept);
    });
    return () => {
      cancelled = true;
    };
  }, [roomId, stash]);

  const genre = parseGenre(params.genre) ?? stash?.genre ?? "noir";
  // The game's own stats: the params' (they survive a reload), else the stash's.
  const ownStats = statsFromParams(params) ?? stash?.stats;
  // undefined while the session loads; null when there is none to read.
  const [session, setSession] = useState<CaseSummary | null | undefined>(undefined);
  const [fetched, setFetched] = useState<{ title?: string; accused?: AccuseOption & { contradicted?: boolean } } | null>(null);
  const suspect = params.suspect || undefined;
  const loaded = stash !== undefined;
  // A reload with nothing kept: the case's name, and the accused, from the session's definition.
  const needsDefinition = loaded && ((!params.title && !stash?.title) || (!!suspect && !stash?.accused));
  const needsSession = loaded && !ownStats;

  useEffect(() => {
    if (!needsSession && !needsDefinition) return;
    let cancelled = false;
    getLatestSession(roomId, "completed")
      .then(async (s) => {
        if (cancelled) return;
        if (needsSession) setSession(caseSummary(s));
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
        if (!cancelled) setSession((current) => current ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, suspect, needsDefinition, needsSession]);

  // The room's photo: the player's in memory, else signed again (a reload), waiting a moment for it.
  const [fetchedPhoto, setFetchedPhoto] = useState<SceneSource | null | undefined>(undefined);
  const photo = stash?.photo ?? fetchedPhoto;
  const needsPhoto = loaded && !stash?.photo;
  useEffect(() => {
    if (!needsPhoto) return;
    let cancelled = false;
    const give = (p: SceneSource | null) => {
      if (!cancelled) setFetchedPhoto((current) => (current === undefined ? p : current));
    };
    const timer = setTimeout(() => give(null), PHOTO_WAIT);
    resolveClosedPhoto(roomId, stash?.photoRef).then(give, () => give(null));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [roomId, needsPhoto, stash?.photoRef]);

  const title = params.title || stash?.title || fetched?.title || "Untitled case";
  const accused = stash?.accused ?? fetched?.accused;
  const summary = ownStats ? caseSummaryFromStats(ownStats) : session;

  const newCase = () => {
    // Offline or a server error: the camera's own backstop still shows the guide first.
    openCapture({ genre, replace: true }).catch(() => router.replace("/capture"));
  };

  // A reload: the moment starts once the case (and its room's photo, or a moment's wait for it) is in hand.
  if (!loaded || photo === undefined) {
    return <View style={{ flex: 1, backgroundColor: themeFor(genre).ground }} testID="case-closed-loading" />;
  }

  return (
    <CaseClosed
      genre={genre}
      title={title}
      message={params.message || undefined}
      exit={params.exit || undefined}
      summary={summary}
      accused={accused}
      recap={stash?.motive || stash?.method ? { why: stash.motive, how: stash.method } : undefined}
      photo={photo}
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
