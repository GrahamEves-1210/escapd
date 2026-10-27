// Immersive player for any playable room the player can read. The mode comes
// from the case's definition; case closed is /play/complete/<id>, per mode.
// The room tone plays under it while it has focus (useRoomTone).
//
// Rooms play on gameplay v2 (src/play2: the torch, close-ups, the casebook,
// the door): a v2 room on the server, a v1 room planned on the device from its
// objects. A v1 room the v2 planner can't build, or `?v=1`, plays on the v1 player.
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useRoomTone } from "@/game/useRoomTone";
import { PlayerV2 } from "@/play2/PlayerV2";
import { Player, type CompletionSummary } from "@/render/Player";

export default function PlayScreen() {
  const { roomId, v } = useLocalSearchParams<{ roomId: string; v?: string }>();
  const [v1, setV1] = useState(v === "1");
  // The room tone under the case, in its mode.
  useRoomTone(true);
  // Back always goes home (the menu), never back into the camera the case was built from.
  const exit = () => router.dismissTo("/");
  const complete = ({ message, exitMessage, genre, title, accused }: CompletionSummary) =>
    router.replace({
      pathname: "/play/complete/[roomId]",
      params: { roomId, genre, title: title ?? "", message: message ?? "", exit: exitMessage ?? "", suspect: accused ?? "" },
    });
  if (!v1) {
    return (
      <PlayerV2
        roomId={roomId}
        onExit={exit}
        onFallback={() => setV1(true)}
        onComplete={({ title, ending, genre }) =>
          router.replace({ pathname: "/play/complete/[roomId]", params: { roomId, genre, title, message: ending, exit: "" } })}
      />
    );
  }
  return <Player roomId={roomId} onExit={exit} onComplete={complete} />;
}
