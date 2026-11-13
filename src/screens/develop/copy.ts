// 06 · The build wait's words: as few as it can honestly have. The darkroom
// shows where the case is (src/screens/develop/Darkroom.tsx), so the screen
// says one thing, small: "Building your case", then "Your case is ready". One
// more line appears only when there is something the room can't show: the
// build is being tried again. Plain language (round 4): photos, building,
// ready; no darkroom or film words, and AI is never mentioned.
//
// Screen readers can't see the room, so they hear each wait in full (`label`):
// the photo being sent, the queue, what building does, a second try.
import type { DevStage } from "@/capture/useDevelopment";

/** The stages that are a real wait: photos sending, or the job queued or running. */
export type WaitStage = Extract<DevStage, { kind: "sending" | "waiting" }>;

/** A wait, in words. */
export interface WaitStatus {
  /** sending · queued · running · retry: the kind of wait, for the typewriter cue. */
  phase: "sending" | "queued" | "running" | "retry";
  /** The line shown under the title, when the room can't say it. */
  line: string | null;
  /** What screen readers hear. */
  label: string;
}

/** The title, through every wait. */
export const BUILD_TITLE = "Building your case";
export const READY_TITLE = "Your case is ready";
export const STAMP_TEXT = "CASE READY";

export const QUEUED_LINE = "Your case is next";
export const RETRY_LINE = "Trying again";

/** What screen readers hear while it builds: the three real steps. */
export const BUILDING_LABEL = "Building your case: finding the objects, choosing what to hide and writing the case";

/** The longest a shown line may be: one line on a 375 pt screen. */
export const STATUS_MAX = 24;

export const sendingLine = (n: number, total: number) => `Sending photo ${n} of ${total}`;

export function waitStatus(stage: WaitStage): WaitStatus {
  if (stage.kind === "sending") return { phase: "sending", line: null, label: sendingLine(Math.min(stage.sent + 1, stage.total), stage.total) };
  if (stage.job.status === "running") return { phase: "running", line: null, label: BUILDING_LABEL };
  if (stage.job.attempt_count > 0) return { phase: "retry", line: RETRY_LINE, label: RETRY_LINE };
  return { phase: "queued", line: null, label: QUEUED_LINE };
}
