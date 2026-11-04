// Keeps the casebook's thread log (journal/threads.ts) for one room: notes
// each card as it turns up (where the player was acting, how far the case had
// got), and remembers which strings the casebook has already shown pulled
// taut. Mounted with the room (the casebook comes and goes); kept on the
// device per room, emptied when the casebook is (a restart, a new case).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Action, ActionResult } from "@/engine/v2";
import type { RoomV2 } from "../useRoomV2";
import { markSeen, placeOf, readLog, record, type ThreadLog } from "./threads";

const KEY = (roomId: string) => `escapd.v2.threads.${roomId}`;

export interface CaseThreads {
  /** The log; null until it has been read. */
  log: ThreadLog | null;
  /** The room's `act`, noting where each action happens. */
  act: (action: Action) => Promise<ActionResult | null>;
  /** The casebook has shown these strings taut and this many steps solved. */
  seen: (taut: readonly string[], ticked: number) => void;
}

export function useCaseThreads(roomId: string, v2: Pick<RoomV2, "phase" | "state" | "cards" | "progress" | "act">): CaseThreads {
  // The log, for the room it was read for (another room's reads as not read yet).
  const [held, setHeld] = useState<{ roomId: string; log: ThreadLog } | null>(null);
  const log = held?.roomId === roomId ? held.log : null;
  const setLog = useCallback((next: ThreadLog | ((l: ThreadLog | null) => ThreadLog | null)) => {
    setHeld((h) => {
      const current = h?.roomId === roomId ? h.log : null;
      const value = typeof next === "function" ? next(current) : next;
      return value ? { roomId, log: value } : h;
    });
  }, [roomId]);
  // Nothing saved yet: the first cards seen were found before the log was kept.
  const restoring = useRef(false);
  const place = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY(roomId))
      .catch(() => null)
      .then((raw) => {
        if (!live) return;
        restoring.current = !raw;
        setLog(readLog(raw));
      });
    return () => {
      live = false;
    };
  }, [roomId, setLog]);

  const keep = useCallback((next: ThreadLog) => {
    AsyncStorage.setItem(KEY(roomId), JSON.stringify(next)).catch(() => {});
  }, [roomId]);

  const ready = v2.phase.kind === "ready" && !!v2.state;
  const { cards } = v2;
  const solved = v2.progress.solved;
  useEffect(() => {
    if (!log || !ready) return;
    const ids = cards.map((c) => c.id);
    // Only the cards there as the room first comes up can predate the log.
    const next = record(log, ids, solved, place.current, restoring.current);
    restoring.current = false;
    if (next !== log) {
      setLog(next);
      keep(next);
    }
  }, [log, ready, cards, solved, keep, setLog]);

  const rawAct = v2.act;
  const act = useCallback((action: Action) => {
    place.current = placeOf(action);
    return rawAct(action);
  }, [rawAct]);

  const seen = useCallback((taut: readonly string[], ticked: number) => {
    setLog((l) => {
      if (!l) return l;
      const next = markSeen(l, taut, ticked);
      if (next !== l) keep(next);
      return next;
    });
  }, [keep, setLog]);

  return useMemo(() => ({ log, act, seen }), [log, act, seen]);
}
