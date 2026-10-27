// The modes' one route of their own: the first-time intro, /mode/intro/<genre>.
// (Round 6 removed the mode's case-list screen: a mode card goes straight to
// its intro, the continue prompt or a new case; see HubScreen.)
import type { Href } from "expo-router";
import type { Genre } from "@/lib/puzzle-types";

/** A mode's first-time "how this mode works". */
export function introHref(genre: Genre): Href {
  return { pathname: "/mode/intro/[genre]", params: { genre } };
}
