// The Study: the exact production player plus server-driven coach marks.
import { router } from "expo-router";
import { Player } from "@/render/Player";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { tutorialCoach } from "@/tutorial/coach";

export default function TutorialScreen() {
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
