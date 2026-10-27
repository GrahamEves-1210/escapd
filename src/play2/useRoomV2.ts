// One room on the v2 engine, played on the device (gameplay v2, chunk 2). The
// room is planned from its v1 objects (adapter.ts); actions run through the
// same engine the server will (`applyAction`), so the feel is the real one.
// Progress is kept per room on the device and resumes; a wrong submit starts a
// short cooldown, as the server's will. Hints walk the next open step's
// three-rung ladder (nudge, direction, reveal).
import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  applyAction, initialState, renderCard,
  type Action, type ActionResult, type PlayState, type RoomDefinitionV2, type RoomSecretV2, type StepDef,
} from "@/engine/v2";
import { ensureSession, getPlayableDefinition, isNetworkError, startOrResume } from "@/lib/escapd-api";
import type { PuzzleDefinitionV1 } from "@/lib/puzzle-types";
import { planFromV1 } from "./adapter";

export const COOLDOWN_MS = 5000;
const KEY = (roomId: string) => `escapd.v2.play.${roomId}`;

export interface Progress {
  state: PlayState;
  /** Hint rungs taken per step id (1..3). */
  hints: Record<string, number>;
  wrong: number;
  startedAt: number;
  completedAt: number | null;
}

export type RoomPhase =
  | { kind: "loading" }
  | { kind: "ready" }
  /** The planner couldn't build a v2 room from this one: play it on the v1 player. */
  | { kind: "fallback"; reason: string }
  | { kind: "error"; offline: boolean };

export interface Room {
  def: RoomDefinitionV2;
  secret: RoomSecretV2;
  v1: PuzzleDefinitionV1;
}

/** The step a hint should help with: the first required step whose prerequisites are met and isn't solved. */
export function nextStep(secret: RoomSecretV2, solved: readonly string[]): StepDef | null {
  return secret.steps.find((s) => !s.optional && !solved.includes(s.id) && s.requires.every((r) => solved.includes(r))) ?? null;
}

export function useRoomV2(roomId: string) {
  const [phase, setPhase] = useState<RoomPhase>({ kind: "loading" });
  const [room, setRoom] = useState<Room | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const progressRef = useRef<Progress | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        const session = await startOrResume(roomId);
        const v1 = await getPlayableDefinition(session.puzzle_version_id);
        const plan = planFromV1(roomId, v1);
        if (cancelled) return;
        if (!plan.ok) {
          setPhase({ kind: "fallback", reason: `${plan.reason}: ${plan.detail}` });
          return;
        }
        let saved: Progress | null = null;
        try {
          const raw = await AsyncStorage.getItem(KEY(roomId));
          saved = raw ? (JSON.parse(raw) as Progress) : null;
        } catch {
          saved = null;
        }
        // A save from another plan (the planner changed) doesn't fit this room: start over.
        const fits = saved && Object.keys(saved.state.objects).every((id) => plan.definition.objects.some((o) => o.id === id));
        const start: Progress = fits && saved && !saved.completedAt
          ? saved
          : { state: initialState(plan.definition), hints: {}, wrong: 0, startedAt: Date.now(), completedAt: null };
        if (cancelled) return;
        progressRef.current = start;
        setRoom({ def: plan.definition, secret: plan.secret, v1 });
        setProgress(start);
        setPhase({ kind: "ready" });
      } catch (error) {
        if (!cancelled) setPhase({ kind: "error", offline: isNetworkError(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // The cooldown's seconds left tick down while it runs.
  useEffect(() => {
    if (cooldownUntil <= now) return;
    const t = setTimeout(() => setNow(Date.now()), 250);
    return () => clearTimeout(t);
  }, [cooldownUntil, now]);

  const commit = useCallback((next: Progress) => {
    progressRef.current = next;
    setProgress(next);
    AsyncStorage.setItem(KEY(roomId), JSON.stringify(next)).catch(() => {});
  }, [roomId]);

  /** Runs one action through the engine and keeps its new state. Synchronous: the engine is local. */
  const act = useCallback((action: Action): ActionResult => {
    const current = progressRef.current;
    if (!room || !current) return { outcome: "invalid", reason: "loading", effects: [] };
    const cooling = Date.now() < cooldownUntil;
    const { state, result } = applyAction(room.def, room.secret, current.state, action, { cooldownActive: cooling });
    if (result.start_cooldown) {
      const until = Date.now() + COOLDOWN_MS;
      setCooldownUntil(until);
      setNow(Date.now());
    }
    commit({
      ...current,
      state,
      wrong: current.wrong + (result.outcome === "wrong" ? 1 : 0),
      completedAt: result.completed ? Date.now() : current.completedAt,
    });
    return result;
  }, [room, cooldownUntil, commit]);

  /** The next rung of the current step's hint ladder, rendered; null when there is nothing left to hint. */
  const hint = useCallback((): { text: string; rung: number } | null => {
    const current = progressRef.current;
    if (!room || !current) return null;
    const step = nextStep(room.secret, current.state.solved);
    if (!step) return null;
    const rung = Math.min(3, (current.hints[step.id] ?? 0) + 1);
    commit({ ...current, hints: { ...current.hints, [step.id]: rung } });
    return { text: renderCard({ id: step.id, title: step.title, text: step.hints[rung - 1] }, room.secret), rung };
  }, [room, commit]);

  /** Start the room again from the top (the same plan). */
  const restart = useCallback(() => {
    if (!room) return;
    setCooldownUntil(0);
    commit({ state: initialState(room.def), hints: {}, wrong: 0, startedAt: Date.now(), completedAt: null });
  }, [room, commit]);

  const cooldown = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const hintsUsed = progress ? Object.values(progress.hints).reduce((a, b) => a + b, 0) : 0;
  return { phase, room, progress, act, hint, restart, cooldown, hintsUsed };
}
