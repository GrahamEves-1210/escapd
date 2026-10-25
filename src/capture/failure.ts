// What to tell the player when a case fails to develop. Branch on the job's
// error_code; error_message is for operators and is never shown as-is, except
// for the photo positions the privacy check names.
import type { GenerationJob } from "@/lib/escapd-api";

export type FailureAction = "retake" | "retry" | "later";

export interface FailureCopy {
  title: string;
  body: string;
  action: FailureAction;
  /** Zero-based plate positions to retake, when the server named them. */
  plates: number[];
}

const RETRYABLE = new Set([
  "provider_timeout", "provider_rate_limited", "provider_unavailable", "provider_network",
  "model_output_invalid", "photo_download_failed", "generation_timeout", "internal_error",
  // Set by the worker or the database rather than the pipeline.
  "worker_error", "lease_expired", "invalid_output",
]);

/** Reads "photo position(s): 0, 2." from the privacy failure. */
export function flaggedPlates(message: string | null | undefined): number[] {
  const match = /photo position\(s\):\s*([\d,\s]+)/i.exec(message ?? "");
  if (!match) return [];
  return [...new Set(match[1].split(",").map((s) => Number.parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 0))]
    .sort((a, b) => a - b);
}

export function describeFailure(job: Pick<GenerationJob, "error_code" | "error_message">): FailureCopy {
  const code = job.error_code ?? "";
  switch (code) {
    case "person_or_sensitive":
      return {
        title: "Some plates show something private",
        body: "A person, or mail, documents, or a lit screen someone could read. Retake the marked plates without them.",
        action: "retake",
        plates: flaggedPlates(job.error_message),
      };
    case "too_few_objects":
      return {
        title: "Not enough to build a case from",
        body: "The plates need at least four clear objects: a desk, a shelf, a cabinet, a lamp. Add a close view or two and develop again.",
        action: "retake",
        plates: [],
      };
    case "photo_unavailable":
    case "photos_too_large":
      return {
        title: "A plate didn't come through",
        body: "One of the photos couldn't be read. Retake it, or choose a different photo, and develop again.",
        action: "retake",
        plates: [],
      };
    case "invalid_after_repair":
    case "spend_cap":
      return {
        title: "The case didn't hold together",
        body: "These plates didn't give the puzzle enough to work with. Try four clear plates from different corners.",
        action: "retake",
        plates: [],
      };
    case "provider_blocked":
      return {
        title: "These plates couldn't be developed",
        body: "Retake them without people, private documents, or screens.",
        action: "retake",
        plates: [],
      };
    default:
      if (RETRYABLE.has(code)) {
        return {
          title: "The darkroom is busy",
          body: "Developing didn't finish this time. Your plates are safe. Try again in a minute.",
          action: "retry",
          plates: [],
        };
      }
      // provider_rejected, provider_not_configured, invalid_input, or a code this
      // build doesn't know: the problem is on our side.
      return {
        title: "The darkroom is closed",
        body: "Something on our side stopped this case from developing. Try again later.",
        action: "later",
        plates: [],
      };
  }
}
