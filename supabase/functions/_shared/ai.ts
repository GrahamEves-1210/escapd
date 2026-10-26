// AI room generation. generation-worker calls generatePuzzle() once per
// claimed job (~110 s worker budget, 300 s lease); every stage runs inside
// that one call, with a hard internal deadline so the call stays well inside
// the lease:
//
//   1  download the signed photos (URLs and bytes are never logged)
//   2  perceive each photo in parallel            (perception.ts)
//   3  person or legible private text -> person_or_sensitive (non-retryable)
//   4  verify presence in one call                (perception.ts)
//   5  fewer than 4 distinct verified objects -> too_few_objects (non-retryable)
//   6  reconcile duplicates: one hotspot per real object, on its clearest photo
//   7  pick a template whose roles fit; mint the code and item ids (templates.ts)
//   8  one prose call; code inserts the code literal if the model left it out (prose.ts)
//   9  assemble schema v1 public definition + secret solution (prose.ts, geometry.ts)
//  10  preflight (puzzle-check.ts + worker_preview_puzzle RPC); at most one
//      text-only repair call, then preflight again -> invalid_after_repair
//
// worker_complete_generation_job re-validates and is the only publisher.
// Every GenerationError thrown from here carries the usage spent so far.
export * from "./contract.ts";

import { ErrorCode, type GenerationInput, type GenerationOutput, type GenerationPhoto, GenerationError } from "./contract.ts";
import { CostLedger, SPEND_CAP_USD } from "./cost.ts";
import {
  collectCandidates,
  flaggedPositions,
  flaggedReasons,
  perceivePhotos,
  type PhotoPayload,
  reconcile,
  type StageContext,
  verifyCandidates,
} from "./perception.ts";
import { GeminiProvider, type ModelProvider } from "./provider.ts";
import { assembleDefinition, pickStoryFamily, repairProse, writeProse } from "./prose.ts";
import { checkPuzzle } from "./puzzle-check.ts";
import type { ProseText } from "./schemas.ts";
import { cryptoInt, type RandomInt, selectAndCompile } from "./templates.ts";

export const DEFAULT_MODELS = {
  perception: "gemini-2.5-flash",
  perceptionFallback: "gemini-3-flash-preview",
  prose: "gemini-3.1-pro-preview",
  proseFallback: "",
} as const;

/** Hard stop for one call; leaves the worker's 110 s loop and the 300 s lease comfortable margin. */
export const DEADLINE_MS = 100_000;
export const MIN_VERIFIED_OBJECTS = 4;
const PHOTO_TIMEOUT_MS = 15_000;
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;          // room-photos bucket limit
const MAX_INLINE_BASE64 = 18_000_000;              // Gemini caps a request (all inline images + text) at 20 MB
const SAFETY_MARGIN_MS = 2_000;
const MIN_CALL_MS = 5_000;
const MIN_FALLBACK_MS = 20_000;
const SUPPORTED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export interface PipelineConfig {
  apiKey: string;
  perceptionModel: string;
  perceptionFallbackModel: string;
  proseModel: string;
  proseFallbackModel: string;
  spendCapUsd: number;
  deadlineMs: number;
}

/** Reads AI_PROVIDER_API_KEY and the optional model overrides. */
export function configFromEnv(): PipelineConfig {
  const get = (name: string) => (Deno.env.get(name) ?? "").trim();
  return {
    apiKey: get("AI_PROVIDER_API_KEY"),
    perceptionModel: get("AI_PERCEPTION_MODEL") || DEFAULT_MODELS.perception,
    perceptionFallbackModel: Deno.env.has("AI_PERCEPTION_FALLBACK_MODEL")
      ? get("AI_PERCEPTION_FALLBACK_MODEL")
      : DEFAULT_MODELS.perceptionFallback,
    proseModel: get("AI_PROSE_MODEL") || DEFAULT_MODELS.prose,
    proseFallbackModel: get("AI_PROSE_FALLBACK_MODEL") || DEFAULT_MODELS.proseFallback,
    spendCapUsd: SPEND_CAP_USD,
    deadlineMs: DEADLINE_MS,
  };
}

export interface GenerationDeps {
  config: PipelineConfig;
  provider: ModelProvider;
  fetchPhoto: (photo: GenerationPhoto, timeoutMs: number) => Promise<Uint8Array>;
  /** worker_preview_puzzle errors, or null when the RPC is unavailable (TS preflight only). */
  preview: (publicDefinition: Record<string, unknown>, solution: Record<string, unknown>) => Promise<string[] | null>;
  now: () => number;
  random: () => number;
  randomInt: RandomInt;
  log: (event: string, fields: Record<string, unknown>) => void;
}

export async function generatePuzzle(input: GenerationInput, overrides: Partial<GenerationDeps> = {}): Promise<GenerationOutput> {
  const config = overrides.config ?? configFromEnv();
  const deps: GenerationDeps = {
    config,
    provider: overrides.provider ?? new GeminiProvider({ apiKey: config.apiKey }),
    fetchPhoto: overrides.fetchPhoto ?? fetchPhotoBytes,
    preview: overrides.preview ?? previewWithDatabase,
    now: overrides.now ?? Date.now,
    random: overrides.random ?? (() => cryptoInt(1_000_000) / 1_000_000),
    randomInt: overrides.randomInt ?? cryptoInt,
    log: overrides.log ?? ((event, fields) => console.log(JSON.stringify({ event, ...fields }))),
  };
  const ledger = new CostLedger(config.spendCapUsd, deps.now);
  const started = deps.now();
  const deadline = started + config.deadlineMs;
  const remaining = () => deadline - deps.now();
  const fail = (message: string, code: string, retryable: boolean) =>
    new GenerationError(message, code, retryable, ledger.usage());

  let stageStarted = started;
  const stage = (name: string, fields: Record<string, unknown> = {}) => {
    const now = deps.now();
    deps.log("generation_stage", {
      job_id: input.jobId, attempt: input.attempt, stage: name, ms: now - stageStarted,
      cost_usd: Math.round(ledger.totalUsd * 1e6) / 1e6, ...fields,
    });
    stageStarted = now;
  };

  const ctx: StageContext = {
    provider: deps.provider,
    ledger,
    models: {
      perception: [config.perceptionModel, config.perceptionFallbackModel],
      prose: [config.proseModel, config.proseFallbackModel],
    },
    timeout(stageMs: number) {
      const left = remaining() - SAFETY_MARGIN_MS;
      if (left < MIN_CALL_MS) throw fail("generation ran out of time before the next model call", ErrorCode.generationTimeout, true);
      return Math.min(stageMs, left);
    },
    canRetry: () => remaining() > MIN_FALLBACK_MS,
  };

  try {
    if (input.outputSchemaVersion !== 1) {
      throw fail(`unsupported output schema version ${input.outputSchemaVersion}`, ErrorCode.invalidInput, false);
    }
    if (!input.photos.length) throw fail("the job has no photos", ErrorCode.invalidInput, false);
    const ordered = [...input.photos].sort((a, b) => a.position - b.position);
    const photoIds = ordered.map((p) => p.photoId);

    // 1. Download
    const photos = await downloadPhotos(ordered, deps, ctx);
    stage("download", { photos: photos.length });

    // 2. Perception
    const perceptions = await perceivePhotos(ctx, photos);
    stage("perception", { objects: perceptions.reduce((n, p) => n + p.objects.length, 0) });

    // 3. Privacy gate
    // The message keeps its "photo position(s): 0, 2." prefix, which current
    // clients parse, and ends with each position's reason, which newer
    // clients show on the photo: "Reasons: 0=person; 2=private_text."
    const flagged = flaggedPositions(perceptions, photos);
    if (flagged.length) {
      throw fail(
        `Person or private text detected in photo position(s): ${flagged.join(", ")}. ` +
          "Retake those photos without people, mail, documents or lit screens. " +
          `Reasons: ${flaggedReasons(perceptions, photos)}.`,
        ErrorCode.personOrSensitive, false);
    }

    // 4. Verification (skipped when there is nothing to verify)
    const candidates = collectCandidates(perceptions);
    const tooFew = (n: number) =>
      fail(
        `Only ${n} usable object(s) found; at least ${MIN_VERIFIED_OBJECTS} are needed. ` +
          "Add one or two closer views of a desk, shelf or table.",
        ErrorCode.tooFewObjects, false);
    if (candidates.length < MIN_VERIFIED_OBJECTS) throw tooFew(candidates.length);
    const verified = await verifyCandidates(ctx, photos, candidates);
    stage("verification", { candidates: candidates.length, verified: verified.length });

    // 5-6. Reconcile, then count distinct real objects
    const objects = reconcile(verified);
    stage("reconcile", { objects: objects.length });
    if (objects.length < MIN_VERIFIED_OBJECTS) throw tooFew(objects.length);

    // 7. Template + minted answers/ids
    const room = selectAndCompile(objects, { random: deps.random, randomInt: deps.randomInt });
    if (!room) throw tooFew(objects.length);
    stage("template", { template: room.template, hotspots: room.hotspots.length, puzzles: room.puzzles.length });

    // 8-9. Prose, enforcement, assembly
    const family = pickStoryFamily(deps.random);
    let prose: ProseText = await writeProse(ctx, room, photos, family);
    let assembled = assembleDefinition(room, prose, photoIds);
    stage("prose", { fixes: assembled.text.fixes });

    // 10. Preflight, one repair at most
    let errors = await preflight(assembled.publicDefinition, assembled.solution, photoIds, deps);
    stage("preflight", { errors: errors.length });
    if (errors.length) {
      prose = await repairProse(ctx, room, prose, errors, family);
      assembled = assembleDefinition(room, prose, photoIds);
      errors = await preflight(assembled.publicDefinition, assembled.solution, photoIds, deps);
      stage("repair", { errors: errors.length });
      if (errors.length) {
        throw fail(`room still invalid after one repair: ${errors.slice(0, 8).join("; ")}`, ErrorCode.invalidAfterRepair, false);
      }
    }

    return { publicDefinition: assembled.publicDefinition, solution: assembled.solution, usage: ledger.usage() };
  } catch (err) {
    if (err instanceof GenerationError) {
      err.usage = ledger.usage();   // include calls that settled after the error was created
      stage("failed", { code: err.code, retryable: err.retryable });
      throw err;
    }
    console.error("generatePuzzle: unexpected error", err instanceof Error ? err.stack ?? err.message : String(err));
    throw new GenerationError(
      `unexpected generation error: ${err instanceof Error ? err.message.slice(0, 300) : "unknown"}`,
      ErrorCode.internalError, true, ledger.usage());
  }
}

async function preflight(
  publicDefinition: Record<string, unknown>,
  solution: Record<string, unknown>,
  photoIds: string[],
  deps: GenerationDeps,
): Promise<string[]> {
  const local = checkPuzzle(publicDefinition, solution, { photoIds, generation: true });
  const remote = await deps.preview(publicDefinition, solution);
  return [...new Set([...local, ...(remote ?? [])])];
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------
async function downloadPhotos(ordered: GenerationPhoto[], deps: GenerationDeps, ctx: StageContext): Promise<PhotoPayload[]> {
  const timeoutMs = ctx.timeout(PHOTO_TIMEOUT_MS);
  const settled = await Promise.allSettled(ordered.map(async (photo) => {
    const mimeType = photo.mimeType.toLowerCase();
    if (!SUPPORTED_MIME.has(mimeType)) {
      throw new GenerationError(`photo position ${photo.position} has unsupported type ${mimeType}`, ErrorCode.photoUnavailable, false);
    }
    const bytes = await deps.fetchPhoto(photo, timeoutMs);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) {
      throw new GenerationError(`photo position ${photo.position} is empty or larger than 15 MB`, ErrorCode.photoUnavailable, false);
    }
    return { photo, mimeType, bytes };
  }));
  const failure = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
  if (failure) throw failure.reason;
  const downloads = settled.map((s) => (s as PromiseFulfilledResult<{ photo: GenerationPhoto; mimeType: string; bytes: Uint8Array }>).value);
  // Base64 is 4/3 of the raw size; refuse before encoding so oversized sets never double in memory.
  if (Math.ceil(downloads.reduce((n, d) => n + d.bytes.byteLength, 0) / 3) * 4 > MAX_INLINE_BASE64) {
    throw new GenerationError(
      "The photos are too large to send together; re-encode them (long edge about 1600 px) and try again.",
      ErrorCode.photosTooLarge, false);
  }
  return downloads.map(({ photo, mimeType, bytes }, index) => ({
    index, position: photo.position, photoId: photo.photoId, mimeType, base64: encodeBase64(bytes), byteLength: bytes.byteLength,
  }));
}

/** Default photo fetch. Errors name the photo position, never the signed URL. */
export async function fetchPhotoBytes(photo: GenerationPhoto, timeoutMs: number): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(photo.signedUrl, { signal: controller.signal });
    if (!res.ok) {
      await res.body?.cancel();
      const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
      throw new GenerationError(
        `photo position ${photo.position} could not be downloaded (HTTP ${res.status})`,
        retryable ? ErrorCode.photoDownloadFailed : ErrorCode.photoUnavailable, retryable);
    }
    if (Number(res.headers.get("content-length") ?? "0") > MAX_PHOTO_BYTES) {
      await res.body?.cancel();
      throw new GenerationError(`photo position ${photo.position} is larger than 15 MB`, ErrorCode.photoUnavailable, false);
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    if (err instanceof GenerationError) throw err;
    const what = controller.signal.aborted ? "timed out" : "failed";
    throw new GenerationError(`photo position ${photo.position} download ${what}`, ErrorCode.photoDownloadFailed, true);
  } finally {
    clearTimeout(timer);
  }
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Preview RPC (service-only; created by a separate migration)
// ---------------------------------------------------------------------------
/** PostgREST reports an unknown RPC as PGRST202 "Could not find the function ...". */
export function isMissingFunction(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === "PGRST202" || /could not find the function/i.test(error.message ?? ""));
}

async function previewWithDatabase(
  publicDefinition: Record<string, unknown>,
  solution: Record<string, unknown>,
): Promise<string[] | null> {
  // Imported lazily so the pipeline modules (and their tests) do not load supabase-js.
  const { admin } = await import("./supabase.ts");
  const { data, error } = await admin().rpc("worker_preview_puzzle", {
    p_public_definition: publicDefinition,
    p_solution: solution,
  });
  if (error) {
    if (!isMissingFunction(error)) console.warn("worker_preview_puzzle failed; using the TypeScript preflight only", error.code ?? "");
    return null;
  }
  return Array.isArray(data) ? data.map(String) : [];
}
