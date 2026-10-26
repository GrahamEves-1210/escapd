// The modes' art: home's three cards and each mode screen's banner show the
// same photo in that mode's treatment. Once the player has photographed a
// room, it is their own room (the newest custom room with a photo); until
// then The Study's bundled photo. Home finds the photo on each focus and
// keeps it here, so a mode screen shows the same, already baked, picture at
// once. In memory only, like the mode store.
import { useSyncExternalStore } from "react";
import { BUNDLED_SCENES } from "@/tutorial/assets";
import type { TreatSource } from "@/components/noir";

/** The player's own room photo: a signed URL and the photo's stable id (the bake's cache key). */
export interface OwnArt {
  id: string;
  uri: string;
}

/** The default art: The Study's first view (the lamp, the desk, the bookcase). */
export const STUDY_ART: number = BUNDLED_SCENES["tutorial/study_1.jpg"];

let own: OwnArt | null = null;
const listeners = new Set<() => void>();

export function getOwnArt(): OwnArt | null {
  return own;
}

/** Replaces the own-room art. The same photo with a fresh signed URL keeps the one already shown. */
export function setOwnArt(next: OwnArt | null) {
  if (next?.id === own?.id) return;
  own = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface ModeArt {
  source: TreatSource;
  /** The bake's cache key for a signed URL; undefined for the bundled photo. */
  cacheKey?: string;
  /** True when it is the player's own room. */
  own: boolean;
}

export function artFor(art: OwnArt | null): ModeArt {
  return art ? { source: { uri: art.uri }, cacheKey: art.id, own: true } : { source: STUDY_ART, own: false };
}

/** The art every mode shows now. */
export function useModeArt(): ModeArt {
  const current = useSyncExternalStore(subscribe, getOwnArt, getOwnArt);
  return artFor(current);
}
