# Escapd backend

Supabase (Postgres 17, Auth, Storage, Edge Functions) backend for Escapd, the AI escape room game built from photos of your own room. This covers the database, security, storage, auth foundation, billing entitlements, and the async generation pipeline. The AI model call itself is a stub.

## Architecture at a glance

```
Expo app ──(publishable key + user JWT)──► PostgREST ──► RLS-protected tables (read)
   │                                           └──► SECURITY DEFINER RPCs (all writes that matter)
   ├──► Storage: room-photos/{uid}/{room}/{photo}  (private, owner-only, signed URLs)
   └──► Edge Functions: delete-account, merge-guest

RevenueCat ──webhook──► revenuecat-webhook ──► billing_apply_revenuecat_event()
pg_cron ──► generation-worker ──► AI provider (stub) ──► worker_complete_generation_job()
pg_cron ──► storage-janitor  ──► Storage API (deletes queued files, runs retention purge)
```

**Trust model:** the client can *read* its own data and the tutorial, and can edit only harmless columns (titles, display name, settings). Everything that matters goes through server functions that derive identity from the JWT: room creation, photo registration, generation requests, every game move, completion, and entitlements. The client has no write path for completion, entitlement, room status, or puzzle content.

## Schemas

| Schema | Exposed via API | Contents |
|---|---|---|
| `public` | yes | Tables with RLS on every one; client RPCs; `worker_*` and `billing_*` RPCs (service role only) |
| `private` | **no** | Secret puzzle solutions, billing events, AI usage/cost, storage deletion queue, config, helper functions |

## Tables

| Table | Purpose | Client access |
|---|---|---|
| `profiles` | 1:1 with `auth.users`; display name, `tutorial_completed_at` (server-set) | read own; update `display_name` |
| `user_settings` | Sound, music, haptics, hints, reduced motion, locale, opt-ins (privacy-off defaults) | read own; update prefs |
| `rooms` | Escape room: owner, kind (`custom`/`tutorial`), title, status lifecycle, current version | read own + ready tutorial; rename/delete own |
| `room_photos` | Reference photos with ordering (`position`), verified against Storage | read own; delete while draft/failed |
| `puzzle_versions` | Immutable, versioned **public** puzzle graph (validated JSONB) | read published own + tutorial |
| `game_sessions` | Persistent progress: solved puzzles, inventory, revealed hotspots, counters, completion | read own; delete (reset) own |
| `generation_jobs` | Async generation: status, attempts, backoff, lease, errors, result version | read own |
| `entitlements` | Subscription access per provider (RevenueCat today; modular) | read own |
| `private.puzzle_solutions` | Answers, item/combination requirements, rewards | none |
| `private.billing_events` | Raw provider events (idempotency + audit; survives account deletion) | none |
| `private.generation_usage` | Per-attempt model, tokens, images, cost, duration | none |
| `private.storage_deletion_queue` | Files to delete after rows are removed (cascade-safe) | none |
| `private.app_config` | Tunables: photo min/max, generation cap/window, retention days, RevenueCat entitlement id | none |

## Room lifecycle

`draft` → (`request_room_generation`) → `queued` → (worker claims) → `generating` → `ready` | `failed`

* Photos can be added or removed only in `draft`/`failed`.
* Regenerating a `ready` room creates a new version. The old version stays playable, and if regeneration fails the room returns to `ready`.
* Active sessions keep the version they started on.

## Puzzle definition schema v1

Hybrid model: relational tables for ownership and lifecycle, **validated JSONB** for the AI-generated graph, split into a public part and a secret part. `private.validate_puzzle_definition(public, secret)` runs before anything is published. It checks:

- ids, references, and normalized hotspot rectangles
- that every puzzle has a solution entry and no solution keys leak into the public JSON
- size limits
- **solvability**: a simulation proves a valid solve order exists (catches cycles, missing items, and hidden hotspots that are never revealed)

Puzzle kinds:

| kind | Player does | Secret holds |
|---|---|---|
| `inspect` | taps a hotspot (e.g. finds a key in a drawer) | rewards |
| `code` | enters an answer at a hotspot | `answer` (normalized: case, spaces, `-_.,:;` ignored) |
| `use_item` | uses an inventory item on a hotspot | `item_id`, rewards |
| `combine` | combines two items | `inputs` (2 items, any order), rewards |

Rewards: `items` (add), `consume_items` (remove), `reveal_hotspots` (unhide). `requires` encodes dependencies. `exit.requires` defines completion. The full annotated example is in `supabase/migrations/20261023000200_rooms_and_puzzles.sql` and the playable tutorial is in `supabase/seed.sql`. TypeScript types are in `src/lib/puzzle-types.ts`.

## Client RPCs

| RPC | Notes |
|---|---|
| `get_my_access()` | Server-computed: guest?, tutorial done?, entitlement, `can_generate`, usage vs cap, photo limits |
| `create_room(title)` | Full accounts only |
| `register_room_photo(room, path, position, w, h)` | Call after upload; verifies the object exists in the caller's folder; enforces max photos |
| `request_room_generation(room, idempotency_key)` | Checks ownership, full account, **entitlement**, cap, and min photos. Idempotent per key; one active job per room |
| `cancel_room_generation(job)` | Queued jobs only |
| `start_or_resume_session(room)` | Returns the active session or creates one |
| `submit_action(session, action)` | The puzzle engine. Validates against the secret solution under a row lock; writes only on state change |
| `abandon_session(session)` | |

## Auth & guests

* New players use **anonymous sign-in** and can play the tutorial immediately. Guests cannot create custom rooms, upload photos, or generate.
* **Upgrade:** `updateUser({ email })` or `linkIdentity({ provider: 'apple' | 'google' })` keeps the **same user id**, so no data migration is needed.
* **Edge case:** a guest signs in to an *existing* account. The `merge-guest` function verifies both tokens, moves tutorial progress, and deletes the guest.
* Inactive guests are purged after 30 days.

## Subscriptions

* `entitlements` is written only by server code. `private.has_active_entitlement()` is the single check used by generation. A client-side `isSubscribed` flag is never trusted.
* **RevenueCat convention:** the app calls `Purchases.logIn(supabaseUserId)` after sign-in. The webhook resolves users from `app_user_id`, `original_app_user_id`, or `aliases`.
* Event handling:
  - idempotent on event `id`
  - ignores stale (older) events
  - `BILLING_ISSUE` keeps access during the grace period, `EXPIRATION` revokes it, `TRANSFER` moves the entitlement, `SUBSCRIPTION_PAUSED` is ignored (per RevenueCat guidance)
* Sandbox purchases are accepted (needed for TestFlight/App Review) and recorded in `environment`.
* To add direct App Store or Play integration later, write rows with `provider = 'app_store' | 'play_store'`. No schema change is needed.

## Photos & privacy

* Bucket `room-photos` is **private**: 15 MB limit, jpeg/png/heic/webp only.
* Owner-only upload into `{uid}/{room}/`, only for editable rooms, full accounts only. Owner-only read and delete. No overwrite policy, so files are immutable.
* Display photos with **short-lived signed URLs** (`signedPhotoUrl`, 15 min). The worker signs 10-minute URLs for the AI provider.
* **Strip EXIF/GPS before upload** (client responsibility). Room photos can reveal location.
* **Deletion:** removing photo rows, rooms, or accounts enqueues files, and `storage-janitor` deletes them through the Storage API. `delete-account` also wipes the user's folder immediately.
* **Retention:** draft/failed rooms with no activity for 7 days are purged. Ready rooms keep their photos because gameplay displays them.
* AI cost and billing audit rows are kept **without a foreign key** after account deletion, so they hold no personal data beyond a dangling id.

## Edge Functions

| Function | Trigger | Auth |
|---|---|---|
| `revenuecat-webhook` | RevenueCat | `Authorization` header == `REVENUECAT_WEBHOOK_AUTH`; optional HMAC (`X-RevenueCat-Webhook-Signature`, 5-min tolerance) |
| `delete-account` | App (`{ confirm: "DELETE" }`) | User JWT (verified with Auth server) |
| `merge-guest` | App | User JWT + guest token |
| `generation-worker` | pg_cron, every minute | `x-cron-secret` |
| `storage-janitor` | pg_cron, every 15 min; daily with `{ purge: true }` | `x-cron-secret` |

`verify_jwt = false` is set in `config.toml` because each function authenticates in code. This works with both the new publishable/secret keys and the legacy JWT keys.

## Environment variables

See `.env.example`.

| Variable | Where | Secret? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | app | no |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app (publishable or legacy anon key) | no (RLS protects data) |
| `CRON_SECRET` | function secret + Vault (`escapd_cron_secret`) | **yes** |
| `REVENUECAT_WEBHOOK_AUTH` | function secret | **yes** |
| `REVENUECAT_WEBHOOK_SIGNING_SECRET` | function secret (optional) | **yes** |
| `AI_PROVIDER_API_KEY` | function secret (future) | **yes** |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` / `SUPABASE_SERVICE_ROLE_KEY` | injected automatically into hosted functions | **yes**, never in the app |

## Setup checklist (hosted project)

1. **Link and push schema** (from the repo root):
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push            # applies supabase/migrations
   ```
   Then run `supabase/seed.sql` once in the SQL editor to create the tutorial room.
2. **Auth** (Dashboard > Authentication):
   - Sign In / Providers: enable **Anonymous sign-ins** and **Allow manual linking**.
   - Enable Email, plus **Apple** (required by App Store rules when offering other social logins) and optionally Google.
   - Attack Protection: enable **CAPTCHA** (Turnstile or hCaptcha). Supabase strongly recommends this with anonymous sign-ins.
   - URL Configuration: Site URL `escapd://`, redirect URLs `escapd://**` (plus `exp://**` for Expo Go during development).
3. **Data API:** keep the exposed schemas as `public` (and `graphql_public`). Never expose `private`.
4. **Storage:** buckets and policies come from the migration. Verify `room-photos` shows as Private.
5. **Edge Functions:**
   ```bash
   npx supabase secrets set CRON_SECRET=... REVENUECAT_WEBHOOK_AUTH=... [REVENUECAT_WEBHOOK_SIGNING_SECRET=...]
   npx supabase functions deploy revenuecat-webhook delete-account merge-guest generation-worker storage-janitor
   ```
6. **Schedules:** enable `pg_cron` and `pg_net`, then run `scripts/schedule-jobs.sql` with your project URL and cron secret.
7. **RevenueCat** (when ready):
   - Webhook URL: `https://<ref>.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization header: the same value as `REVENUECAT_WEBHOOK_AUTH`; enable HMAC signing
   - Entitlement id `pro`. To use another id, update `private.app_config.revenuecat_entitlement_id`.
8. **Types:** after pushing, regenerate `src/lib/database.types.ts` with `npx supabase gen types typescript --project-id <ref> --schema public`.

## Testing

```bash
scripts/test-db.sh                         # throwaway Postgres + Supabase stubs (no Docker): 110 assertions
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres scripts/test-db.sh   # against `supabase start` after `supabase db reset`
```

The suite covers:

- **Schema guarantees:** RLS on every table; anon cannot execute any function; worker and billing functions are service-only; every definer function pins `search_path`.
- **Isolation:** cross-user isolation for profiles, rooms, photos, versions, jobs, and sessions; guest restrictions.
- **Storage:** upload, read, and folder-layout policies; registering only verified uploads.
- **Billing:** RevenueCat activation via alias, duplicate, stale, other-entitlement, unknown-user, and expiration events.
- **Generation:** entitlement, photo minimum, and cap enforcement; idempotency; claim, invalid output with retry, lease safety, publishing, and cost tracking.
- **Puzzle engine:** locked puzzles, items, codes, combinations, hidden hotspots, completion, and tutorial completion.
- **Cleanup:** guest merge, room and account deletion cascades, the storage queue, and retention purges.

## Decisions for the next agent

* **Never write gameplay or entitlement state from the client.** Add new mechanics to `submit_action` and the validator together, and bump `schema_version` when the format changes incompatibly. The CHECK constraints currently pin `schema_version = 1`.
* **Hidden hotspots are in the public JSON** (flagged `hidden`). A determined user could see their positions. This trade keeps the client simple. If it matters, move hidden hotspots into the solution and return them in `revealed_hotspots` results.
* **Code puzzles can be brute-forced** via the API (only by the player, in their own game). `wrong_answer_count` is tracked. Add a cooldown in `submit_action` if leaderboards ever exist.
* **Generation output must reference `room_photos.id`** in `photos[].photo_id`, and the worker passes these ids to the model. `worker_complete_generation_job` re-validates everything and requeues invalid output (up to `max_attempts`).
* **Implement AI in `supabase/functions/_shared/ai.ts`** (`generatePuzzle`). Throw `GenerationError(code, retryable, usage)` for provider errors and always return `usage` so cost tracking works. Keep `LEASE_SECONDS` above the worst-case model latency.
* **Cap and limits live in `private.app_config`**, so you can change them without a migration.
* **Hints:** `hints_used` exists on sessions and `hints_enabled` in settings, but no hint RPC exists yet.
* `src/lib/database.types.ts` is hand-written. Replace it with generated types after the first push.
