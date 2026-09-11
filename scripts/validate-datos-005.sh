#!/usr/bin/env bash
# Datos 005 validation — must pass before merge to main
set -euo pipefail

FILE="${1:-montironi-turnos-v1/005_comunicaciones_wah.sql}"
EXPECTED_MD5="6f528869649dbbb4a4ef1782e6ee18b5"

if [[ ! -f "$FILE" ]]; then
  echo "FAIL: missing $FILE"
  exit 1
fi

ACTUAL_MD5=$(md5sum "$FILE" | awk '{print $1}')
if [[ "$ACTUAL_MD5" != "$EXPECTED_MD5" ]]; then
  echo "FAIL: md5 mismatch"
  echo "  expected: $EXPECTED_MD5"
  echo "  actual:   $ACTUAL_MD5"
  exit 1
fi

if ! grep -q "★ FUENTE OFICIAL" "$FILE"; then
  echo "FAIL: missing header marker ★ FUENTE OFICIAL"
  exit 1
fi

echo "PASS: Datos 005 checksum and header OK ($FILE)"
