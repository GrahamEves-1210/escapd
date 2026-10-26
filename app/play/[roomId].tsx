// Immersive player for any playable room the player can read. The mode comes
// from the case's definition; case closed is /play/complete/<id>, per mode.
// The room tone plays under it while it has focus (useRoomTone).
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useRoomTone } from "@/game/useRoomTone";
import { Player, type CompletionSummary } from "@/render/Player";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";

export default function PlayScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  // The room tone under the case, in its mode; /tutorial runs its own.
  useRoomTone(roomId !== TUTORIAL_ROOM_ID);
  if (roomId === TUTORIAL_ROOM_ID) return <Redirect href="/tutorial" />;
  const exit = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const complete = ({ message, exitMessage, genre, title, accused }: CompletionSummary) =>
    router.replace({
      pathname: "/play/complete/[roomId]",
      params: { roomId, genre, title: title ?? "", message: message ?? "", exit: exitMessage ?? "", suspect: accused ?? "" },
    });
  return <Player roomId={roomId} onExit={exit} onComplete={complete} />;
}
