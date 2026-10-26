// A mode's first-time "how this mode works" at /mode/intro/<genre>
// (MODES_PROMPT.md Part 2): crime scene and paranormal. Noir has none (its
// first tap runs The Study), so it goes straight to its mode screen;
// anything else goes home.
import { Redirect, useLocalSearchParams } from "expo-router";
import { parseGenre } from "@/game/mode";
import { ModeIntro } from "@/screens/mode/ModeIntro";
import { hasIntro } from "@/screens/mode/introSeen";
import { modeHref } from "@/screens/mode/routes";

export default function ModeIntroRoute() {
  const genre = parseGenre(useLocalSearchParams<{ genre: string }>().genre);
  if (!genre) return <Redirect href="/" />;
  if (!hasIntro(genre)) return <Redirect href={modeHref(genre)} />;
  return <ModeIntro key={genre} genre={genre} />;
}
