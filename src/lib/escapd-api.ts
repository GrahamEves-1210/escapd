// Thin, typed wrappers around the Escapd backend for the Expo app.
// All trust decisions (entitlement, completion, validation) happen on the
// server; these helpers only call RPCs and Storage with the user's session.
import { supabase } from "./supabase";
import type { Database } from "./database.types";
import type { ActionResult, GameAction, Genre, MyAccess, PuzzleDefinitionV1 } from "./puzzle-types";
import type { PlayRequest, PlayResponse, RoomDefinitionV2 } from "@/engine/v2";
import { newId } from "./uuid";

const PHOTO_BUCKET = "room-photos";
const SIGNED_URL_SECONDS = 60 * 15;

type Tables = Database["public"]["Tables"];
export type Room = Tables["rooms"]["Row"];
export type RoomPhoto = Tables["room_photos"]["Row"];
export type GameSession = Tables["game_sessions"]["Row"];
export type GenerationJob = Tables["generation_jobs"]["Row"];
export type UserSettings = Tables["user_settings"]["Row"];

/**
 * Error from the backend. `code` is the Postgres/PostgREST/Auth error code
 * when there is one; `original` keeps the client library's error (its name
 * and HTTP status) for logs and diagnostics.
 */
export class ApiError extends Error {
  constructor(message: string, readonly code?: string, readonly original?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

/** True when the request never reached the server (offline, DNS, timeout). */
export function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /network request failed|failed to fetch|fetch failed|network error|timed? ?out/i.test(message);
}

function unwrap<R extends { data: unknown; error: { message: string; code?: string } | null }>(result: R): NonNullable<R["data"]> {
  if (result.error) throw new ApiError(result.error.message, result.error.code || undefined, result.error);
  if (result.data == null) throw new ApiError("Empty response");
  return result.data as NonNullable<R["data"]>;
}

/**
 * Ensures there is a session; new players start as guests (anonymous sign-in).
 * Pass a CAPTCHA token when the hosted project has CAPTCHA protection enabled.
 */
export async function ensureSession(captchaToken?: string) {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  return unwrap(await supabase.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined)).session!;
}

/** The stored session, without signing anyone in. */
export async function currentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Upgrade a guest in place (same user id, all progress kept). Supabase emails
 * a confirmation link; the guest becomes a full account once it is opened.
 */
export async function linkEmail(email: string, redirectTo?: string) {
  return unwrap(await supabase.auth.updateUser({ email }, redirectTo ? { emailRedirectTo: redirectTo } : undefined));
}

/**
 * Fetch a fresh token so server-side account changes (a confirmed email)
 * reach the JWT that RLS and RPCs read. Returns the refreshed user.
 */
export async function refreshAccount() {
  return unwrap(await supabase.auth.refreshSession()).user;
}

/** Store the session carried by an email link that reopened the app. */
export async function adoptSessionFromLink(accessToken: string, refreshToken: string) {
  return unwrap(await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })).user;
}

export async function getMyAccess(): Promise<MyAccess> {
  return unwrap(await supabase.rpc("get_my_access")) as unknown as MyAccess;
}

/** A new draft room. Without a genre the server makes it noir. */
export async function createRoom(title?: string, genre?: Genre) {
  return unwrap(await supabase.rpc("create_room", { p_title: title ?? null, ...(genre ? { p_genre: genre } : {}) }));
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
  const path = `${userId}/${params.roomId}/${newId()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, params.body, {
    contentType: params.contentType,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  try {
    return unwrap(await supabase.rpc("register_room_photo", {
      p_room_id: params.roomId,
      p_storage_path: path,
      p_position: params.position,
      p_width: params.width ?? null,
      p_height: params.height ?? null,
    }));
  } catch (error) {
    // Registration failed, so no row will ever queue this object for deletion.
    // Remove it now rather than leaving an orphan in the bucket.
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw error;
  }
}

export async function getRoomPhotos(roomId: string): Promise<RoomPhoto[]> {
  return unwrap(await supabase.from("room_photos").select("*").eq("room_id", roomId).order("position"));
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
 * Without a genre the job uses the room's. A genre first changes a draft or
 * failed room's genre; a ready room keeps its own, so a different one is refused.
 */
export async function requestGeneration(roomId: string, idempotencyKey: string, genre?: Genre) {
  return unwrap(await supabase.rpc("request_room_generation", {
    p_room_id: roomId,
    p_idempotency_key: idempotencyKey,
    ...(genre ? { p_genre: genre } : {}),
  }));
}

/** Only queued jobs can be cancelled; once running, the player can just leave the screen. */
export async function cancelGeneration(jobId: string) {
  return unwrap(await supabase.rpc("cancel_room_generation", { p_job_id: jobId }));
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

/**
 * Live job updates. Room status alone cannot surface error_code, attempt
 * count, or backoff, which the generation screen needs.
 */
export function watchGenerationJob(jobId: string, onChange: (job: GenerationJob) => void) {
  const channel = supabase
    .channel(`job:${jobId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "generation_jobs", filter: `id=eq.${jobId}` },
      (payload) => onChange(payload.new as GenerationJob))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function getRoom(roomId: string): Promise<Room> {
  return unwrap(await supabase.from("rooms").select("*").eq("id", roomId).single());
}

/** The player's newest custom room, if any. Never creates one. */
export async function getLatestCustomRoom(): Promise<Room | null> {
  const { data, error } = await supabase.from("rooms").select("*").eq("kind", "custom")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new ApiError(error.message, error.code || undefined);
  return data;
}

/**
 * The player's custom rooms that were sent to be built (queued, generating,
 * ready or failed), newest first. Drafts are left out. Pass a genre for one mode.
 */
export async function listMyRooms(filter: { genre?: Genre } = {}): Promise<Room[]> {
  let query = supabase.from("rooms").select("*").eq("kind", "custom").neq("status", "draft");
  if (filter.genre) query = query.eq("genre", filter.genre);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new ApiError(error.message, error.code || undefined);
  return data ?? [];
}

export async function getGenerationJob(jobId: string): Promise<GenerationJob> {
  return unwrap(await supabase.from("generation_jobs").select("*").eq("id", jobId).single());
}

/** The newest generation job for a room, if any. */
export async function getLatestGenerationJob(roomId: string): Promise<GenerationJob | null> {
  const { data, error } = await supabase.from("generation_jobs").select("*").eq("room_id", roomId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new ApiError(error.message, error.code || undefined);
  return data;
}

/**
 * A version's public definition: a v1 room, or a v2 room (`schema_version: 2`,
 * played on the server through `playActionV2`). Check `schema_version` before use.
 */
export async function getPlayableDefinition(versionId: string): Promise<PuzzleDefinitionV1 | RoomDefinitionV2> {
  const row = unwrap(await supabase.from("puzzle_versions").select("public_definition").eq("id", versionId).single());
  return row.public_definition as unknown as PuzzleDefinitionV1 | RoomDefinitionV2;
}

export async function startOrResume(roomId: string): Promise<GameSession> {
  return unwrap(await supabase.rpc("start_or_resume_session", { p_room_id: roomId }));
}

/** Leave a case without deleting its history. */
export async function abandonSession(sessionId: string): Promise<GameSession> {
  return unwrap(await supabase.rpc("abandon_session", { p_session_id: sessionId }));
}

/** The player's most recent session for a room, if any. Never creates one. */
export async function getLatestSession(roomId: string, status?: GameSession["status"]): Promise<GameSession | null> {
  let query = supabase.from("game_sessions").select("*").eq("room_id", roomId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new ApiError(error.message, error.code || undefined);
  return data;
}

export async function submitAction(sessionId: string, action: GameAction): Promise<ActionResult> {
  return unwrap(await supabase.rpc("submit_action", { p_session_id: sessionId, p_action: action })) as unknown as ActionResult;
}

/**
 * One play request on a v2 session (the play-action edge function): an action,
 * a hint, or neither to load. Errors carry the function's code ("conflict"
 * when another request saved first: load and retry once); a request that never
 * reached the server reads as a network error (isNetworkError).
 */
export async function playActionV2(sessionId: string, body: PlayRequest = {}): Promise<PlayResponse> {
  const { data, error } = await supabase.functions.invoke("play-action", { body: { session_id: sessionId, ...body } });
  if (error) throw await functionError(error);
  if (data == null) throw new ApiError("Empty response");
  return data as PlayResponse;
}

/** An edge function's error as an ApiError: its `{ error: code, message }` body, or a network failure. */
async function functionError(error: { name?: string; message: string; context?: unknown }): Promise<ApiError> {
  if (error.name === "FunctionsFetchError") {
    const cause = error.context instanceof Error ? error.context.message : String(error.context ?? "");
    return new ApiError(`Network request failed${cause ? `: ${cause}` : ""}`, undefined, error);
  }
  const response = error.context as { json?: () => Promise<unknown> } | undefined;
  if (error.name === "FunctionsHttpError" && typeof response?.json === "function") {
    try {
      const body = (await response.json()) as { error?: string; message?: string } | null;
      return new ApiError(body?.message || error.message, body?.error || undefined, error);
    } catch {
      // Not JSON: keep the client's message.
    }
  }
  return new ApiError(error.message, undefined, error);
}

export async function getSettings(): Promise<UserSettings> {
  return unwrap(await supabase.from("user_settings").select("*").single());
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
