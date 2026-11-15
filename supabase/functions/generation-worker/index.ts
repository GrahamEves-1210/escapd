// Processes queued generation jobs. Invoke every minute via pg_cron + pg_net
// (header x-cron-secret), and optionally right after a job is requested.
// Each invocation works for at most ~110s, one job at a time.
//
//   claim (lease) -> sign photo URLs -> generatePuzzle() -> complete | fail
//
// The database owns state transitions, retries/backoff, validation and
// publishing; this function only moves data between storage, the AI
// provider and the database.
import { admin, handler, json, requireCronSecret } from "../_shared/supabase.ts";
import { DEADLINE_MS, type Genre, GenerationError, generatePuzzle, NotImplementedError } from "../_shared/ai.ts";
import { featuredKinds } from "../_shared/v2/planner.ts";

const LEASE_SECONDS = 300;
const TIME_BUDGET_MS = 110_000;
const SIGNED_URL_SECONDS = 600;

type Job = {
  id: string;
  room_id: string;
  attempt_count: number;
  prompt_version: string;
  output_schema_version: number;
  genre?: Genre | null;   // copied from rooms.genre when the job is requested; missing before that migration
  lease_token: string;
};

Deno.serve(handler(async (req) => {
  requireCronSecret(req);
  const workerId = `edge-${crypto.randomUUID().slice(0, 8)}`;
  const started = Date.now();
  const results: Array<Record<string, unknown>> = [];

  // Claim another job only if a full generation (which stops itself at
  // DEADLINE_MS) still fits in this invocation's budget.
  while (Date.now() - started + DEADLINE_MS < TIME_BUDGET_MS) {
    const { data: job, error } = await admin().rpc("worker_claim_generation_job", {
      p_worker_id: workerId,
      p_lease_seconds: LEASE_SECONDS,
    });
    if (error) throw error;
    if (!job || !(job as Job).id) break;
    results.push(await processJob(job as Job));
  }

  return json({ worker: workerId, processed: results.length, results });
}));

async function processJob(job: Job): Promise<Record<string, unknown>> {
  const fail = async (code: string, message: string, retryable: boolean, usage?: unknown) => {
    const { error } = await admin().rpc("worker_fail_generation_job", {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_error_code: code,
      p_error_message: message.slice(0, 2000),
      p_retryable: retryable,
      p_usage: usage ?? null,
    });
    if (error) console.error("worker_fail_generation_job failed", error);
    return { job_id: job.id, outcome: "failed", code, retryable };
  };

  try {
    const { data: photos, error } = await admin().rpc("worker_get_job_photos", {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
    });
    if (error) throw error;

    const signed = [];
    for (const p of photos as Array<{ photo_id: string; bucket_id: string; storage_path: string; photo_position: number; mime_type: string }>) {
      const { data, error: signError } = await admin().storage
        .from(p.bucket_id).createSignedUrl(p.storage_path, SIGNED_URL_SECONDS);
      if (signError || !data) throw signError ?? new Error("could not sign photo URL");
      signed.push({ photoId: p.photo_id, position: p.photo_position, mimeType: p.mime_type, signedUrl: data.signedUrl });
    }

    const output = await generatePuzzle({
      jobId: job.id,
      roomId: job.room_id,
      attempt: job.attempt_count,
      promptVersion: job.prompt_version,
      outputSchemaVersion: job.output_schema_version,
      genre: job.genre ?? "noir",
      photos: signed,
      ...(job.output_schema_version === 2 ? { recent: await recentFeatures(job.room_id) } : {}),
    });

    const { data: result, error: completeError } = await admin().rpc("worker_complete_generation_job", {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_public_definition: output.publicDefinition,
      p_solution: output.solution,
      p_usage: output.usage,
    });
    if (completeError) throw completeError;
    return { job_id: job.id, outcome: (result as { ok: boolean }).ok ? "succeeded" : "invalid_output", result };
  } catch (err) {
    if (err instanceof NotImplementedError) return await fail("not_implemented", err.message, false);
    if (err instanceof GenerationError) return await fail(err.code, err.message, err.retryable, err.usage);
    console.error("generation failed", err);
    return await fail("worker_error", String(err), true);
  }
}

/**
 * What the owner's last three v2 cases featured (the UV light, a cipher wheel, a music box...), the most
 * recent first, so the planner gives this one something else. One read of the room's owner and one of
 * their latest published definitions (only the objects, items and cards). Never fatal: on any error the
 * room is planned as if it were their first.
 */
async function recentFeatures(roomId: string): Promise<string[][]> {
  try {
    const { data: room, error } = await admin().from("rooms").select("owner_id").eq("id", roomId).maybeSingle();
    if (error || !room?.owner_id) return [];
    const { data: versions, error: vError } = await admin().from("puzzle_versions")
      .select("objects:public_definition->objects, items:public_definition->items, cards:public_definition->cards")
      .eq("owner_id", room.owner_id).eq("schema_version", 2).neq("room_id", roomId)
      .order("created_at", { ascending: false }).limit(3);
    if (vError || !Array.isArray(versions)) return [];
    // deno-lint-ignore no-explicit-any
    return versions.map((v: any) => featuredKinds({ objects: v.objects ?? [], items: v.items ?? [], cards: v.cards ?? [] }));
  } catch (err) {
    console.error("recent features: skipped", err);
    return [];
  }
}
