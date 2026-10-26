// 06 · The build wait's words. Plain language (round 4): photos, building,
// ready; the screen is never named, no darkroom or film words, and AI is never
// mentioned. One short title and one status line under it. The generation
// job reports only queued and running, so the running lines describe what
// building does, in rotation, and never claim to be the live step or an order.
// A light touch of each mode's voice (src/render/voice.ts) on those lines
// only; the counts and the queue stay factual.
import type { DevStage } from "@/capture/useDevelopment";
import type { Genre } from "@/lib/puzzle-types";

/** The stages that are a real wait: photos sending, or the job queued or running. */
export type WaitStage = Extract<DevStage, { kind: "sending" | "waiting" }>;

/** What the status line says during a wait. `key` changes only when the meaning does (a new count is a new key). */
export interface WaitStatus {
  /** sending · queued · running · retry: the kind of wait, for the typewriter cue. */
  phase: "sending" | "queued" | "running" | "retry";
  lines: readonly string[];
  /** Extra strings the line's box is sized to, so it never resizes as a count climbs. */
  sizeTo?: readonly string[];
  /** The fixed status screen readers hear (never the rotating copy). */
  label: string;
}

/** The title, through every wait. */
export const BUILD_TITLE = "Building your case";
export const READY_TITLE = "Your case is ready";
/** The status line once ready. */
export const READY_LINE = "It's all in your photos";
export const STAMP_TEXT = "CASE READY";

/** The queued line. */
export const QUEUED_LINE = "Your case is next";
export const RETRY_LINE = "Trying again";

/** Running: what building does, per mode. Each says the same three real steps: the objects, what to hide, the case. */
export const BUILDING_LINES: Readonly<Record<Genre | "shell", readonly string[]>> = {
  shell: ["Finding the objects", "Choosing what to hide", "Writing the case"],
  noir: ["Going over every object", "Choosing what to hide", "Writing the case"],
  crime_scene: ["Logging every object", "Choosing what to hide", "Writing up the case"],
  paranormal: ["Searching every corner", "Choosing what to hide", "Writing the case"],
};

/** What screen readers hear while it builds (one fixed label; the rotation is never announced). */
export const BUILDING_LABEL = "Building your case: finding the objects, choosing what to hide and writing the case";

/** The longest a status line may be: one line at 22 pt on a 375 pt screen. */
export const STATUS_MAX = 24;

export const sendingLine = (n: number, total: number) => `Sending photo ${n} of ${total}`;

export function waitStatus(stage: WaitStage, genre: Genre | null): WaitStatus {
  if (stage.kind === "sending") {
    const n = Math.min(stage.sent + 1, stage.total);
    const line = sendingLine(n, stage.total);
    return {
      phase: "sending",
      lines: [line],
      sizeTo: Array.from({ length: stage.total }, (_, i) => sendingLine(i + 1, stage.total)),
      label: line,
    };
  }
  if (stage.job.status === "running") {
    return { phase: "running", lines: BUILDING_LINES[genre ?? "shell"], label: BUILDING_LABEL };
  }
  if (stage.job.attempt_count > 0) return { phase: "retry", lines: [RETRY_LINE], label: RETRY_LINE };
  return { phase: "queued", lines: [QUEUED_LINE], label: QUEUED_LINE };
}
