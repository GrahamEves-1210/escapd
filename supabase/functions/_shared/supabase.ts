// Shared helpers for Escapd Edge Functions (Deno).
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export function env(name: string, required = true): string {
  const value = Deno.env.get(name) ?? "";
  if (required && !value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

// Prefer the new secret key (SUPABASE_SECRET_KEYS JSON); fall back to the
// legacy service-role JWT. Never send either to a client.
function serverKey(): string {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      // fall through to legacy key
    }
  }
  return env("SUPABASE_SERVICE_ROLE_KEY");
}

let adminClient: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS: use only after authorizing the request. */
export function admin(): SupabaseClient {
  adminClient ??= createClient(env("SUPABASE_URL"), serverKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Wraps a handler with CORS preflight, POST-only, and uniform error output. */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.code ?? "error", message: err.message }, err.status);
      }
      console.error(err);
      return json({ error: "internal_error" }, 500);
    }
  };
}

function bearer(req: Request): string {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "Missing bearer token", "unauthorized");
  return match[1];
}

/** Verifies the caller's Supabase session JWT with the Auth server. */
export async function requireUser(req: Request): Promise<User> {
  return await userFromToken(bearer(req));
}

export async function userFromToken(token: string): Promise<User> {
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Invalid or expired session", "unauthorized");
  return data.user;
}

/** Constant-time string comparison for shared secrets. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

/** For cron-invoked functions: requires the x-cron-secret header. */
export function requireCronSecret(req: Request): void {
  const expected = env("CRON_SECRET");
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!timingSafeEqual(given, expected)) throw new HttpError(401, "Unauthorized", "unauthorized");
}

/** Recursively lists every object path under a folder prefix in a bucket. */
export async function listAllPaths(bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [prefix.replace(/\/$/, "")];
  while (stack.length) {
    const folder = stack.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin().storage.from(bucket).list(folder, { limit: 1000, offset });
      if (error) throw error;
      for (const entry of data ?? []) {
        const path = `${folder}/${entry.name}`;
        // Folders come back without an id.
        if (entry.id === null) stack.push(path);
        else out.push(path);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

export async function removePaths(bucket: string, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin().storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
}
