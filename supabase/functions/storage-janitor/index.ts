// Scheduled maintenance (invoke every ~15 minutes via pg_cron + pg_net, with
// header x-cron-secret: <CRON_SECRET>).
//   * Drains private.storage_deletion_queue (files of deleted photos, rooms,
//     and accounts) through the Storage API.
//   * With body { "purge": true } (run daily), first applies retention rules:
//     stale draft rooms and inactive guest accounts.
import { admin, handler, json, removePaths, requireCronSecret } from "../_shared/supabase.ts";

type QueueRow = { id: number; bucket_id: string; object_path: string };

Deno.serve(handler(async (req) => {
  requireCronSecret(req);
  const body = await req.json().catch(() => ({}));

  let purge: unknown = null;
  if (body?.purge === true) {
    const { data, error } = await admin().rpc("worker_purge_expired_data");
    if (error) throw error;
    purge = data;
  }

  let deleted = 0;
  let failed = 0;
  for (let round = 0; round < 20; round++) {
    const { data, error } = await admin().rpc("worker_next_storage_deletions", { p_limit: 200 });
    if (error) throw error;
    const rows = (data ?? []) as QueueRow[];
    if (rows.length === 0) break;

    const byBucket = new Map<string, QueueRow[]>();
    for (const row of rows) byBucket.set(row.bucket_id, [...(byBucket.get(row.bucket_id) ?? []), row]);

    for (const [bucket, group] of byBucket) {
      const ids = group.map((r) => r.id);
      try {
        // Removing a path that no longer exists is not an error.
        await removePaths(bucket, group.map((r) => r.object_path));
        await admin().rpc("worker_ack_storage_deletions", { p_ids: ids });
        deleted += ids.length;
      } catch (err) {
        await admin().rpc("worker_ack_storage_deletions", { p_ids: ids, p_error: String(err) });
        failed += ids.length;
      }
    }
  }

  return json({ deleted, failed, purge });
}));
