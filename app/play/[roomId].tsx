// Immersive player for any playable room the player can read. The mode comes
// from the case's definition; case closed is /play/complete/<id>, per mode.
// The room tone plays under it while it has focus (useRoomTone).
import { router, useLocalSearchParams } from "expo-router";
import { useRoomTone } from "@/game/useRoomTone";
import { Player, type CompletionSummary } from "@/render/Player";

export default function PlayScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  // The room tone under the case, in its mode.
  useRoomTone(true);
  const exit = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const complete = ({ message, exitMessage, genre, title, accused }: CompletionSummary) =>
    router.replace({
      pathname: "/play/complete/[roomId]",
      params: { roomId, genre, title: title ?? "", message: message ?? "", exit: exitMessage ?? "", suspect: accused ?? "" },
    });
  return <Player roomId={roomId} onExit={exit} onComplete={complete} />;
}
