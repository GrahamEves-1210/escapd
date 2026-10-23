// RevenueCat -> Supabase entitlement sync.
//
// Auth (configure in RevenueCat > Integrations > Webhooks):
//   * Authorization header value  -> REVENUECAT_WEBHOOK_AUTH   (required)
//   * HMAC signing secret          -> REVENUECAT_WEBHOOK_SIGNING_SECRET (optional, recommended)
//     Header: X-RevenueCat-Webhook-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">
//
// The database function does idempotency (event id), stale-event protection
// and user resolution. Returns 200 for anything recorded (including ignored
// or unknown-user events) so RevenueCat does not retry them; 5xx on database
// errors so it does.
import { admin, env, handler, HttpError, json, timingSafeEqual } from "../_shared/supabase.ts";

const SIGNATURE_TOLERANCE_SECONDS = 300;

async function verifySignature(rawBody: string, header: string | null, secret: string): Promise<void> {
  if (!header) throw new HttpError(401, "Missing signature", "unauthorized");
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.trim().split("=", 2) as [string, string]),
  );
  const t = Number(parts.t);
  if (!parts.t || !parts.v1 || !Number.isFinite(t)) throw new HttpError(401, "Malformed signature", "unauthorized");
  if (Math.abs(Date.now() / 1000 - t) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new HttpError(401, "Signature timestamp outside tolerance", "unauthorized");
  }
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${rawBody}`));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (!timingSafeEqual(expected, parts.v1)) throw new HttpError(401, "Bad signature", "unauthorized");
}

Deno.serve(handler(async (req) => {
  const expectedAuth = env("REVENUECAT_WEBHOOK_AUTH");
  if (!timingSafeEqual(req.headers.get("Authorization") ?? "", expectedAuth)) {
    throw new HttpError(401, "Unauthorized", "unauthorized");
  }

  const rawBody = await req.text();   // raw bytes are required for HMAC verification
  const signingSecret = env("REVENUECAT_WEBHOOK_SIGNING_SECRET", false);
  if (signingSecret) {
    await verifySignature(rawBody, req.headers.get("X-RevenueCat-Webhook-Signature"), signingSecret);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new HttpError(400, "Body is not JSON", "bad_request");
  }

  const { data, error } = await admin().rpc("billing_apply_revenuecat_event", { p_payload: payload });
  if (error) {
    console.error("billing_apply_revenuecat_event failed", error);
    if (error.code === "22023") throw new HttpError(400, error.message, "bad_request");
    throw new HttpError(500, "Failed to apply event", "internal_error");
  }
  return json({ received: true, result: data });
}));
