// One room on the v2 engine (gameplay v2, chunks 1 and 2), in either of two
// modes behind one shape:
//   local:  a v1 room (schema_version 1), planned into a v2 room on the device
//           (adapter.ts). The secret stays on the device and each request runs
//           through the same pure `play()` the server runs; progress (the
//           stored state and the cooldown) is kept per room and resumes.
//   server: a v2 room (schema_version 2). No secret on the device: each request
//           goes to the play-action edge function (`playActionV2`), one at a
//           time (`busy`), and the response is the whole truth.
// Either way the UI gets the state, the rendered casebook (cards and hint
// rungs), the cooldown's seconds left, and the ending once complete.
import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  COOLDOWN_MS, play, storedState,
  type Action, type ActionResult, type FoundCardV2, type PlayRequest, type PlayResponse, type PlayState,
  type RoomDefinitionV2, type RoomSecretV2, type StoredStateV2,
} from "@/engine/v2";
import { abandonSession, ensureSession, getPlayableDefinition, isNetworkError, playActionV2, startOrResume } from "@/lib/escapd-api";
import type { ScenePhoto } from "@/game/useSceneSources";
import { planFromV1 } from "./adapter";

const KEY = (roomId: string) => `escapd.v2.play.${roomId}`;

/** What a local room keeps on the device between visits. */
interface LocalSave {
  v: 2;
  state: StoredStateV2;
  lockedUntil: number | null;
}

export type RoomPhase =
  | { kind: "loading" }
  | { kind: "ready" }
  /** The planner couldn't build a v2 room from this one: play it on the v1 player. */
  | { kind: "fallback"; reason: string }
  | { kind: "error"; offline: boolean };

export type RoomMode = "local" | "server";

/** A request that didn't go through (server mode): for a toast. `seq` changes with each one. */
export interface RequestError {
  offline: boolean;
  seq: number;
}

type Engine =
  | { mode: "local"; def: RoomDefinitionV2; secret: RoomSecretV2; stored: StoredStateV2; lockedUntil: number | null }
  | { mode: "server"; def: RoomDefinitionV2; sessionId: string };

interface View {
  state: PlayState;
  cards: FoundCardV2[];
  hints: string[];
  canHint: boolean;
  cooldownUntil: number;
  completed: boolean;
  ending: string | null;
}

const viewOf = (r: PlayResponse): View => ({
  state: r.state,
  cards: r.cards,
  hints: r.hints,
  canHint: r.can_hint,
  // The server's clock may differ from the device's: never wait longer than one cooldown from now.
  cooldownUntil: r.cooldown_until === null ? 0 : Math.min(r.cooldown_until, Date.now() + COOLDOWN_MS),
  completed: r.completed,
  ending: r.ending ?? null,
});

/** A saved local game, from this shape or the first one ({ state, hints, completedAt }); null when there is none to resume. */
function readSave(raw: string | null): LocalSave | null {
  try {
    const s = raw ? JSON.parse(raw) : null;
    if (!s || typeof s !== "object") return null;
    if (s.v === 2 && s.state && typeof s.state === "object") return s as LocalSave;
    // The first save shape: the engine's state with the hint rungs beside it. A finished one starts over.
    if (s.state && typeof s.state === "object" && !s.completedAt) {
      return { v: 2, state: { ...s.state, hints: s.hints ?? {}, revealed_hotspots: [] }, lockedUntil: null };
    }
  } catch {
    // Unreadable: start over.
  }
  return null;
}

const isConflict = (error: unknown) => (error as { code?: string } | null)?.code === "conflict";

export function useRoomV2(roomId: string) {
  const [phase, setPhase] = useState<RoomPhase>({ kind: "loading" });
  const [def, setDef] = useState<RoomDefinitionV2 | null>(null);
  const [mode, setMode] = useState<RoomMode | null>(null);
  // The photos for useSceneSources (the v1 room's, or the v2 room's): one object per load.
  const [scene, setScene] = useState<{ photos: readonly ScenePhoto[] } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RequestError | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loadKey, setLoadKey] = useState(0);
  const engine = useRef<Engine | null>(null);
  const inFlight = useRef(false);

  const show = useCallback((response: PlayResponse) => {
    setView(viewOf(response));
    setNow(Date.now());
  }, []);

  useEffect(() => {
    let cancelled = false;
    engine.current = null;
    (async () => {
      try {
        await ensureSession();
        const session = await startOrResume(roomId);
        const loadedDef = await getPlayableDefinition(session.puzzle_version_id);
        if (cancelled) return;

        if (loadedDef.schema_version === 2) {
          const response = await playActionV2(session.id, {});
          if (cancelled) return;
          engine.current = { mode: "server", def: loadedDef, sessionId: session.id };
          setDef(loadedDef);
          setMode("server");
          setScene({ photos: loadedDef.photos ?? [] });
          show(response);
          setPhase({ kind: "ready" });
          return;
        }

        const plan = planFromV1(roomId, loadedDef);
        if (!plan.ok) {
          setPhase({ kind: "fallback", reason: `${plan.reason}: ${plan.detail}` });
          return;
        }
        let saved: LocalSave | null = null;
        try {
          saved = readSave(await AsyncStorage.getItem(KEY(roomId)));
        } catch {
          saved = null;
        }
        // A save from another plan (the planner changed) doesn't fit this room, and a finished one is done: start over.
        const fits = !!saved && !saved.state.completed && Object.keys(saved.state.objects ?? {}).every((id) => plan.definition.objects.some((o) => o.id === id));
        const stored = storedState(plan.definition, fits ? saved!.state : null);
        const lockedUntil = fits ? saved!.lockedUntil : null;
        const { response } = play(plan.definition, plan.secret, stored, {}, Date.now(), lockedUntil);
        if (cancelled) return;
        engine.current = { mode: "local", def: plan.definition, secret: plan.secret, stored, lockedUntil };
        setDef(plan.definition);
        setMode("local");
        setScene(loadedDef);
        show(response);
        setPhase({ kind: "ready" });
      } catch (e) {
        if (!cancelled) setPhase({ kind: "error", offline: isNetworkError(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, loadKey, show]);

  // The cooldown's seconds left tick down while it runs.
  const cooldownUntil = view?.cooldownUntil ?? 0;
  useEffect(() => {
    if (cooldownUntil <= now) return;
    const t = setTimeout(() => setNow(Date.now()), 250);
    return () => clearTimeout(t);
  }, [cooldownUntil, now]);

  /** One request through `play()`: on the device, or on the server. Null when it didn't go through (or one is in flight). */
  const request = useCallback(async (req: PlayRequest): Promise<PlayResponse | null> => {
    const e = engine.current;
    if (!e) return null;
    if (e.mode === "local") {
      const { response, save } = play(e.def, e.secret, e.stored, req, Date.now(), e.lockedUntil);
      if (save) {
        e.stored = save.state;
        e.lockedUntil = save.lockedUntil;
        const out: LocalSave = { v: 2, state: save.state, lockedUntil: save.lockedUntil };
        AsyncStorage.setItem(KEY(roomId), JSON.stringify(out)).catch(() => {});
      }
      show(response);
      return response;
    }
    // One request at a time: a double tap must not send two.
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    try {
      let response: PlayResponse;
      try {
        response = await playActionV2(e.sessionId, req);
      } catch (first) {
        // Another request saved first: catch up, then try once more.
        if (!isConflict(first)) throw first;
        show(await playActionV2(e.sessionId, {}));
        response = await playActionV2(e.sessionId, req);
      }
      if (engine.current === e) show(response);
      return response;
    } catch (err) {
      setError((prev) => ({ offline: isNetworkError(err), seq: (prev?.seq ?? 0) + 1 }));
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [roomId, show]);

  /** Runs one action; its result, or null when it didn't go through. */
  const act = useCallback(async (action: Action): Promise<ActionResult | null> => {
    const response = await request({ action });
    return response?.result ?? null;
  }, [request]);

  /** The next rung of the current step's hint ladder, rendered; null when there is nothing left to hint (or it failed). */
  const hint = useCallback(async (): Promise<{ text: string; rung: number } | null> => {
    const response = await request({ hint: true });
    return response?.hint ?? null;
  }, [request]);

  /**
   * Start the room again from the top. Local: the same plan, fresh. Server:
   * leave this session (its history is kept) and start a new one. False when
   * it couldn't (offline).
   */
  const restart = useCallback(async (): Promise<boolean> => {
    const e = engine.current;
    if (!e) return false;
    if (e.mode === "local") {
      const stored = storedState(e.def, null);
      e.stored = stored;
      e.lockedUntil = null;
      AsyncStorage.removeItem(KEY(roomId)).catch(() => {});
      show(play(e.def, e.secret, stored, {}, Date.now(), null).response);
      return true;
    }
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    try {
      try {
        await abandonSession(e.sessionId);
      } catch (err) {
        // Already ended elsewhere: nothing to abandon, a fresh load is enough.
        if ((err as { code?: string } | null)?.code !== "P0002") throw err;
      }
      setPhase({ kind: "loading" });
      setLoadKey((k) => k + 1);
      return true;
    } catch (err) {
      setError((prev) => ({ offline: isNetworkError(err), seq: (prev?.seq ?? 0) + 1 }));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [roomId, show]);

  const cooldown = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  return {
    phase,
    mode,
    def,
    scene,
    state: view?.state ?? null,
    cards: view?.cards ?? [],
    hints: view?.hints ?? [],
    canHint: view?.canHint ?? false,
    hintsUsed: view?.hints.length ?? 0,
    cooldown,
    completed: view?.completed ?? false,
    ending: view?.ending ?? null,
    busy,
    error,
    act,
    hint,
    restart,
  };
}

export type RoomV2 = ReturnType<typeof useRoomV2>;
