// /capture/guide: 04 · Photo guide (docs/DESIGN.md). Shown before every new
// room: openCapture() always opens it, and /capture's backstop sends any
// other way in here first. Its last step and its X continue to the camera.
// ?replay=1 (opened directly, with no access check behind it) makes that
// continue check access first. The room's flag lives in src/capture/guideSeen.ts.
import { useLocalSearchParams } from "expo-router";
import { PhotoGuide } from "@/screens/guide/PhotoGuide";

export default function CaptureGuideScreen() {
  const { replay, ...carry } = useLocalSearchParams();
  return <PhotoGuide replay={replay === "1"} carry={carry} />;
}
