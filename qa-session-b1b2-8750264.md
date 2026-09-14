# QA AppSec — sesiones B1+B2

**Fecha:** 2026-09-11  
**SHA:** `8750264` (`chore(auth): NFR hardening for B1+B2 sessions`)  
**Branch:** `cursor/server-side-sessions-b1-b2-c460`  
**Veredicto:** **PASS** — no reabrir a Martin

## Integration (`tests/integration/session.test.ts`)

**9/9 PASS** (vitest, env limpio; `env -u DATABASE_URL`).

Cubre: deactivate→401, demote→403, logout replay→401, idle→401+revoke, TTL→401, anti-fixation sintético, tenancy mismatch→401+revoke, empresaId desde usuario, `x-api-key` sin cookie→200.

## E2E HTTP live (`:43123`, cookie iron-session `{ sessionId }`)

**12/12 PASS** — log `/tmp/qa-session-e2e.log`

| # | Caso | Resultado |
|---|------|-----------|
| 1 | `activo=false` → panel API | 401 |
| 2 | `rol=empleado` → `POST /api/v1/jobs/vencer-pendientes` (solo cookie) | 403 |
| 3 | logout/revoke → replay cookie | 401 |
| 4 | `last_seen_at` > 45 min | 401 + `revoked_at` set |
| 5 | `expires_at` pasado | 401 |
| 6 | nuevo `sessionId`; previa revocada | 401 vieja / 404 nueva (auth OK) |
| 7 | `sesion.empresa_id` ≠ `usuario.empresa_id` | 401 + revoke |
| 8 | sin cookie / sessionId inventado / cookie basura | 401 (los 3) |
| 9 | `x-api-key` sin cookie | 200 `{vencidos:0}` |

Usuario de prueba creado y borrado (`qa-session-admin-*`). Admin seed no se tocó.

## Gaps (no bloquean)

- Login/logout **form** (server action) no se ejecutó en browser; E2E replica la secuencia de `loginAction` (revoke prior + nueva fila + cookie opaca) a nivel HTTP.
- Caso 8 no está en la suite vitest; sí en E2E.
- Folder local `_sec_b1_pr5_review/` rompe un `vitest run` amplio (import roto). Aislar con path canónico.
- 403 de demote responde `code: RecursoNoEncontrado` (status correcto).

B3–B7 (rate limit, IDOR, API keys por tenant) fuera de slice.
