// Loads a room's session and definition and sends actions to submit_action.
//
// There is no local rules engine. Progress changes only when the server
// returns `outcome: "solved"` with a `state`, which replaces ours wholesale.
// Nothing is applied optimistically and nothing is queued while offline: a
// failed request keeps the last state on screen and can be retried as-is.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError, abandonSession, ensureSession, getPlayableDefinition, isNetworkError, startOrResume, submitAction,
  type GameSession,
} from "@/lib/escapd-api";
import type { ActionResult, GameAction, PuzzleDefinitionV1, SessionState } from "@/lib/puzzle-types";
import { EMPTY_STATE, definitionProblem } from "./selectors";

export type LoadError =
  | { kind: "offline" }
  | { kind: "not_found" }
  | { kind: "not_ready" }
  | { kind: "unsupported"; reason: string }
  | { kind: "unknown"; message: string };

export type PlayerPhase = { kind: "loading" } | { kind: "ready" } | { kind: "error"; error: LoadError };

export interface FailedAction {
  action: GameAction;
  offline: boolean;
  message: string;
}

/** What happened to one send: a server result, a failed request, or ignored because another is in flight. */
export type SendOutcome =
  | { kind: "result"; result: ActionResult }
  | { kind: "failed"; offline: boolean }
  | { kind: "busy" };

function classifyLoadError(error: unknown): LoadError {
  if (isNetworkError(error)) return { kind: "offline" };
  if (error instanceof ApiError) {
    if (error.code === "P0002" || error.code === "PGRST116") return { kind: "not_found" };
    if (error.code === "55000") return { kind: "not_ready" };
  }
  return { kind: "unknown", message: error instanceof Error ? error.message : String(error) };
}

export function usePlayer(roomId: string) {
  const [phase, setPhase] = useState<PlayerPhase>({ kind: "loading" });
  const [session, setSession] = useState<GameSession | null>(null);
  const [definition, setDefinition] = useState<PuzzleDefinitionV1 | null>(null);
  const [state, setState] = useState<SessionState>(EMPTY_STATE);
  const [pending, setPending] = useState<GameAction | null>(null);
  const [failed, setFailed] = useState<FailedAction | null>(null);
  const inFlight = useRef(false);
  // Bumped by `load` to fetch again (retry, restart, a session that ended elsewhere).
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        const nextSession = await startOrResume(roomId);
        // Load the version this session started on, not the room's current one.
        const nextDefinition = await getPlayableDefinition(nextSession.puzzle_version_id);
        if (cancelled) return;
        const problem = definitionProblem(nextDefinition);
        if (problem) {
          setPhase({ kind: "error", error: { kind: "unsupported", reason: problem } });
          return;
        }
        setSession(nextSession);
        setDefinition(nextDefinition);
        setState(nextSession.state as unknown as SessionState);
        setPhase({ kind: "ready" });
      } catch (error) {
        if (!cancelled) setPhase({ kind: "error", error: classifyLoadError(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, loadKey]);

  const load = useCallback(() => {
    setPhase({ kind: "loading" });
    setFailed(null);
    setLoadKey((k) => k + 1);
  }, []);

  const send = useCallback(async (action: GameAction): Promise<SendOutcome> => {
    // One action at a time. A double tap must not send two requests.
    if (!session || inFlight.current) return { kind: "busy" };
    inFlight.current = true;
    setPending(action);
    setFailed(null);
    try {
      const result = await submitAction(session.id, action);
      if (result.outcome === "solved" && result.state) setState(result.state);
      if (result.completed) {
        setSession((s) => (s ? { ...s, status: "completed", completed_at: new Date().toISOString() } : s));
      }
      return { kind: "result", result };
    } catch (error) {
      if (error instanceof ApiError && error.code === "55000") {
        // The session ended elsewhere (completed or abandoned). Reload rather
        // than keep sending into a closed session.
        load();
        return { kind: "failed", offline: false };
      }
      const offline = isNetworkError(error);
      setFailed({ action, offline, message: error instanceof Error ? error.message : String(error) });
      return { kind: "failed", offline };
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }, [session, load]);

  /** Re-sends the exact action that failed. Safe: a committed solve returns nothing or invalid the second time. */
  const retry = useCallback(
    (): Promise<SendOutcome> => (failed ? send(failed.action) : Promise.resolve({ kind: "busy" })),
    [failed, send],
  );

  const dismissFailure = useCallback(() => setFailed(null), []);

  /** Leave the current run (history is kept) and start fresh. */
  const restart = useCallback(async () => {
    if (session?.status === "active") {
      try {
        await abandonSession(session.id);
      } catch (error) {
        // Already ended elsewhere: nothing to abandon, a fresh load is enough.
        if (!(error instanceof ApiError && error.code === "P0002")) throw error;
      }
    }
    load();
  }, [session, load]);

  return { phase, session, definition, state, pending, failed, send, retry, dismissFailure, restart, reload: load };
}

export type Player = ReturnType<typeof usePlayer>;
