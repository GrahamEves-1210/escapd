// Home's data (MODES_PROMPT.md Part 2): The Study's entry (noir's first tap),
// each mode's number of cases, and the player's newest room photo for the
// cards' art. Fetched on every focus, and only with a stored session: a
// guest is never created just to label a card. Calls only exported API
// functions and the mode screens' batched photo read.
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { currentSession, getLatestCustomRoom, getLatestSession, listMyRooms, type Room } from "@/lib/escapd-api";
import { setOwnArt, type OwnArt } from "@/screens/mode/art";
import { coverPhotos, signCovers } from "@/screens/mode/caseQueries";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { NO_CASES, countByGenre, studyEntry, type ModeCounts, type StudyEntry } from "./caseStatus";

/** How many of the newest rooms are searched for a photo (a draft first, then sent ones). */
const ART_CANDIDATES = 8;

export interface HubFetch {
  /** Absent when the fetch failed: the last known entry stands (or none yet). */
  study?: StudyEntry;
  /** Absent when the fetch failed: the cards keep what they showed. */
  counts?: ModeCounts;
  /** The newest own room photo; null for none; absent when it couldn't be read (the art stays). */
  art?: OwnArt | null;
}

/**
 * The newest custom room with a photo (drafts included: a room photographed
 * but never sent still counts), as a signed URL keyed by the photo's id.
 * One query for the photos, one signature.
 */
export async function newestRoomArt(latest: Pick<Room, "id"> | null, rooms: readonly Pick<Room, "id">[]): Promise<OwnArt | null> {
  const ids = [...new Set([latest?.id, ...rooms.map((room) => room.id)].filter((id): id is string => !!id))].slice(0, ART_CANDIDATES);
  if (ids.length === 0) return null;
  const covers = await coverPhotos(ids);
  const roomId = ids.find((id) => covers.has(id));
  const cover = roomId ? covers.get(roomId) : undefined;
  if (!cover) return null;
  const uri = (await signCovers([cover])).get(cover.id);
  if (!uri) throw new Error("The room photo couldn't be signed");
  return { id: cover.id, uri };
}

/**
 * One focus fetch. Never rejects. The tutorial session, the sent rooms and
 * the newest room (drafts included) are read in parallel, then the photo.
 * A photo that can't be read leaves the art as it was.
 */
export async function fetchHub(): Promise<HubFetch> {
  try {
    if (!(await currentSession())) return { study: "unseal", counts: NO_CASES, art: null };
    const [tutorial, rooms, latest] = await Promise.all([getLatestSession(TUTORIAL_ROOM_ID), listMyRooms(), getLatestCustomRoom()]);
    const art = await newestRoomArt(latest, rooms).catch(() => undefined);
    return { study: studyEntry(tutorial), counts: countByGenre(rooms), art };
  } catch {
    return {};
  }
}

export interface HubData {
  /** Null until known (still loading, or the fetch failed). */
  study: StudyEntry | null;
  /** Undefined until known: the count line stays empty. */
  counts: ModeCounts | undefined;
}

// Every focus fetch's place in line, and the one whose art the shared store
// holds. Module-wide, like the store, so no older fetch outranks a newer one.
let artFetches = 0;
let artFrom = 0;

/** Home's card data, fetched on each focus. The art goes to the shared store (art.ts) for the cards and the mode screens. */
export function useHubData(): HubData {
  const [study, setStudy] = useState<StudyEntry | null>(null);
  const [counts, setCounts] = useState<ModeCounts | undefined>(undefined);
  // Only the newest focus fetch applies to home's own state.
  const fetches = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const id = ++fetches.current;
      const turn = ++artFetches;
      fetchHub().then((next) => {
        // The art is shared with the mode screens (art.ts), so it lands even
        // when the player has already tapped through to one (a mode banner
        // then shows their own room, as home's cards do); only a newer
        // fetch's art outranks it.
        if (next.art !== undefined && turn > artFrom) {
          artFrom = turn;
          setOwnArt(next.art);
        }
        if (fetches.current !== id) return;
        if (next.study) setStudy(next.study);
        if (next.counts) setCounts(next.counts);
      });
      return () => {
        // Losing focus drops a late study and counts (not the art).
        fetches.current += 1;
      };
    }, []),
  );

  return { study, counts };
}
