// Thin, typed wrappers around the Escapd backend for the Expo app.
// All trust decisions (entitlement, completion, validation) happen on the
// server; these helpers only call RPCs and Storage with the user's session.
import { supabase } from "./supabase";
import type { ActionResult, GameAction, MyAccess, PuzzleDefinitionV1 } from "./puzzle-types";

const PHOTO_BUCKET = "room-photos";
const SIGNED_URL_SECONDS = 60 * 15;

function unwrap<R extends { data: unknown; error: { message: string } | null }>(result: R): NonNullable<R["data"]> {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("Empty response");
  return result.data as NonNullable<R["data"]>;
}

/** Ensures there is a session; new players start as guests (anonymous sign-in). */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  return unwrap(await supabase.auth.signInAnonymously()).session!;
}

/** Upgrade a guest in place (same user id, all progress kept). */
export async function linkEmail(email: string) {
  return unwrap(await supabase.auth.updateUser({ email }));
}

export async function getMyAccess(): Promise<MyAccess> {
  return unwrap(await supabase.rpc("get_my_access")) as unknown as MyAccess;
}

export async function createRoom(title?: string) {
  return unwrap(await supabase.rpc("create_room", { p_title: title ?? null }));
}

/**
 * Uploads one photo (strip EXIF/location metadata before calling this) and
 * registers it with the room. Path: {userId}/{roomId}/{photoId}.{ext}
 */
export async function uploadRoomPhoto(params: {
  roomId: string;
  position: number;
  body: ArrayBuffer;
  contentType: "image/jpeg" | "image/png" | "image/heic" | "image/webp";
  width?: number;
  height?: number;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error("Not signed in");
  const ext = params.contentType.split("/")[1].replace("jpeg", "jpg");
  const path = `${userId}/${params.roomId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, params.body, {
    contentType: params.contentType,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  return unwrap(await supabase.rpc("register_room_photo", {
    p_room_id: params.roomId,
    p_storage_path: path,
    p_position: params.position,
    p_width: params.width ?? null,
    p_height: params.height ?? null,
  }));
}

export async function deleteRoomPhoto(photoId: string) {
  // Deleting the row queues the file for removal (storage-janitor).
  const { error } = await supabase.from("room_photos").delete().eq("id", photoId);
  if (error) throw new Error(error.message);
}

/** Short-lived URL for displaying one of the user's own photos. */
export async function signedPhotoUrl(storagePath: string) {
  const { signedUrl } = unwrap(await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, SIGNED_URL_SECONDS));
  return signedUrl;
}

/**
 * Starts (or returns) a generation job. Generate the idempotency key once per
 * user tap and reuse it on retries so a flaky network can't double-charge.
 */
export async function requestGeneration(roomId: string, idempotencyKey: string) {
  return unwrap(await supabase.rpc("request_room_generation", {
    p_room_id: roomId,
    p_idempotency_key: idempotencyKey,
  }));
}

/** Live room status updates (queued -> generating -> ready | failed). */
export function watchRoom(roomId: string, onChange: (status: string) => void) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      (payload) => onChange((payload.new as { status: string }).status))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function getPlayableDefinition(versionId: string): Promise<PuzzleDefinitionV1> {
  const row = unwrap(await supabase.from("puzzle_versions").select("public_definition").eq("id", versionId).single());
  return row.public_definition as unknown as PuzzleDefinitionV1;
}

export async function startOrResume(roomId: string) {
  return unwrap(await supabase.rpc("start_or_resume_session", { p_room_id: roomId }));
}

export async function submitAction(sessionId: string, action: GameAction): Promise<ActionResult> {
  return unwrap(await supabase.rpc("submit_action", { p_session_id: sessionId, p_action: action })) as unknown as ActionResult;
}

export async function updateSettings(patch: Partial<{
  sound_enabled: boolean; music_enabled: boolean; haptics_enabled: boolean; hints_enabled: boolean;
  reduced_motion: boolean; locale: string; marketing_opt_in: boolean; analytics_opt_in: boolean;
}>) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { error } = await supabase.from("user_settings").update(patch).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Permanently deletes the account, all rooms, progress and photos. */
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke("delete-account", { body: { confirm: "DELETE" } });
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
}

/** Only for a guest who signs in to an EXISTING account (see merge-guest). */
export async function mergeGuestInto(signIn: () => Promise<void>) {
  const { data } = await supabase.auth.getSession();
  const guestToken = data.session?.user.is_anonymous ? data.session.access_token : null;
  await signIn();
  if (guestToken) {
    const { error } = await supabase.functions.invoke("merge-guest", { body: { guest_access_token: guestToken } });
    if (error) throw new Error(error.message);
  }
}
