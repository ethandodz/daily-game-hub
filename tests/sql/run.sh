#!/usr/bin/env bash
# Applies the Servers SQL (supabase/servers) to a throwaway Postgres
# database that mimics Supabase (roles, auth.uid(), and the existing
# production tables and policies), then runs the security checks.
# Needs psql and a Postgres server; connection from PGHOST/PGUSER/etc.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
db="dgh_test_$$"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

psql -v ON_ERROR_STOP=1 -q -d postgres -c "create database $db"
trap 'psql -q -d postgres -c "drop database if exists $db" >/dev/null' EXIT

psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$here/stand-in.sql"
for pass in 1 2; do   # every file must be safe to run twice
  for file in "$root"/supabase/servers/0*.sql; do
    psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$file" >/dev/null
  done
done

psql -q -d "$db" -f "$here/server-tests.sql" >/dev/null
psql -At -d "$db" -c "select (case when ok then 'PASS ' else 'FAIL ' end) || label || case when ok then '' else '  -- ' || detail end from public.test_results order by n"
failed=$(psql -At -d "$db" -c "select count(*) from public.test_results where not ok")
total=$(psql -At -d "$db" -c "select count(*) from public.test_results")
echo "$total database checks, $failed failed"
[ "$failed" = "0" ] && [ "$total" -gt 0 ]
