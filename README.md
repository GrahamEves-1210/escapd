# Escapd

Photograph your room and AI turns it into a playable escape room.

This repository currently contains the **backend foundation** (Supabase/Postgres). The Expo app goes here next.

```
supabase/
  config.toml           # Supabase CLI config (anonymous sign-ins, manual linking, functions)
  migrations/           # schema, RLS, storage policies, RPCs (apply with `supabase db push`)
  seed.sql              # the guided tutorial room
  functions/            # Edge Functions: revenuecat-webhook, delete-account, merge-guest,
                        #                 generation-worker (AI stub), storage-janitor
  tests/                # database permission/behavior tests
scripts/
  test-db.sh            # run migrations + tests on a throwaway Postgres
  schedule-jobs.sql     # pg_cron schedules for the hosted project
src/lib/                # Expo client: supabase client, typed API helpers, puzzle types
docs/BACKEND.md         # architecture, tables, setup checklist, decisions
.env.example            # environment variable template (no secrets)
```

Start with **[docs/BACKEND.md](docs/BACKEND.md)**.

## Quick start

```bash
scripts/test-db.sh                # verify schema + security locally (needs PostgreSQL 16+ server binaries)
npx supabase link --project-ref <ref> && npx supabase db push
```

When creating the Expo app, keep `src/lib/` and install the client packages listed at the top of `src/lib/supabase.ts`.
