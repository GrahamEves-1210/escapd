// Drives the darkroom: access check, sending plates, then following the
// generation job until the case is ready or fails. The server owns every
// decision; this only reports where the job is.
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  getGenerationJob,
  getLatestGenerationJob,
  getMyAccess,
  isNetworkError,
  watchGenerationJob,
  type GenerationJob,
} from "@/lib/escapd-api";
import { describeFailure, type FailureCopy } from "./failure";
import { getPlates, getSlots } from "./roll";
import { developPlates, redevelop } from "./send";
import { MIN_PLATES } from "./slots";

export const POLL_MS = 5000;

export type DevStage =
  | { kind: "checking" }
  | { kind: "account" }                                  // guest: needs an email first
  | { kind: "access"; reason: "entitlement" | "cap" }
  | { kind: "sending"; sent: number; total: number }
  | { kind: "waiting"; roomId: string; job: GenerationJob }
  | { kind: "ready"; roomId: string }
  | { kind: "failed"; roomId: string; copy: FailureCopy }
  | { kind: "error"; message: string };

/** Where a job stands, as a stage. */
export function stageForJob(roomId: string, job: GenerationJob): DevStage {
  if (job.status === "succeeded") return { kind: "ready", roomId };
  if (job.status === "failed" || job.status === "cancelled") return { kind: "failed", roomId, copy: describeFailure(job) };
  return { kind: "waiting", roomId, job };
}

export function errorStage(error: unknown): DevStage {
  if (error instanceof ApiError && error.code === "42501") {
    return /subscription/i.test(error.message) ? { kind: "access", reason: "entitlement" } : { kind: "account" };
  }
  if (error instanceof ApiError && error.code === "54000") return { kind: "access", reason: "cap" };
  return {
    kind: "error",
    message: isNetworkError(error)
      ? "You're offline. Your photos are safe. Connect and try again."
      : "Couldn't connect to ESCAPD. Your photos are safe. Try again.",
  };
}

interface Attempt {
  n: number;
  /** Develop this failed room again instead of starting from the plates. */
  redevelopRoomId?: string;
}

/**
 * `resumeRoomId` follows a room that is already developing (opened from the
 * title screen). Without it, the plates on the roll are sent.
 */
export function useDevelopment(resumeRoomId?: string) {
  const [stage, setStage] = useState<DevStage>({ kind: "checking" });
  const [attempt, setAttempt] = useState<Attempt>({ n: 0 });

  useEffect(() => {
    let cancelled = false;
    let stopFollowing: (() => void) | null = null;

    const follow = (roomId: string, job: GenerationJob) => {
      const apply = (next: GenerationJob) => {
        if (cancelled) return;
        const nextStage = stageForJob(roomId, next);
        setStage(nextStage);
        if (nextStage.kind !== "waiting") stopFollowing?.();
      };
      apply(job);
      if (cancelled || (job.status !== "queued" && job.status !== "running")) return;
      // Realtime is fastest; polling covers a dropped socket or a missed event.
      const unwatch = watchGenerationJob(job.id, apply);
      const timer = setInterval(() => {
        getGenerationJob(job.id).then(apply, () => {});
      }, POLL_MS);
      stopFollowing = () => {
        clearInterval(timer);
        unwatch();
        stopFollowing = null;
      };
    };

    (async () => {
      try {
        if (attempt.redevelopRoomId) {
          const job = await redevelop(attempt.redevelopRoomId);
          if (!cancelled) follow(attempt.redevelopRoomId, job);
          return;
        }
        if (resumeRoomId) {
          const job = await getLatestGenerationJob(resumeRoomId);
          if (cancelled) return;
          if (job) follow(resumeRoomId, job);
          else setStage({ kind: "error", message: "This case was never sent. Take the photos again." });
          return;
        }
        const access = await getMyAccess();
        if (cancelled) return;
        if (access.is_anonymous) return setStage({ kind: "account" });
        if (!access.has_custom_rooms_entitlement) return setStage({ kind: "access", reason: "entitlement" });
        if (!access.can_generate) return setStage({ kind: "access", reason: "cap" });
        // Plates live in memory: an app restart on this screen loses them.
        if (getPlates().length < MIN_PLATES) {
          return setStage({ kind: "error", message: "Your photos were cleared when the app closed. Take them again." });
        }
        const { roomId, job } = await developPlates(getSlots(), (sent, total) => {
          if (!cancelled) setStage({ kind: "sending", sent, total });
        });
        if (!cancelled) follow(roomId, job);
      } catch (error) {
        if (!cancelled) setStage(errorStage(error));
      }
    })();

    return () => {
      cancelled = true;
      stopFollowing?.();
    };
  }, [resumeRoomId, attempt]);

  /** Try again from wherever it stopped, or develop a failed room again. */
  const retry = useCallback((redevelopRoomId?: string) => {
    setStage({ kind: "checking" });
    setAttempt((a) => ({ n: a.n + 1, redevelopRoomId }));
  }, []);

  return { stage, retry };
}
