// A mode screen's data (MODES_PROMPT.md Part 2): the player's cases in that
// mode as case files, The Study's stamp on noir, and whether New case shows
// the Pro lock. Fetched on every focus, and only with a stored session: a
// guest is never created just to look. One list query, one query for the
// latest sessions, one for the cover photos (caseQueries.ts), then the
// photos' signatures in parallel. While a case builds and the screen has
// focus, it is followed with watchRoom plus a poll every POLL_MS (as home's
// YOUR CASE was); a flip to ready or failed is announced and the list reloads.
import { useCallback, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useFocusEffect } from "expo-router";
import { POLL_MS } from "@/capture/useDevelopment";
import { currentSession, getLatestSession, getMyAccess, getRoom, isNetworkError, listMyRooms, watchRoom } from "@/lib/escapd-api";
import type { Genre, MyAccess } from "@/lib/puzzle-types";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import {
  FAILED_ANNOUNCEMENT,
  READY_ANNOUNCEMENT,
  caseTitle,
  stampFor,
  studyStamp,
  type CaseFile,
  type CaseStamp,
} from "./caseFiles";
import { coverPhotos, latestSessionStatuses, signCovers } from "./caseQueries";

export type CaseList =
  | { kind: "loading" }
  | { kind: "ready"; files: CaseFile[] }
  | { kind: "offline" }
  | { kind: "tryLater" };

export interface ModeFetch {
  cases: CaseList;
  /** Noir's The Study, from its latest session; null in the other modes. Absent when it couldn't be read. */
  study?: CaseStamp | null;
}

/** The player's cases in a mode, newest first, as case files. Throws when the list can't be read. */
export async function fetchCaseFiles(genre: Genre): Promise<CaseFile[]> {
  const rooms = await listMyRooms({ genre });
  const ids = rooms.map((room) => room.id);
  const ready = rooms.filter((room) => room.status === "ready").map((room) => room.id);
  const [sessions, covers] = await Promise.all([
    latestSessionStatuses(ready),
    // A missing photo never hides the list.
    coverPhotos(ids).catch(() => new Map<string, never>()),
  ]);
  const signed = await signCovers([...covers.values()]);
  const files: CaseFile[] = [];
  for (const room of rooms) {
    const stamp = stampFor(room, sessions.get(room.id));
    if (!stamp) continue;
    const cover = covers.get(room.id);
    const uri = cover ? signed.get(cover.id) : undefined;
    files.push({
      roomId: room.id,
      title: caseTitle(room.title),
      createdAt: room.created_at,
      stamp,
      cover: cover && uri ? { id: cover.id, uri } : null,
    });
  }
  return files;
}

/** One focus fetch. Never rejects: a failure becomes Offline (network) or Try later. */
export async function fetchMode(genre: Genre): Promise<ModeFetch> {
  try {
    if (!(await currentSession())) return { cases: { kind: "ready", files: [] }, study: genre === "noir" ? "open" : null };
    const [files, study] = await Promise.all([
      fetchCaseFiles(genre),
      genre === "noir"
        ? getLatestSession(TUTORIAL_ROOM_ID).then(
            (session) => studyStamp(session?.status),
            () => undefined,
          )
        : Promise.resolve(null),
    ]);
    return { cases: { kind: "ready", files }, study };
  } catch (error) {
    return { cases: { kind: isNetworkError(error) ? "offline" : "tryLater" } };
  }
}

/** Each mode's last list, so coming back shows it at once while it refreshes. */
const lastLists = new Map<Genre, ModeFetch>();

/**
 * New case's Pro lock: true without the custom-rooms entitlement (a player
 * with no account yet has none), false with it, null while unknown (no lock
 * shows). Kept across mode screens and refreshed on each focus.
 */
let lastLock: boolean | null = null;

export async function fetchLock(): Promise<boolean | null> {
  try {
    if (!(await currentSession())) return true;
    const access: MyAccess = await getMyAccess();
    return !access.has_custom_rooms_entitlement;
  } catch {
    return null;
  }
}

/** Forgets the remembered lock (tests). */
export function resetModeCache() {
  lastLock = null;
  lastLists.clear();
}

export interface ModeData {
  cases: CaseList;
  /** Noir only: The Study's stamp; null elsewhere and until known. */
  study: CaseStamp | null;
  /** New case's Pro lock: null while unknown. */
  locked: boolean | null;
  /** Fetch again now (Try again). */
  reload: () => void;
}

export function useModeCases(genre: Genre): ModeData {
  const [state, setState] = useState<ModeFetch>(() => lastLists.get(genre) ?? { cases: { kind: "loading" } });
  const [study, setStudy] = useState<CaseStamp | null>(() => lastLists.get(genre)?.study ?? null);
  const [locked, setLocked] = useState<boolean | null>(lastLock);
  // Only the newest fetch applies.
  const fetches = useRef(0);

  const load = useCallback(() => {
    const id = ++fetches.current;
    fetchMode(genre).then((next) => {
      if (fetches.current !== id) return;
      // A failed refresh keeps a list already shown.
      setState((current) => (next.cases.kind !== "ready" && current.cases.kind === "ready" ? current : next));
      if (next.study !== undefined) setStudy(next.study);
      if (next.cases.kind === "ready") lastLists.set(genre, next);
    });
  }, [genre]);

  useFocusEffect(
    useCallback(() => {
      load();
      let live = true;
      fetchLock().then((lock) => {
        if (!live || lock === null) return;
        lastLock = lock;
        setLocked(lock);
      });
      return () => {
        live = false;
        // Losing focus drops a late result.
        fetches.current += 1;
      };
    }, [load]),
  );

  // Follow every building case while the screen has focus.
  const building =
    state.cases.kind === "ready"
      ? state.cases.files
          .filter((file) => file.stamp === "building")
          .map((file) => file.roomId)
          .join(",")
      : "";
  useFocusEffect(
    useCallback(() => {
      if (!building) return;
      const ids = building.split(",");
      let following = true;
      const apply = (status: string) => {
        if (!following || (status !== "ready" && status !== "failed")) return;
        following = false;
        AccessibilityInfo.announceForAccessibility(status === "ready" ? READY_ANNOUNCEMENT : FAILED_ANNOUNCEMENT);
        load();
      };
      // Realtime is fastest; the poll covers a dropped socket or a missed event.
      const unwatch = ids.map((id) => watchRoom(id, apply));
      const timer = setInterval(() => {
        for (const id of ids) getRoom(id).then((room) => apply(room.status), () => {});
      }, POLL_MS);
      return () => {
        following = false;
        clearInterval(timer);
        for (const stop of unwatch) stop();
      };
    }, [building, load]),
  );

  return { cases: state.cases, study, locked, reload: load };
}
