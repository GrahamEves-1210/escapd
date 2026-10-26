// /capture/review: the review screen, titled "Photos" (src/screens/review).
// Check the photos before the case is built. Nothing is uploaded until
// "Build the case". After a failed build: ?flag=0:person,2:private_text marks
// those photos with their reasons until they are retaken, and ?issue=<code>
// shows a note about the whole set.
import { useLocalSearchParams } from "expo-router";
import { LightTable } from "@/screens/review/LightTable";

export default function LightTableScreen() {
  const { flag, issue } = useLocalSearchParams<{ flag?: string; issue?: string }>();
  return <LightTable flag={flag} issue={issue} />;
}
