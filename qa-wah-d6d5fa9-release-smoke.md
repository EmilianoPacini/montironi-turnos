# QA WAH release smoke — tip `d6d5fa9`

**Fecha:** 2026-09-11  
**Branch tip:** `d6d5fa9` (`docs(datos): commit official 005/006/ERD (clone cima)`) on `cursor/comunicaciones-wah-6f3f`  
**Veredicto:** **PASS / HOLD liberable (GO)**  
**App:** `http://localhost:43123` · DB `localhost:5433/montironi_turnos`

## Datos gate

| Check | Result |
|-------|--------|
| `prisma migrate reset --force` | OK → seed OK |
| Migraciones aplicadas | exactamente 3: `152→170→182` |
| `whatsapp_accounts.user_id` | presente |
| `wah_media.message_id` FK | `CASCADE` (`confdeltype=c`) |
| Seed cuenta placeholder | `PLACEHOLDER_PHONE_NUMBER_ID` + 1 conv + 2 msgs |
| `servicio_intervalo_km.condicion` | columna `condicion` (no `condicion_vehiculo`) |
| `scripts/validate-datos-005.sh` | PASS |
| `scripts/validate-migration-line.sh` | PASS |
| `scripts/validate-datos-006.sh` | md5 expected `a06011fe…` vs actual `9cecaf43…` (Datos tip = source of truth; script stale) |

## Functional smoke (`scripts/qa-wah-clone-smoke.ts`)

**23/23 PASS** — UI Comunicaciones/Cima, accounts/conversations/messages/dashboard, send→`botPaused`, resume, integration 401 sin secret / 200 con `X-Cima-Forward-Secret`, sin token Meta hardcodeado.

Log: `/tmp/qa-wah-d6d-smoke.log`

## Nota operativa

Repo compartido: HEAD puede saltar (`2a385c0` visto durante la corrida). Smoke se forzó con `git checkout -f d6d5fa9` + server reiniciado en ese tip.
