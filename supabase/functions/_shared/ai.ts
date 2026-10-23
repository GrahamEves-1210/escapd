// AI puzzle generation contract. The model call is intentionally NOT
// implemented yet; generation-worker treats NotImplementedError as a
// non-retryable failure so jobs don't loop.
//
// Implementations must return a public definition + secret solution matching
// schema v1 (documented in supabase/migrations/20261023000200_rooms_and_puzzles.sql
// and docs/BACKEND.md). The database validates the output before publishing,
// so a bad generation can never become playable.

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
  photos: GenerationPhoto[];
}

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

/** Errors with retryable=false fail the job immediately. */
export class GenerationError extends Error {
  constructor(message: string, public code: string, public retryable: boolean, public usage?: GenerationUsage) {
    super(message);
  }
}

export function generatePuzzle(_input: GenerationInput): Promise<GenerationOutput> {
  return Promise.reject(new NotImplementedError("AI puzzle generation is not implemented yet"));
}
