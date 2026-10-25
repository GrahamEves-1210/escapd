#!/usr/bin/env bash
# Runs all migrations + seed + database tests.
#
#   Plain Postgres (no Docker):  scripts/test-db.sh
#     Starts a throwaway PostgreSQL cluster, loads scripts/supabase-stubs.sql,
#     then the migrations, seed, and supabase/tests/*.sql.
#     Server binaries default to the newest /usr/lib/postgresql/*/bin; set
#     PGBIN=/path/to/postgres/bin to use another install (psql comes from PATH).
#
#   Against local Supabase:      DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres scripts/test-db.sh
#     (after `supabase db reset`; skips stubs/migrations, runs tests only)
#
# Never point DATABASE_URL at a production database: tests create users.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PSQL_OPTS=(-v ON_ERROR_STOP=1 -X -q)

run_tests() {
  local url="$1"
  for t in "$ROOT"/supabase/tests/*.sql; do
    echo "--> $(basename "$t")"
    psql "$url" "${PSQL_OPTS[@]}" -f "$t"
  done
}

if [[ -n "${DATABASE_URL:-}" ]]; then
  run_tests "$DATABASE_URL"
  exit 0
fi

# PGBIN overrides where the server binaries live (e.g. a portable install).
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[[ -x "$PGBIN/initdb" ]] || { echo "PostgreSQL server binaries not found"; exit 1; }
WORK="$(mktemp -d)"
trap '"$PGBIN/pg_ctl" -D "$WORK/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
PORT="${PGPORT_TEST:-55432}"

if [[ "$(id -u)" == "0" ]]; then
  chown -R postgres "$WORK"
  RUN=(su postgres -c)
else
  RUN=(bash -c)
fi
"${RUN[@]}" "'$PGBIN/initdb' -D '$WORK/data' -U postgres -A trust >/dev/null"
"${RUN[@]}" "'$PGBIN/pg_ctl' -D '$WORK/data' -o '-p $PORT -k $WORK -c listen_addresses=' -l '$WORK/log' start -w >/dev/null"
URL="postgresql://postgres@/postgres?host=$WORK&port=$PORT"

echo "--> supabase-stubs.sql"
psql "$URL" "${PSQL_OPTS[@]}" -f "$ROOT/scripts/supabase-stubs.sql"
for m in "$ROOT"/supabase/migrations/*.sql; do
  echo "--> $(basename "$m")"
  psql "$URL" "${PSQL_OPTS[@]}" -f "$m"
done
echo "--> seed.sql"
psql "$URL" "${PSQL_OPTS[@]}" -f "$ROOT/supabase/seed.sql"
run_tests "$URL"
echo "ALL DATABASE TESTS PASSED"
