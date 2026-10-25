// THE STUDY's entry and YOUR CASE's status for the hub (docs/DESIGN.md, 01
// States: Loading, Developing, Fetch failure, Case status). Fetched on every
// focus, and only with a stored session: a guest is never created just to
// label a card. Calls only the existing exported API functions.
import { useCallback, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useFocusEffect } from "expo-router";
import { POLL_MS } from "@/capture/useDevelopment";
import { currentSession, getLatestCustomRoom, getLatestSession, getRoom, isNetworkError, watchRoom } from "@/lib/escapd-api";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import {
  FAILED_ANNOUNCEMENT,
  READY_ANNOUNCEMENT,
  caseForRoom,
  studyEntry,
  type CaseState,
  type StudyEntry,
} from "./caseStatus";

export interface HubFetch {
  /** Absent when the fetch failed: THE STUDY keeps what it showed (UNSEAL at first). */
  study?: StudyEntry;
  ownCase: CaseState;
}

/**
 * One focus fetch. Never rejects: a failure becomes OFFLINE (network) or
 * TRY LATER (anything else) on YOUR CASE. The tutorial session and the newest
 * own room are read in parallel, then the latest session of a ready room.
 * getLatestCustomRoom() still returns drafts, so a draft maps to no room.
 */
export async function fetchHub(): Promise<HubFetch> {
  try {
    if (!(await currentSession())) return { study: "unseal", ownCase: { kind: "none" } };
    const [tutorial, room] = await Promise.all([getLatestSession(TUTORIAL_ROOM_ID), getLatestCustomRoom()]);
    const session = room?.status === "ready" ? await getLatestSession(room.id) : null;
    return { study: studyEntry(tutorial), ownCase: caseForRoom(room, session) };
  } catch (error) {
    return { ownCase: { kind: isNetworkError(error) ? "offline" : "tryLater" } };
  }
}

export interface HubData {
  study: StudyEntry;
  ownCase: CaseState;
  /** True once a developing case flipped while the hub was open: its note eases from the shimmer's meta to read. */
  flipped: boolean;
}

/**
 * The hub's card data. YOUR CASE starts as loading (blank note, taps ignored)
 * and keeps its last state through later focus fetches, so nothing flashes.
 * While it develops and the hub has focus, the room is followed with
 * watchRoom plus a poll every POLL_MS (as /capture/develop does); a flip to
 * ready or failed is announced. Following stops when the hub loses focus.
 */
export function useHubData(): HubData {
  const [study, setStudy] = useState<StudyEntry>("unseal");
  const [ownCase, setOwnCase] = useState<CaseState>({ kind: "loading" });
  const [flipped, setFlipped] = useState(false);
  // Bumped on every flip, so a focus fetch that started earlier can't undo it.
  const flips = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const startedAt = flips.current;
      fetchHub().then((next) => {
        if (!active || flips.current !== startedAt) return;
        if (next.study) setStudy(next.study);
        setOwnCase(next.ownCase);
        setFlipped(false);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const developingId = ownCase.kind === "developing" ? ownCase.roomId : null;
  useFocusEffect(
    useCallback(() => {
      if (!developingId) return;
      let following = true;
      const apply = (status: string) => {
        if (!following || (status !== "ready" && status !== "failed")) return;
        following = false;
        flips.current += 1;
        setOwnCase(status === "ready" ? { kind: "ready", roomId: developingId, progress: "open" } : { kind: "failed", roomId: developingId });
        setFlipped(true);
        AccessibilityInfo.announceForAccessibility(status === "ready" ? READY_ANNOUNCEMENT : FAILED_ANNOUNCEMENT);
      };
      // Realtime is fastest; the poll covers a dropped socket or a missed event.
      const unwatch = watchRoom(developingId, apply);
      const timer = setInterval(() => {
        getRoom(developingId).then((room) => apply(room.status), () => {});
      }, POLL_MS);
      return () => {
        following = false;
        clearInterval(timer);
        unwatch();
      };
    }, [developingId]),
  );

  return { study, ownCase, flipped };
}
