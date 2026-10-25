// /capture/guide: 04 · First-time photo guide (docs/DESIGN.md). Shown once,
// before the first camera session (openCapture and /capture's backstop route
// a first-timer here), or as a replay from 01's How you play sheet
// (?replay=1). The seen flag lives in src/capture/guideSeen.ts.
import { useLocalSearchParams } from "expo-router";
import { PhotoGuide } from "@/screens/guide/PhotoGuide";

export default function CaptureGuideScreen() {
  const { replay, ...carry } = useLocalSearchParams();
  return <PhotoGuide replay={replay === "1"} carry={carry} />;
}
