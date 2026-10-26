// The Study: the exact production player plus server-driven coach marks. It is
// a noir case, so the screens around it take noir's look from the first frame.
import { router } from "expo-router";
import { useModeOnFocus } from "@/game/useModeOnFocus";
import { useRoomTone } from "@/game/useRoomTone";
import { Player } from "@/render/Player";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { tutorialCoach } from "@/tutorial/coach";

export default function TutorialScreen() {
  useModeOnFocus("noir");
  useRoomTone(true);
  return (
    <Player
      roomId={TUTORIAL_ROOM_ID}
      coach={tutorialCoach}
      onExit={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      onComplete={({ message, exitMessage }) =>
        router.replace({ pathname: "/tutorial/complete", params: { message: message ?? "", exit: exitMessage ?? "" } })}
    />
  );
}
