#!/usr/bin/env bash
# Datos 006 validation — hotfix for legacy condicion column name
set -euo pipefail

FILE="${1:-montironi-turnos-v1/006_fix_intervalo_condicion.sql}"
EXPECTED_MD5="9cecaf43d8145ca46029a1d5f1d37d83"

if [[ ! -f "$FILE" ]]; then
  echo "FAIL: missing $FILE (awaiting Datos republish to shared box)"
  exit 1
fi

ACTUAL_MD5=$(md5sum "$FILE" | awk '{print $1}')
if [[ "$ACTUAL_MD5" != "$EXPECTED_MD5" ]]; then
  echo "FAIL: md5 mismatch"
  echo "  expected: $EXPECTED_MD5"
  echo "  actual:   $ACTUAL_MD5"
  exit 1
fi

echo "PASS: Datos 006 checksum OK ($FILE)"
