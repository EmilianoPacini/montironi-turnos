#!/usr/bin/env bash
# QA: single clean migration line — no overlapping WAH lineages
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

CONN=$(node -e "
const u = new URL(process.env.DATABASE_URL);
console.log('postgresql://' + u.username + ':' + u.password + '@' + u.host + u.pathname);
")

MIGRATIONS=$(psql "$CONN" -tAc "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at")
COUNT=$(echo "$MIGRATIONS" | grep -c . || true)

echo "Applied migrations ($COUNT):"
echo "$MIGRATIONS"

BAD=$(echo "$MIGRATIONS" | grep -E '71000|180000|181000|80000|81000' || true)
if [[ -n "$BAD" ]]; then
  echo "FAIL: overlapping WAH lineages detected:"
  echo "$BAD"
  exit 1
fi

WAH=$(echo "$MIGRATIONS" | grep -c 'wah_comunicaciones' || true)
if [[ "$WAH" != "1" ]]; then
  echo "FAIL: expected exactly 1 WAH migration, found $WAH"
  exit 1
fi

if [[ "$COUNT" != "3" ]]; then
  echo "FAIL: expected 3 migrations on fresh branch, found $COUNT"
  exit 1
fi

echo "PASS: clean migration line (152→170→182)"
