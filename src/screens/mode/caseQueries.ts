// Batched reads for the mode screens and home: one query for the latest
// session of every listed room, one for every listed room's cover photo,
// instead of a call per room. They read only the player's own rows (RLS),
// through the same typed client as src/lib/escapd-api.ts, and throw its
// ApiError. (A natural home for these is escapd-api.ts; they live here so
// this screen owns them.)
import { ApiError, signedPhotoUrl, type GameSession, type RoomPhoto } from "@/lib/escapd-api";
import { supabase } from "@/lib/supabase";

export type SessionStatus = GameSession["status"];
export type CoverPhoto = Pick<RoomPhoto, "id" | "room_id" | "storage_path" | "position">;

/** Each room's latest session status (rooms without one are absent). One query. */
export async function latestSessionStatuses(roomIds: readonly string[]): Promise<Map<string, SessionStatus>> {
  const latest = new Map<string, SessionStatus>();
  if (roomIds.length === 0) return latest;
  const { data, error } = await supabase
    .from("game_sessions")
    .select("room_id, status, created_at")
    .in("room_id", [...roomIds])
    .order("created_at", { ascending: false });
  if (error) throw new ApiError(error.message, error.code || undefined, error);
  // Newest first: the first row seen for a room is its latest.
  for (const row of data ?? []) if (!latest.has(row.room_id)) latest.set(row.room_id, row.status);
  return latest;
}

/** Each room's first photo (lowest position; rooms without photos are absent). One query. */
export async function coverPhotos(roomIds: readonly string[]): Promise<Map<string, CoverPhoto>> {
  const covers = new Map<string, CoverPhoto>();
  if (roomIds.length === 0) return covers;
  const { data, error } = await supabase
    .from("room_photos")
    .select("id, room_id, storage_path, position")
    .in("room_id", [...roomIds])
    .order("position", { ascending: true });
  if (error) throw new ApiError(error.message, error.code || undefined, error);
  for (const row of data ?? []) if (!covers.has(row.room_id)) covers.set(row.room_id, row);
  return covers;
}

/**
 * Signed URLs for photos, by photo id, signed in parallel. A photo that
 * can't be signed is left out (its case file shows no picture); never rejects.
 */
export async function signCovers(photos: readonly CoverPhoto[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  await Promise.all(
    photos.map(async (photo) => {
      try {
        signed.set(photo.id, await signedPhotoUrl(photo.storage_path));
      } catch {
        // Left out.
      }
    }),
  );
  return signed;
}
