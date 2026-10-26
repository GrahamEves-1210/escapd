// What to tell the player when a case fails to build. Branch on the job's
// error_code; error_message is for operators and is never shown as-is, except
// for what it says about single photos: the positions the privacy check names
// (with each one's reason, from servers that send them) and the position a
// photo_unavailable error names. Positions are slots (send.ts uploads each
// photo with position = its slot), so they map straight back to the review
// screen's tiles.
import type { GenerationJob } from "@/lib/escapd-api";

export type FailureAction = "retake" | "retry" | "later";

/**
 * Why one photo needs a retake. "general" when the server named the photo but
 * not the reason (an older server).
 */
export type RetakeReason = "person" | "private_text" | "person_private_text" | "unreadable" | "general";

export interface FlaggedPhoto {
  /** The photo's slot (its room_photos.position). */
  slot: number;
  reason: RetakeReason;
}

/** A failure about the whole set rather than one photo, said as a note on the review screen. */
export type SetIssue = "too_few_objects" | "didnt_come_together" | "couldnt_use" | "photo_missing";

export interface FailureCopy {
  title: string;
  body: string;
  action: FailureAction;
  /** Zero-based slots to retake, when the server named them. */
  plates: number[];
  /** The same slots, each with its reason. */
  flagged: FlaggedPhoto[];
  /** Set when the failure is about the whole set. */
  issue: SetIssue | null;
}

const RETRYABLE = new Set([
  "provider_timeout", "provider_rate_limited", "provider_unavailable", "provider_network",
  "model_output_invalid", "photo_download_failed", "generation_timeout", "internal_error",
  // Set by the worker or the database rather than the pipeline.
  "worker_error", "lease_expired", "invalid_output",
]);

const REASONS: Record<string, RetakeReason> = {
  person: "person",
  private_text: "private_text",
  "person+private_text": "person_private_text",
  "private_text+person": "person_private_text",
};

/** Reads "photo position(s): 0, 2." from the privacy failure. */
export function flaggedPlates(message: string | null | undefined): number[] {
  const match = /photo position\(s\):\s*([\d,\s]+)/i.exec(message ?? "");
  if (!match) return [];
  return [...new Set(match[1].split(",").map((s) => Number.parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 0))]
    .sort((a, b) => a - b);
}

/** Reads the newer servers' tail, "Reasons: 0=person; 2=private_text; 3=person+private_text.", as slot -> reason. */
export function privacyReasons(message: string | null | undefined): Map<number, RetakeReason> {
  const reasons = new Map<number, RetakeReason>();
  const match = /Reasons:\s*([^]*?)\.?\s*$/i.exec(message ?? "");
  if (!match) return reasons;
  for (const entry of match[1].split(";")) {
    const pair = /^\s*(\d+)\s*=\s*([a-z_+]+)\s*$/i.exec(entry);
    const reason = pair ? REASONS[pair[2].toLowerCase()] : undefined;
    if (pair && reason) reasons.set(Number.parseInt(pair[1], 10), reason);
  }
  return reasons;
}

/** The privacy failure's photos, each with its reason ("general" when the server didn't say). */
export function flaggedPhotos(message: string | null | undefined): FlaggedPhoto[] {
  const reasons = privacyReasons(message);
  return flaggedPlates(message).map((slot) => ({ slot, reason: reasons.get(slot) ?? "general" }));
}

/** Reads the one photo a photo_unavailable error names: "photo position 3 could not be downloaded …". */
export function unreadablePlate(message: string | null | undefined): number | null {
  const match = /photo position (\d+)\b/i.exec(message ?? "");
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * The review screen's ?flag= value: "0:person,2:private_text". Plain "0,2"
 * (as older builds wrote it) still reads, as the general reason.
 */
export function encodeFlags(flagged: readonly FlaggedPhoto[]): string {
  return flagged.map(({ slot, reason }) => `${slot}:${reason}`).join(",");
}

const KNOWN: ReadonlySet<string> = new Set<RetakeReason>(["person", "private_text", "person_private_text", "unreadable", "general"]);

export function decodeFlags(param: string | null | undefined): FlaggedPhoto[] {
  const flagged = new Map<number, RetakeReason>();
  for (const item of (param ?? "").split(",")) {
    const match = /^\s*(\d+)\s*(?::\s*([a-z_]+))?\s*$/i.exec(item);
    if (!match) continue;
    const reason = match[2] && KNOWN.has(match[2]) ? (match[2] as RetakeReason) : "general";
    flagged.set(Number.parseInt(match[1], 10), reason);
  }
  return [...flagged].map(([slot, reason]) => ({ slot, reason })).sort((a, b) => a.slot - b.slot);
}

const ISSUES: ReadonlySet<string> = new Set<SetIssue>(["too_few_objects", "didnt_come_together", "couldnt_use", "photo_missing"]);

/** The review screen's ?issue= value, or null for anything else. */
export function decodeIssue(param: string | null | undefined): SetIssue | null {
  return param && ISSUES.has(param) ? (param as SetIssue) : null;
}

export function describeFailure(job: Pick<GenerationJob, "error_code" | "error_message">): FailureCopy {
  const code = job.error_code ?? "";
  const none = { plates: [], flagged: [], issue: null };
  switch (code) {
    case "person_or_sensitive": {
      const flagged = flaggedPhotos(job.error_message);
      return {
        title: "A few photos need a retake",
        body: "They show a person, or something private like mail, documents, or a screen. Retake the marked photos without them.",
        action: "retake",
        plates: flagged.map((f) => f.slot),
        flagged,
        issue: null,
      };
    }
    case "too_few_objects":
      return {
        title: "Not enough to build a case from",
        body: "The photos need at least four clear objects, like a desk, a shelf, a cabinet, or a lamp. Add a close view or two and build again.",
        action: "retake",
        ...none,
        issue: "too_few_objects",
      };
    case "photo_unavailable":
    case "photos_too_large": {
      const slot = unreadablePlate(job.error_message);
      return {
        title: "A photo didn't come through",
        body: "One of the photos couldn't be read. Retake it, or choose a different photo, and build again.",
        action: "retake",
        plates: slot === null ? [] : [slot],
        flagged: slot === null ? [] : [{ slot, reason: "unreadable" }],
        issue: slot === null ? "photo_missing" : null,
      };
    }
    case "invalid_after_repair":
    case "spend_cap":
      return {
        title: "The case didn't come together",
        body: "These photos didn't give the puzzle enough to work with. Try four clear photos from different corners.",
        action: "retake",
        ...none,
        issue: "didnt_come_together",
      };
    case "provider_blocked":
      return {
        title: "These photos couldn't be used",
        body: "Try again with photos that leave out people, private documents, and screens.",
        action: "retake",
        ...none,
        issue: "couldnt_use",
      };
    default:
      if (RETRYABLE.has(code)) {
        return {
          title: "That took longer than it should",
          body: "Your case didn't finish building this time. Your photos are safe. Try again in a minute.",
          action: "retry",
          ...none,
        };
      }
      // provider_rejected, provider_not_configured, invalid_input, or a code this
      // build doesn't know: the problem is on our side.
      return {
        title: "Your case couldn't be built right now",
        body: "Something on our side stopped it. Your photos are safe. Try again later.",
        action: "later",
        ...none,
      };
  }
}
