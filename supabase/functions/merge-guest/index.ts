// Edge case of guest -> account migration.
// The normal path needs no server call: linking an email/Apple/Google identity
// to the anonymous user keeps the same user id. Use this ONLY when a guest
// signs in to an EXISTING account (their guest session would be orphaned).
//
// Client flow:
//   const guestToken = (await supabase.auth.getSession()).data.session.access_token
//   await supabase.auth.signInWithPassword(...)        // now signed in as the target
//   await supabase.functions.invoke('merge-guest', { body: { guest_access_token: guestToken } })
//
// Both tokens are verified with the Auth server. The guest must be anonymous.
import { admin, handler, HttpError, json, requireUser, userFromToken } from "../_shared/supabase.ts";

Deno.serve(handler(async (req) => {
  const target = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const guestToken = typeof body?.guest_access_token === "string" ? body.guest_access_token : "";
  if (!guestToken) throw new HttpError(400, "guest_access_token is required", "bad_request");

  const guest = await userFromToken(guestToken);
  if (!guest.is_anonymous) throw new HttpError(403, "Source account is not a guest", "forbidden");
  if (guest.id === target.id) return json({ merged: false, reason: "same_user" });
  if (target.is_anonymous) throw new HttpError(403, "Target must be a full account", "forbidden");

  const { data, error } = await admin().rpc("worker_merge_guest_into_user", {
    p_guest_id: guest.id,
    p_target_id: target.id,
  });
  if (error) {
    console.error("merge failed", error);
    throw new HttpError(500, "Merge failed", "internal_error");
  }

  const { error: delError } = await admin().auth.admin.deleteUser(guest.id);
  if (delError) console.error("guest deletion failed (purge job will retry)", delError);

  return json({ merged: true, result: data });
}));
