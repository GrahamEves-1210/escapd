// Immersive player for any playable room the player can read. The mode comes
// from the case's definition; case closed is /play/complete/<id>, per mode.
// No room tone under it: the mode's music only.
//
// Rooms play on gameplay v2 (src/play2: the torch, close-ups, the casebook,
// the door): a v2 room on the server, a v1 room planned on the device from its
// objects. A v1 room the v2 planner can't build, or `?v=1`, plays on the v1 player.
//
// A v2 game hands case closed how it went (its own count: a room played on the
// device writes no session), the accusation that held and the room's photo,
// in the closed-case stash (src/render/closedCase.ts) and the route's params.
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { PlayerV2 } from "@/play2/PlayerV2";
import type { V2Completion } from "@/play2/caseRecord";
import { stashClosedCase, statsToParams } from "@/render/closedCase";
import { Player, type CompletionSummary } from "@/render/Player";

export default function PlayScreen() {
  const { roomId, v } = useLocalSearchParams<{ roomId: string; v?: string }>();
  const [v1, setV1] = useState(v === "1");
  // Back always goes home (the menu), never back into the camera the case was built from.
  const exit = () => router.dismissTo("/");
  const complete = ({ message, exitMessage, genre, title, accused }: CompletionSummary) =>
    router.replace({
      pathname: "/play/complete/[roomId]",
      params: { roomId, genre, title: title ?? "", message: message ?? "", exit: exitMessage ?? "", suspect: accused ?? "" },
    });
  const completeV2 = ({ title, ending, genre, stats, accusation, photo, photoRef }: V2Completion) => {
    stashClosedCase({
      roomId,
      genre,
      title,
      accused: accusation?.who,
      motive: accusation?.why?.name,
      method: accusation?.how?.name,
      stats,
      photo,
      photoRef,
    });
    router.replace({
      pathname: "/play/complete/[roomId]",
      params: { roomId, genre, title, message: ending, exit: "", suspect: accusation?.who.id ?? "", ...statsToParams(stats) },
    });
  };
  if (!v1) {
    return <PlayerV2 roomId={roomId} onExit={exit} onFallback={() => setV1(true)} onComplete={completeV2} />;
  }
  return <Player roomId={roomId} onExit={exit} onComplete={complete} />;
}
