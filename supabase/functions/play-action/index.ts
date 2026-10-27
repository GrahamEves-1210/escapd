// Plays one request on the caller's gameplay v2 session (docs/GAMEPLAY_V2.md):
//
//   verify the session JWT -> load the session, definition and secret
//   (worker_v2_play_load, the caller's own only) -> play() (the v2 engine,
//   the cooldown, the hint ladder, the rendered casebook) -> save what changed
//   (worker_v2_play_save, refused if another request saved first) -> respond.
//
// Body: { session_id, action?, hint? }; neither action nor hint just loads.
// The secret never leaves this function: the response carries rendered cards
// and hints (facts the player has found) and the ending once the room is done.
import { admin, handler, HttpError, json, requireUser } from "../_shared/supabase.ts";
import { play, type PlayRequest } from "../_shared/v2/play.ts";
import type { Action, RoomDefinitionV2, RoomSecretV2 } from "../_shared/v2/types.ts";

const ACTIONS = new Set(["inspect", "set_control", "use_item", "combine", "submit"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Loaded {
  session: { id: string; status: string; state: unknown; code_locked_until: string | null; updated_at: string };
  definition: RoomDefinitionV2;
  secret: RoomSecretV2;
}

/** The request body as a PlayRequest, or a 400. The engine checks every field's meaning. */
export function parseBody(body: unknown): { sessionId: string; req: PlayRequest } {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") throw new HttpError(400, "Send a JSON object", "bad_request");
  const sessionId = typeof b.session_id === "string" && UUID.test(b.session_id) ? b.session_id : null;
  if (!sessionId) throw new HttpError(400, "session_id must be a uuid", "bad_request");
  if (b.action !== undefined) {
    const a = b.action as Record<string, unknown> | null;
    if (!a || typeof a !== "object" || typeof a.type !== "string" || !ACTIONS.has(a.type)) {
      throw new HttpError(400, "action.type is not a known action", "bad_request");
    }
    if (JSON.stringify(a).length > 2000) throw new HttpError(400, "action is too large", "bad_request");
    return { sessionId, req: { action: a as unknown as Action } };
  }
  return { sessionId, req: { hint: b.hint === true } };
}

Deno.serve(handler(async (request) => {
  const user = await requireUser(request);
  const { sessionId, req } = parseBody(await request.json().catch(() => null));

  const { data, error } = await admin().rpc("worker_v2_play_load", { p_session_id: sessionId, p_user_id: user.id });
  if (error) throw error;
  if (!data) throw new HttpError(404, "Session not found", "not_found");
  const { session, definition, secret } = data as Loaded;
  if (session.status !== "active" && (req.action || req.hint)) {
    throw new HttpError(409, "This case is no longer in play", "session_ended");
  }

  const now = Date.now();
  const locked = session.code_locked_until ? Date.parse(session.code_locked_until) : null;
  const { response, save } = play(definition, secret, session.state, req, now, locked);

  if (save) {
    const { data: saved, error: saveError } = await admin().rpc("worker_v2_play_save", {
      p_session_id: session.id,
      p_expected_updated_at: session.updated_at,
      p_state: save.state,
      p_wrong: save.wrong,
      p_hints: save.hints,
      p_actions: save.actions,
      p_locked_until: save.lockedUntil ? new Date(save.lockedUntil).toISOString() : null,
      p_completed: save.completed,
    });
    if (saveError) throw saveError;
    if (saved !== true) throw new HttpError(409, "Another move landed first; load and try again", "conflict");
  }
  return json(response);
}));
