// Generation contract shared by generation-worker and the pipeline modules.
// ai.ts re-exports everything here; import from ai.ts outside _shared.
//
// Implementations must return a public definition + secret solution matching
// schema v1 (documented in supabase/migrations/20261023000200_rooms_and_puzzles.sql
// and docs/BACKEND.md). The database validates the output before publishing,
// so a bad generation can never become playable.

// Closed vocabularies of the public definition (optional schema-v1 fields).
// The SQL validator holds the same lists.
export const GENRES = ["noir", "crime_scene", "paranormal"] as const;
export type Genre = typeof GENRES[number];
export const isGenre = (value: unknown): value is Genre => (GENRES as readonly unknown[]).includes(value);

/** Optional hotspot overlay, set by the template role, never by the model. */
export const HOTSPOT_EFFECTS = ["flicker", "apparition", "moved", "cold", "whisper"] as const;
export type HotspotEffect = typeof HOTSPOT_EFFECTS[number];

/** The three parts of an accusation: who, why, how. */
export const ACCUSE_DIMENSIONS = ["suspect", "motive", "method"] as const;
export type Dimension = typeof ACCUSE_DIMENSIONS[number];

export interface GenerationPhoto {
  photoId: string;      // must be echoed back as photos[].photo_id
  position: number;
  mimeType: string;
  signedUrl: string;    // short-lived; do not log or persist
}

export interface GenerationInput {
  jobId: string;
  roomId: string;
  attempt: number;
  promptVersion: string;
  outputSchemaVersion: number;
  /** Snapshot of rooms.genre on the job. Absent means noir (callers that predate genres). */
  genre?: Genre;
  photos: GenerationPhoto[];
}

// Mirrors private.generation_usage. Integers only for token/image/duration
// columns; cost is numeric(12, 6).
export interface GenerationUsage {
  provider?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  image_count?: number;
  cost_usd?: number;
  duration_ms?: number;
}

export interface GenerationOutput {
  publicDefinition: Record<string, unknown>;
  solution: Record<string, unknown>;
  usage: GenerationUsage;
}

export class NotImplementedError extends Error {}

/**
 * Errors with retryable=false fail the job immediately. Always pass the usage
 * spent so far so private.generation_usage records the cost of failed attempts.
 */
export class GenerationError extends Error {
  constructor(message: string, public code: string, public retryable: boolean, public usage?: GenerationUsage) {
    super(message);
    this.name = "GenerationError";
  }
}

// Stable error codes written to generation_jobs.error_code. The app maps them
// to retake / add-angle / retry-later screens, so never rename one.
export const ErrorCode = {
  // Content: the room fails once; the player edits photos and retries.
  personOrSensitive: "person_or_sensitive",
  tooFewObjects: "too_few_objects",
  spendCap: "spend_cap",
  invalidAfterRepair: "invalid_after_repair",
  photoUnavailable: "photo_unavailable",
  photosTooLarge: "photos_too_large",
  invalidInput: "invalid_input",
  providerBlocked: "provider_blocked",
  providerRejected: "provider_rejected",
  providerNotConfigured: "provider_not_configured",
  // Transport: retried by the job backoff (30 s, 2 m, 8 m) up to max_attempts.
  providerTimeout: "provider_timeout",
  providerRateLimited: "provider_rate_limited",
  providerUnavailable: "provider_unavailable",
  providerNetwork: "provider_network",
  modelOutputInvalid: "model_output_invalid",
  photoDownloadFailed: "photo_download_failed",
  generationTimeout: "generation_timeout",
  internalError: "internal_error",
} as const;

export type ErrorCodeValue = typeof ErrorCode[keyof typeof ErrorCode];
