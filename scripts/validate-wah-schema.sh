#!/usr/bin/env bash
# Structural WAH schema validation (independent of Datos 005 checksum)
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "FAIL: DATABASE_URL not set"
  exit 1
fi

CONN=$(node -e "
const u = new URL(process.env.DATABASE_URL);
console.log('postgresql://' + u.username + ':' + u.password + '@' + u.host + u.pathname);
")

run() {
  psql "$CONN" -tAc "$1"
}

fail=0

if [[ $(run "SELECT count(*) FROM information_schema.columns WHERE table_name='whatsapp_accounts' AND column_name='user_id'") != "1" ]]; then
  echo "FAIL: whatsapp_accounts.user_id missing"
  fail=1
fi

if [[ $(run "SELECT count(*) FROM pg_indexes WHERE tablename='whatsapp_accounts' AND indexname='whatsapp_accounts_user_id_uidx'") != "1" ]]; then
  echo "FAIL: whatsapp_accounts_user_id_uidx missing"
  fail=1
fi

if [[ $(run "SELECT count(*) FROM information_schema.columns WHERE table_name='wah_conversations' AND column_name='user_id'") != "0" ]]; then
  echo "FAIL: wah_conversations must not have user_id"
  fail=1
fi

if [[ $(run "SELECT is_nullable FROM information_schema.columns WHERE table_name='wah_media' AND column_name='message_id'") != "NO" ]]; then
  echo "FAIL: wah_media.message_id must be NOT NULL"
  fail=1
fi

if [[ $(run "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='wah_media_message_id_fkey'") != *"ON DELETE CASCADE"* ]]; then
  echo "FAIL: wah_media.message_id must ON DELETE CASCADE"
  fail=1
fi

if [[ $(run "SELECT count(*) FROM information_schema.columns WHERE table_name='wah_messages' AND column_name='media_id'") != "0" ]]; then
  echo "FAIL: wah_messages must not have media_id"
  fail=1
fi

if [[ $fail -eq 1 ]]; then
  exit 1
fi

echo "PASS: WAH schema structure OK"
