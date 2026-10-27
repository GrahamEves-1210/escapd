// Home's data (MODES_PROMPT.md Part 2, round 6): for each mode, the case the
// player can go back to (its card's "In progress" tag, and what its tap
// offers to continue). Fetched on every focus, and only with a stored
// session: a guest is never created just to label a card. Calls only exported
// API functions (src/lib/escapd-api.ts): the sent rooms, then the latest
// session of each mode's newest ready room (three at most).
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { GENRES } from "@/game/mode";
import { currentSession, getLatestSession, listMyRooms } from "@/lib/escapd-api";
import { NO_CASES, caseToContinue, newestByGenre, type ModeCases } from "./caseStatus";

export interface HubEntry {
  cases: ModeCases;
}

/** What a card's tap needs. Rejects when it can't be read (offline, a server error). */
export async function loadHub(): Promise<HubEntry> {
  if (!(await currentSession())) return { cases: NO_CASES };
  const newest = newestByGenre(await listMyRooms());
  const found = await Promise.all(
    GENRES.map(async (genre) => {
      const room = newest[genre];
      const session = room?.status === "ready" ? await getLatestSession(room.id) : null;
      return [genre, caseToContinue(room, session)] as const;
    }),
  );
  return { cases: Object.fromEntries(found) as ModeCases };
}

/** One focus fetch. Never rejects: a failure is {} and the cards keep what they showed. */
export async function fetchHub(): Promise<Partial<HubEntry>> {
  try {
    return await loadHub();
  } catch {
    return {};
  }
}

export interface HubData {
  /** Undefined until known: no tags. The last known stays through a failed fetch. */
  cases: ModeCases | undefined;
  /** This focus's data once it has landed (a tap can use it at once), else null. */
  fresh: () => HubEntry | null;
  /** This focus's data, waiting for its fetch; asks again if that failed, and rejects if that fails too. */
  entry: () => Promise<HubEntry>;
}

interface FocusFetch {
  promise: Promise<HubEntry | null>;
  landed: HubEntry | null;
}

/** Home's card data, fetched on each focus. */
export function useHubData(): HubData {
  const [cases, setCases] = useState<ModeCases | undefined>(undefined);
  // Only the newest focus fetch applies to home's own state.
  const fetches = useRef(0);
  const current = useRef<FocusFetch | null>(null);

  useFocusEffect(
    useCallback(() => {
      const id = ++fetches.current;
      const fetch: FocusFetch = { promise: Promise.resolve(null), landed: null };
      fetch.promise = loadHub().then(
        (next) => {
          if (fetches.current !== id) return next;
          fetch.landed = next;
          setCases(next.cases);
          return next;
        },
        () => null,
      );
      current.current = fetch;
      return () => {
        // Losing focus drops a late result; the next focus fetches again.
        fetches.current += 1;
        current.current = null;
      };
    }, []),
  );

  const fresh = useCallback(() => current.current?.landed ?? null, []);
  const entry = useCallback(async () => (await current.current?.promise) ?? (await loadHub()), []);

  return { cases, fresh, entry };
}
