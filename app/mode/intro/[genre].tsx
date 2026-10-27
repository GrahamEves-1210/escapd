// A mode's first-time "how this mode works" at /mode/intro/<genre>
// (MODES_PROMPT.md Part 2), for every mode. Anything else goes home.
import { Redirect, useLocalSearchParams } from "expo-router";
import { parseGenre } from "@/game/mode";
import { ModeIntro } from "@/screens/mode/ModeIntro";

export default function ModeIntroRoute() {
  const genre = parseGenre(useLocalSearchParams<{ genre: string }>().genre);
  if (!genre) return <Redirect href="/" />;
  return <ModeIntro key={genre} genre={genre} />;
}
