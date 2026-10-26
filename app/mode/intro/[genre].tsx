// A mode's first-time "how this mode works" at /mode/intro/<genre>
// (MODES_PROMPT.md Part 2): crime scene and paranormal. Noir has none (its
// first tap runs The Study), so it, and anything else, goes home.
import { Redirect, useLocalSearchParams } from "expo-router";
import { parseGenre } from "@/game/mode";
import { ModeIntro } from "@/screens/mode/ModeIntro";
import { hasIntro } from "@/screens/mode/introSeen";

export default function ModeIntroRoute() {
  const genre = parseGenre(useLocalSearchParams<{ genre: string }>().genre);
  if (!genre || !hasIntro(genre)) return <Redirect href="/" />;
  return <ModeIntro key={genre} genre={genre} />;
}
