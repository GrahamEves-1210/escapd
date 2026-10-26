# Escapd backend

Supabase (Postgres 17, Auth, Storage, Edge Functions) backend for Escapd, the AI escape room game built from photos of your own room. This covers the database, security, storage, auth foundation, billing entitlements, and the async generation pipeline, including AI room generation with Gemini (see [AI room generation](#ai-room-generation)).

## Architecture at a glance

```
Expo app ──(publishable key + user JWT)──► PostgREST ──► RLS-protected tables (read)
   │                                           └──► SECURITY DEFINER RPCs (all writes that matter)
   ├──► Storage: room-photos/{uid}/{room}/{photo}  (private, owner-only, signed URLs)
   └──► Edge Functions: delete-account, merge-guest

RevenueCat ──webhook──► revenuecat-webhook ──► billing_apply_revenuecat_event()
pg_cron ──► generation-worker ──► generatePuzzle() ──► Gemini ──► worker_complete_generation_job()
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
| `rooms` | Escape room: owner, kind (`custom`/`tutorial`), title, `genre`, status lifecycle, current version | read own + ready tutorial; rename/delete own |
| `room_photos` | Reference photos with ordering (`position`), verified against Storage | read own; delete while draft/failed |
| `puzzle_versions` | Immutable, versioned **public** puzzle graph (validated JSONB) | read published own + tutorial |
| `game_sessions` | Persistent progress: solved puzzles, inventory, revealed hotspots, counters, completion, hint progress (`hint_progress`), wrong-code cooldown (`code_wrong_streak`, `code_locked_until`) | read own; delete (reset) own |
| `private.code_cooldowns` | The wrong-answer streak and lock per player and room, copied from `game_sessions` by a trigger, so a new session on the same room inherits them | none |
| `generation_jobs` | Async generation: status, attempts, backoff, lease, errors, result version, `genre` (snapshot of the room's) | read own |
| `entitlements` | Subscription access per provider (RevenueCat today; modular) | read own |
| `private.puzzle_solutions` | Answers, item/combination requirements, rewards | none |
| `private.billing_events` | Raw provider events (idempotency + audit; survives account deletion) | none |
| `private.generation_usage` | Per-attempt model, tokens, images, cost, duration | none |
| `private.storage_deletion_queue` | Files to delete after rows are removed (cascade-safe) | none |
| `private.app_config` | Tunables: photo min/max, generation cap/window, retention days, RevenueCat entitlement id, wrong-code cooldown (`code_cooldown_wrong_answers` = 8, `code_cooldown_minutes` = 10) | none |

## Room lifecycle

`draft` → (`request_room_generation`) → `queued` → (worker claims) → `generating` → `ready` | `failed`

* Photos can be added or removed only in `draft`/`failed`.
* Regenerating a `ready` room creates a new version. The old version stays playable, and if regeneration fails the room returns to `ready`.
* Active sessions keep the version they started on.

## Puzzle definition schema v1

Hybrid model: relational tables for ownership and lifecycle, **validated JSONB** for the AI-generated graph, split into a public part and a secret part. `private.validate_puzzle_definition(public, secret)` runs before anything is published. It checks:

- ids, references, and normalized hotspot rectangles
- that every puzzle has a solution entry and no solution keys (`answer`, `rewards`, `inputs`, `solution`, `hints`) leak into the public JSON
- size limits
- **solvability**: a simulation proves a valid solve order exists (catches cycles, missing items, and hidden hotspots that are never revealed)
- **clue coverage**: inside that simulation, a `code` puzzle counts as solvable only once its answer is written where the player can read it. That means the `description` of an item in the simulated inventory, or of a hotspot that is revealed (non-hidden from the start, hidden after a simulated reveal). Answer and text are compared after `private.normalize_answer`, so `"12 34"` covers `"12-34"`. The answer must appear inside a single description; descriptions are joined with `|`, so a code cannot be stitched across two. Because it is a solve condition, a clue found later by a puzzle that does not depend on the code still counts, whatever the array order. A code that never gets a readable clue fails with `puzzle <id>: code answer is not written anywhere the player can read before solving it`. Put code digits in item descriptions the player receives before the code's `requires` are met (the client shows those only from inventory), or in a revealed hotspot's description. Never put them in a `prompt`.
- code answers must keep at least one character after normalization (`"--"` is rejected)
- **hints** (optional, secret only): `puzzles[<id>].hints` must be an array of 1–3 non-empty strings, each at most 400 characters. Rung 1 is a nudge (a view or object category), rung 2 a direction (the connection to make), and rung 3 a reveal (the action or answer).

`public.worker_preview_puzzle(p_public_definition, p_solution)` (service role only) returns the same error list without writing anything, so the generator can repair once before calling `worker_complete_generation_job`. Publish re-runs the validator and also checks `photos[].photo_id` against the job's room, which the preview cannot do.

Puzzle kinds:

| kind | Player does | Secret holds |
|---|---|---|
| `inspect` | taps a hotspot (e.g. finds a key in a drawer) | rewards |
| `code` | enters an answer at a hotspot | `answer` (normalized: case, spaces, `-_.,:;'"` ignored) |
| `use_item` | uses an inventory item on a hotspot | `item_id`, rewards |
| `combine` | combines two items | `inputs` (2 items, any order), rewards |
| `accuse` | names who, why and how (crime scene finale; no hotspot) | `answer {suspect, motive, method}`, `evidence {suspect, motive, method}` (item ids), rewards |

Rewards: `items` (add), `consume_items` (remove), `reveal_hotspots` (unhide). `requires` encodes dependencies. `exit.requires` defines completion. Any secret entry may also carry `hints: [nudge, direction, reveal]`. The full annotated example is in `supabase/migrations/20261023000200_rooms_and_puzzles.sql` and the playable tutorial is in `supabase/seed.sql`. Genres, `accuse` and hotspot effects are in [Genres, accusations and effects](#genres-accusations-and-effects). TypeScript types are in `src/lib/puzzle-types.ts`.

## Genres, accusations and effects

Added by `20261026000100_genres_and_accuse.sql`. `schema_version` stays 1 and every new field is optional, so existing rooms and the tutorial keep working.

- **Genre** is `noir`, `crime_scene` or `paranormal`. `rooms.genre` defaults to `noir`, which covers existing rooms and the tutorial. Clients can read it but not update it; they choose it with `create_room(p_title, p_genre)` or `request_room_generation(..., p_genre)`.
  - A draft or failed room takes the requested genre. A ready room keeps its own, and asking for another raises `22023` ("a built case keeps its genre"). A replayed key or an active job of another genre also raises `22023`.
  - The job row copies the room's genre, so `worker_claim_generation_job` hands it to the worker unchanged.
  - The public definition carries an optional top-level `"genre"` (absent means noir). `worker_complete_generation_job` fails an attempt whose genre differs from the job's, as it does for any invalid output.
- **Hotspot `effect`** (optional, public) is one of `flicker | apparition | moved | cold | whisper`. Templates set it and the client draws it. Any other value fails with `hotspot <id> has an unknown effect`.
- **`accuse`:**
  - **Public puzzle:** no `hotspot_id`. It has exactly 3 `suspects` (`id`, `name`, `role`, `alibi`), 3 `motives` and 3 `methods` (`id`, `name`).
    - Option ids follow the id rule and are unique across the whole definition.
    - Names are 1–60 characters, roles 1–60 and alibis 1–200.
    - Within a dimension, no normalized name equals or contains another.
  - **Secret:** `answer` picks one option per dimension and `evidence` names one item per dimension. `evidence` must never appear in the public JSON.
  - **Deducibility:** the validator's simulation treats an accusation as attemptable once its `requires` are solved. It counts as solvable only when, in every dimension, the evidence item is held and its normalized description names the correct option and neither wrong one. For suspects, that means it breaks exactly the culprit's alibi. Otherwise it fails with `accusation <id> cannot be worked out from the clues`.
  - An accusation may be the exit.
- **Playing it:** send `submit_action(session, {type: "accuse", puzzle_id, suspect_id, motive_id, method_id})`.
  - An id that is not one of that puzzle's options returns `invalid` with "Pick one of each.". This is decided from public data only.
  - The generator keeps the answer inside the three evidence items: no other public text (title, intro, hotspots, other items, prompts) names a right option, and evidence never names a wrong option of any list. Those two rules are generator-only (`puzzle-check.ts` generation contract); the database checks deducibility per list.
  - A wrong triple takes the wrong-code path: same streak, same lock, and always exactly `{outcome: "wrong", puzzle_id, message: "That doesn't add up."}`, plus `retry_after` when it starts the lock. Codes and accusations share one cooldown.
  - A right triple solves like any puzzle and clears the streak.
  - Every state write also stores `state.contradicted`: the accused suspect of each accusation whose suspect evidence the player holds. That is text they have already read. A new session has no `contradicted` until its first state change.
- **Hints:** `use_hint` treats `accuse` like `combine`, so it is attemptable without a hotspot.

The TypeScript preflight (`puzzle-check.ts`) and the trial engine (`scripts/trial/engine.js`) mirror these rules and messages. As everywhere, SQL wins if they disagree.

## Client RPCs

| RPC | Notes |
|---|---|
| `get_my_access()` | Server-computed: guest?, tutorial done?, entitlement, `can_generate`, usage vs cap, photo limits |
| `create_room(title, genre)` | Full accounts only. `genre` defaults to `noir` |
| `register_room_photo(room, path, position, w, h)` | Call after upload; verifies the object exists in the caller's folder; enforces max photos |
| `request_room_generation(room, idempotency_key, genre)` | Checks ownership, full account, **entitlement**, cap, and min photos. Idempotent per key; one active job per room. Optional `genre` (null keeps the room's; a ready room keeps its genre) |
| `cancel_room_generation(job)` | Queued jobs only |
| `start_or_resume_session(room)` | Returns the active session or creates one |
| `submit_action(session, action)` | The puzzle engine. Validates against the secret solution under a row lock; writes only on state change. Actions: `inspect`, `solve`, `use_item`, `combine`, `accuse`. Wrong-code cooldown: see below |
| `use_hint(session, rung)` | Returns one rung of the hint ladder for the player's next step. Idempotent per rung; see below |
| `abandon_session(session)` | |

**Wrong-code cooldown.** Wrong accusations count exactly like wrong codes. The 8th consecutive wrong answer still returns `outcome: "wrong"`, and that result also carries `retry_after`. For the next 10 minutes every `solve` and `accuse` by that player on that room, right or wrong, returns `{ "outcome": "invalid", "reason": "cooldown", "retry_after": "<timestamptz>", "message": "..." }` and writes nothing. `inspect`, `use_item`, and `combine` are never blocked and do not extend the lock. When the lock lapses the player gets a fresh 8 attempts. A correct code also resets the streak. Branch on `reason`, never on `message`. State lives in `game_sessions.code_locked_until` and `code_wrong_streak`, and is kept per player and room in `private.code_cooldowns`: a new session on the same room starts with them, so abandoning or deleting a session does not lift the lock. `wrong_answer_count` stays the cumulative total. Limits come from `private.app_config`.

**Hints.** `use_hint(p_session_id, p_rung)` reads `puzzles[<id>].hints` from the secret solution:

- **Target:** the first unsolved puzzle, in definition order, that can be attempted now. That means its requires are met and its hotspot is revealed (combine has no hotspot), a `use_item` item is held, or both `combine` inputs are held. If nothing is attemptable, it falls back to the first unsolved puzzle whose requires are met. The target is stored in `game_sessions.hint_progress` and stays put until that puzzle is solved. Generators should therefore list optional or red-herring puzzles after the required ones.
- **Rungs:** `p_rung` is the 1-based rung the player wants. A rung already shown for the current target is returned again for free (`already_revealed: true`). Exactly the next rung is revealed and `hints_used` goes up by one. Anything else returns `status: "rung_unavailable"` with `next_rung`. The session row lock serializes calls, so two simultaneous requests for the same rung charge once.
- **Responses:**
  - `{ status: "ok", puzzle_id, rung, total_rungs, hint, already_revealed, hints_used }`
  - `{ status: "disabled", hints_used, message }` when `user_settings.hints_enabled` is false
  - `{ status: "no_hints", puzzle_id, total_rungs: 0, hints_used, message }`
  - `{ status: "rung_unavailable", puzzle_id, rung, next_rung, total_rungs, hints_used, message }`

  A missing, foreign, or inactive session raises, as in `submit_action`. Types are `HintResult` and `HintProgress` in `src/lib/puzzle-types.ts`.
- **What clients can read:** `hint_progress` is `{ puzzle_id, rungs: [shown texts] }`. Only rungs already shown are stored there. If `puzzle_id` is now in `state.solved`, treat it as nothing shown yet.

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

## AI room generation

`generation-worker` calls `generatePuzzle()` (`supabase/functions/_shared/ai.ts`) once per claimed job. Every stage runs inside that one call, which stops itself at 100 s (worker budget ~110 s, lease 300 s). It returns `{ publicDefinition, solution, usage }`; `worker_complete_generation_job` re-validates and is the only publisher.

| # | Stage | Module |
|---|---|---|
| 1 | Download the signed photos in position order (URLs and bytes are never logged) | `ai.ts` |
| 2 | Perceive each photo in parallel: label, affordance (closed set), 0–1000 box, confidence, `person_present`, `sensitive_text` | `perception.ts` |
| 3 | Any person or legible mail/document/screen → `person_or_sensitive` | `perception.ts` |
| 4 | One verification call over all photos drops implied, occluded and inside-a-closed-container candidates | `perception.ts` |
| 5–6 | Reconcile duplicates (same object across photos, same label, overlapping boxes) so each real object gives **one** hotspot on its clearest photo; fewer than 4 → `too_few_objects` | `perception.ts` |
| 7 | Pick a hand-authored template whose roles fit; mint the 4-digit code and item ids with crypto randomness | `templates.ts` |
| 8 | One prose call (title, intro, names, descriptions, prompts, secret messages, 3 hint rungs, exit message). Code inserts the code literal into the clue item if the model left it out and strips it from every other public field | `prose.ts` |
| 9 | Assemble schema v1; boxes become `x,y,w,h` rects that always pass the SQL rect check | `prose.ts`, `geometry.ts` |
| 10 | TS preflight (`puzzle-check.ts`, mirrors `private.validate_puzzle_definition` incl. clue coverage) plus `worker_preview_puzzle`; on errors, **one** text-only repair call, then preflight again → `invalid_after_repair` | `ai.ts` |

Templates own causality; the model never invents edges. Each of the seven templates (`cabinet_keypad`, `torn_note_safe`, `assembled_tool`, `code_box_key`, `chain_of_custody`, `split_cipher`, `quiet_heist`) has 4–6 required steps ending in an inspect or a code, plus up to two red-herring inspects that grant nothing and are listed last. Every secret puzzle carries `hints: [nudge, direction, reveal]`. If `worker_preview_puzzle` does not exist yet (PostgREST `PGRST202`), the TS preflight is used alone.

**Errors.** Every `GenerationError` carries the usage spent so far. Non-retryable codes fail the room once (the player edits photos and retries; failed jobs do not count toward the cap). Retryable codes back off 30 s, 2 m, 8 m up to `max_attempts`.

| `error_code` | Retryable | Meaning |
|---|---|---|
| `person_or_sensitive` | no | Person or legible private text. Message ends with `photo position(s): 0, 2.` (`room_photos.position`) |
| `too_few_objects` | no | Fewer than 4 distinct verified objects; ask for one or two closer views |
| `photo_unavailable` / `photos_too_large` | no | Photo missing (HTTP 4xx), unsupported type, over 15 MB, or all photos together over the provider's ~20 MB inline limit |
| `spend_cap` | no | The next call could push this attempt over $0.90 |
| `invalid_after_repair` | no | Still invalid after the one repair |
| `provider_blocked` | no | Provider safety block on the input |
| `provider_rejected` / `provider_not_configured` / `invalid_input` | no | Provider 4xx, missing `AI_PROVIDER_API_KEY`, or a job the pipeline cannot handle (operator issue) |
| `provider_timeout` / `provider_rate_limited` / `provider_unavailable` / `provider_network` | yes | Timeout or 408, 429, 5xx, connection failure |
| `model_output_invalid` | yes | Output not valid JSON, outside the closed schema, or truncated |
| `photo_download_failed` / `generation_timeout` / `internal_error` | yes | Storage hiccup, the 100 s internal deadline, unexpected exception |

**Models** (Gemini REST `generateContent`, key in the `x-goog-api-key` header, structured output via `responseJsonSchema`, images inline as base64):

| Use | Default | Override | Caps |
|---|---|---|---|
| Perception + verification | `gemini-2.5-flash` (fallback `gemini-3-flash-preview`) | `AI_PERCEPTION_MODEL`, `AI_PERCEPTION_FALLBACK_MODEL` | 2,000 output tokens per photo (3,000 for verification), thinking off |
| Prose + repair | `gemini-3.1-pro-preview` (no fallback) | `AI_PROSE_MODEL`, `AI_PROSE_FALLBACK_MODEL` | 6,000 output tokens + 1,024 thinking |

A fallback model is tried once on a retryable error or a 404 (not after a timeout). Cost uses the list prices in `cost.ts` (thinking tokens bill as output); `usage.model` lists every model used, `image_count` counts images sent. Logs are one `generation_stage` JSON line per stage with timings, counts and cost only: never URLs, image bytes, labels, generated text, or answers.

**Contact sheet** (developer only, local files, nothing uploaded; never commit customer photos):

```bash
deno run --allow-read --allow-write scripts/generation-contact-sheet.ts --definition room.json --out sheet.html photo0.jpg photo1.jpg photo2.jpg
```

## Environment variables

See `.env.example`.

| Variable | Where | Secret? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | app | no |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app (publishable or legacy anon key) | no (RLS protects data) |
| `CRON_SECRET` | function secret + Vault (`escapd_cron_secret`) | **yes** |
| `REVENUECAT_WEBHOOK_AUTH` | function secret | **yes** |
| `REVENUECAT_WEBHOOK_SIGNING_SECRET` | function secret (optional) | **yes** |
| `AI_PROVIDER_API_KEY` | function secret (Gemini API key, used by generation-worker) | **yes** |
| `AI_PERCEPTION_MODEL`, `AI_PERCEPTION_FALLBACK_MODEL`, `AI_PROSE_MODEL`, `AI_PROSE_FALLBACK_MODEL` | function secrets, optional model overrides (see [AI room generation](#ai-room-generation)) | no |
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
   npx supabase secrets set CRON_SECRET=... REVENUECAT_WEBHOOK_AUTH=... AI_PROVIDER_API_KEY=... [REVENUECAT_WEBHOOK_SIGNING_SECRET=...]
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
scripts/test-db.sh                         # throwaway Postgres + Supabase stubs (no Docker): 260 assertions
PGBIN=/path/to/postgres/bin scripts/test-db.sh   # same, with server binaries outside /usr/lib/postgresql
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres scripts/test-db.sh   # against `supabase start` after `supabase db reset`
(cd supabase/functions && deno check */index.ts && deno test --allow-read)   # Edge Functions + generation pipeline (stubbed providers, no network)
```

The suite covers:

- **Schema guarantees:** RLS on every table; anon cannot execute any function; worker and billing functions are service-only; every definer function pins `search_path`.
- **Isolation:** cross-user isolation for profiles, rooms, photos, versions, jobs, and sessions; guest restrictions.
- **Storage:** upload, read, and folder-layout policies; registering only verified uploads.
- **Billing:** RevenueCat activation via alias, duplicate, stale, other-entitlement, unknown-user, and expiration events.
- **Generation:** entitlement, photo minimum, and cap enforcement; idempotency; claim, invalid output with retry, lease safety, publishing, and cost tracking.
- **Puzzle engine:** locked puzzles, items, codes, combinations, hidden hotspots, completion, and tutorial completion.
- **Validator extensions** (`02_clues_hints_cooldown.sql`): clue coverage (unclued codes, clues that only arrive after the code, array-order independence, normalization, no stitching across descriptions), hint shape, and the `hints` leak check. Also `worker_preview_puzzle`: errors returned, nothing inserted, service role only.
- **Hints:** next-step targeting across inspect, use_item, combine, and code. Same rung twice charges once, no skipping, the target stays pinned, unshown rungs are never stored, and the reveal never appears in `public_definition`. Also covers hints disabled, no hints, and foreign or inactive sessions.
- **Cooldown:** the 9th immediate code is blocked with `reason: "cooldown"`, and refusals write nothing. Inspect still works and does not extend the lock. After the lock there is a fresh allowance, and a correct code succeeds.
- **Genres and accusations** (`03_genres_accuse.sql`):
  - genre defaults and checks, and the client cannot update `genre`;
  - old argument lists still resolve, with exactly one signature per RPC;
  - genre rules on replay, active, draft, failed and ready rooms, and the worker's genre check;
  - hotspot effects and validator deducibility, with each structural rule;
  - accuse right, wrong and invalid; one identical reply for all 26 wrong triples;
  - one cooldown shared by codes and accusations;
  - `state.contradicted`, and `use_hint` targeting an accusation.
- **Cleanup:** guest merge, room and account deletion cascades, the storage queue, and retention purges.

## Decisions for the next agent

* **Never write gameplay or entitlement state from the client.** Add new mechanics to `submit_action` and the validator together, and bump `schema_version` when the format changes incompatibly. The CHECK constraints currently pin `schema_version = 1`.
* **Hidden hotspots are in the public JSON** (flagged `hidden`). A determined user could see their positions. This trade keeps the client simple. If it matters, move hidden hotspots into the solution and return them in `revealed_hotspots` results.
* **Wrong-code cooldown:** 8 consecutive wrong codes lock `solve` and `accuse` for 10 minutes per player and room (it survives abandoning or deleting the session), giving 8 attempts per 10 minutes, which makes walking a 4-digit code take days. It uses dedicated columns (`code_locked_until`, `code_wrong_streak`), not `wrong_answer_count` + `last_played_at`, because `last_played_at` moves on every action and a cumulative count would re-lock after one wrong answer. Tune it in `private.app_config`. Clients read `reason`/`retry_after`.
* **Generation output must reference `room_photos.id`** in `photos[].photo_id`, and the worker passes these ids to the model. `worker_complete_generation_job` re-validates everything and requeues invalid output (up to `max_attempts`).
* **AI generation lives in `supabase/functions/_shared/`** (`generatePuzzle` in `ai.ts`). Throw `new GenerationError(message, code, retryable, usage)` (that argument order) and always pass the usage spent so far, so failed attempts are still costed. Keep `LEASE_SECONDS` (300) above the worst-case call; the pipeline stops itself at 100 s.
* **Cap and limits live in `private.app_config`**, so you can change them without a migration.
* **Hints:** `use_hint` serves the secret `hints` ladder (1–3 rungs per puzzle) for the player's next step, respects `hints_enabled`, and charges `hints_used` once per newly shown rung. Progress lives in `game_sessions.hint_progress` because `submit_action` rebuilds `state` and would drop extra keys. Generated rooms should ship three rungs for every puzzle and list herring puzzles last. The Study's seed is the reference for voice.
* **Clue coverage** is part of the validator. `worker_preview_puzzle` lets the generator see errors before publishing. If the TS preflight in `supabase/functions` ever disagrees with SQL, SQL wins.
* `src/lib/database.types.ts` is hand-written. Replace it with generated types after the first push.
