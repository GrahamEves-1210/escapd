// The modes' routes: /mode/<genre> and its first-time intro.
import type { Href } from "expo-router";
import type { Genre } from "@/lib/puzzle-types";

/** A mode's screen. */
export function modeHref(genre: Genre): Href {
  return { pathname: "/mode/[genre]", params: { genre } };
}

/** A mode's first-time "how this mode works" (crime scene and paranormal). */
export function introHref(genre: Genre): Href {
  return { pathname: "/mode/intro/[genre]", params: { genre } };
}
