// A mode's screen (MODES_PROMPT.md Part 2): /mode/noir, /mode/crime_scene,
// /mode/paranormal. Anything else goes home. The screen lives in src/screens/mode.
import { Redirect, useLocalSearchParams } from "expo-router";
import { parseGenre } from "@/game/mode";
import { ModeScreen } from "@/screens/mode/ModeScreen";

export default function ModeRoute() {
  const genre = parseGenre(useLocalSearchParams<{ genre: string }>().genre);
  if (!genre) return <Redirect href="/" />;
  return <ModeScreen key={genre} genre={genre} />;
}
