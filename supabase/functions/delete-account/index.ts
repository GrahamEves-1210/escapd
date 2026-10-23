// Permanently deletes the calling user's account and data.
//   1. Verifies the caller's session JWT.
//   2. Removes every file under room-photos/{user_id}/ via the Storage API.
//   3. Deletes the auth user; every public table cascades from auth.users.
// Body (optional): { "confirm": "DELETE" } is required to avoid accidental calls.
//
// NOTE: store subscriptions are billed by Apple/Google, not by us. The app
// must tell the user to cancel in their store account settings (App Store
// guideline 5.1.1(v)). Billing audit rows are kept without personal data.
import { admin, handler, HttpError, json, listAllPaths, removePaths, requireUser } from "../_shared/supabase.ts";

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") {
    throw new HttpError(400, 'Send { "confirm": "DELETE" } to delete the account', "confirmation_required");
  }

  const paths = await listAllPaths("room-photos", user.id);
  await removePaths("room-photos", paths);

  const { error } = await admin().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("deleteUser failed", error);
    throw new HttpError(500, "Could not delete account", "internal_error");
  }

  // TODO(billing): when RevenueCat is live, also call its Delete Subscriber API
  // for this app_user_id so the customer record is removed there too.
  return json({ deleted: true, photos_removed: paths.length });
}));
