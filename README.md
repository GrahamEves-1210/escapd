# Escapd

Photograph your room and it becomes a playable mystery.

This repository holds the **Expo app** (iOS and Android) and its **Supabase backend**. The implementation plan lives outside the repo; [docs/BACKEND.md](docs/BACKEND.md) is the source of truth for backend behavior.

```
app/                    # Expo Router screens: title, tutorial (The Study), completion, player
src/
  lib/                  # Supabase client, typed API helpers, puzzle schema v1 types (shared contract)
  game/                 # player hook (server-authoritative), presentation selectors, preferences
  render/               # SceneView, HotspotLayer, InventoryBar, CodePad, sheets, Player
  components/ theme/    # Darkroom Dossier tokens (soot, brass, manila) and primitives
  tutorial/             # bundled tutorial scenes and coach marks
assets/                 # icon, splash, grain, tutorial scenes (placeholders until real photos)
supabase/
  migrations/           # schema, RLS, storage policies, RPCs (apply with `supabase db push`)
  seed.sql              # the guided tutorial room, The Study
  functions/            # Edge Functions: revenuecat-webhook, delete-account, merge-guest,
                        #                 generation-worker (Gemini via generatePuzzle), storage-janitor
  tests/                # database permission/behavior tests
scripts/
  test-db.sh            # run migrations + tests on a throwaway Postgres
  schedule-jobs.sql     # pg_cron schedules for the hosted project
  generation-contact-sheet.ts   # dev-only: draw generated hotspots over local photos
docs/BACKEND.md         # architecture, tables, setup checklist, decisions
.env.example            # environment variable template (no secrets)
```

## App

```bash
cp .env.example .env    # set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm install
npx expo start          # scan the QR code with Expo Go; if it reports a missing native module, use a development build
npm run typecheck && npm run lint && npm test
```

The app has no local puzzle engine: every move goes through the `submit_action` RPC, and the client only renders what the server returns. The tutorial needs the backend deployed and `supabase/seed.sql` applied.

## Backend

```bash
scripts/test-db.sh                                           # schema + security tests (PostgreSQL 16+ server binaries)
(cd supabase/functions && deno check */index.ts && deno test --allow-read)   # Edge Functions + generation pipeline
npx supabase link --project-ref <ref> && npx supabase db push
```

### Try generation on your own photos

Run the real room generator on photos from your computer and play the result in a browser, with nothing deployed:

```bash
# once: put your Gemini key in supabase/functions/.env (gitignored)
#   AI_PROVIDER_API_KEY=...
deno run -A --env-file=supabase/functions/.env scripts/try-room.ts photo1.jpg photo2.jpg photo3.jpg photo4.jpg
deno run -A --env-file=supabase/functions/.env scripts/try-room.ts --serve photo1.jpg ...   # also serve it to your phone (same Wi-Fi)
deno run -A scripts/try-room.ts --stub photo1.jpg photo2.jpg photo3.jpg                     # no key, no model calls: checks the script itself
```

- Give 3 to 6 JPEG or PNG photos in the order you'd take them in the app. iPhone HEIC photos must be exported as JPEG first (or set Settings > Camera > Formats > Most Compatible).
- Each photo is processed exactly like an app upload (orientation applied, long edge 1600 px, JPEG 0.8, location and camera metadata dropped), then sent to Gemini. Nothing is uploaded to Supabase and nothing else leaves your computer.
- Output goes to `F:\escapd-tools\trials\<timestamp>\` on Windows (`~/escapd-trials/` elsewhere; change with `--out`): `play.html` (playable offline: hints, a solution walkthrough, generation details), `sheet.html` (hotspot boxes over each photo), the processed photos, `public.json`, `solution.json`, `usage.json` and `stages.log`. Keep trials out of the repo; never commit customer photos.
- `--serve-dir <trial folder>` serves an earlier trial again. The preview runs a local copy of the engine (`scripts/trial/engine.js`, mirrored from `submit_action`/`use_hint`); the app itself has no local engine.
- Tests: `deno test -A --config scripts/deno.json scripts/trial/`
