// 06 · The build wait: what the screen says during each real wait. Plain
// language (round 4): photos, "building", "ready"; the screen is never named.
// The stamp, title and body are the screen's copy; `thinking` is the line
// under the glass. The generation job reports only queued and running, so the
// lines describe the job and never claim to be the live step.
import type { DevStage } from "@/capture/useDevelopment";
import type { GenerationJob } from "@/lib/escapd-api";

/** The stages that are a real wait: plates sending, or the job queued or running. */
export type WaitStage = Extract<DevStage, { kind: "sending" | "waiting" }>;

/** The thinking line: its lines, the extra strings its box is sized to, and the fixed status screen readers hear. */
export interface WaitLine {
  lines: readonly string[];
  sizeTo?: readonly string[];
  label: string;
}

export interface WaitCopy {
  stamp: string;
  title: string;
  body: string;
  thinking: WaitLine;
}

/** Running: the three things building does, in rotation (no order is claimed). */
export const DEVELOPING_LINES = ["Finding the objects", "Choosing what to hide", "Writing the case"] as const;

/** Queued: the one line under the glass (the title says the case is next). */
export const WAITING_LINE = "Waiting to start";

export const sendingLine = (n: number, total: number) => `Sending photo ${n} of ${total}`;

export function waitingCopy(stage: WaitStage): WaitCopy {
  if (stage.kind === "sending") {
    const n = Math.min(stage.sent + 1, stage.total);
    const line = sendingLine(n, stage.total);
    return {
      stamp: "SENDING PHOTOS",
      title: "Sending your photos",
      body: `Photo ${n} of ${stage.total}. Keep the app open until they're all sent.`,
      // Sized to every count, so the box never resizes as the count climbs.
      thinking: { lines: [line], sizeTo: Array.from({ length: stage.total }, (_, i) => sendingLine(i + 1, stage.total)), label: line },
    };
  }
  return jobCopy(stage.job);
}

function jobCopy(job: GenerationJob): WaitCopy {
  if (job.status === "running") {
    const title = "Building your case";
    return {
      stamp: "BUILDING",
      title,
      body: "Finding the objects, choosing what to hide, and writing the case. This usually takes a minute or two.",
      thinking: { lines: DEVELOPING_LINES, label: title },
    };
  }
  if (job.attempt_count > 0) {
    const title = "Trying again";
    return {
      stamp: "SECOND TRY",
      title,
      body: "The first try didn't finish, so it's starting again. You don't need to do anything.",
      thinking: { lines: [title], label: title },
    };
  }
  const title = "Your case is next";
  return {
    stamp: "IN THE QUEUE",
    title,
    body: "You can leave this screen. It keeps building, and you'll find it on the home screen.",
    thinking: { lines: [WAITING_LINE], label: title },
  };
}
