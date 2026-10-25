// Immersive player for any playable room the player can read.
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Player } from "@/render/Player";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";

export default function PlayScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  if (roomId === TUTORIAL_ROOM_ID) return <Redirect href="/tutorial" />;
  const exit = () => (router.canGoBack() ? router.back() : router.replace("/"));
  // Custom-room completion (anchors, replay, regenerate) arrives with
  // app/room/[roomId]/complete.tsx in Phase 4; until then, return home.
  return <Player roomId={roomId} onExit={exit} onComplete={exit} />;
}
