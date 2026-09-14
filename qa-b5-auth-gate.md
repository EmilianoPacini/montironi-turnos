# QA B5 — auth gate (PR #8)

**Fecha:** 2026-09-11  
**Pedido SHA:** `387d940`  
**Smoke HEAD:** `9bfe8ad` (incluye `387d940`)  
**Veredicto:** **PASS** — 26/26

| # | Caso | Resultado |
|---|------|-----------|
| 1 | Sin cookie `/agenda` | 307 → `/login` |
| 2 | Sin cookie `/api/v1/clientes/context` | **401** |
| 3 | Empleado POST bahía admin | **403** |
| 4 | Admin mismo | **201** |
| 5 | `/api/agents` sin cookie + API key | **200** |
| 6 | WAH integration: Edge pasa; sin secret 401; con secret ≠ 401 sesión | PASS |
| 7 | Path panel inventado sin cookie | 307 login |
| 8a | Jobs sin cookie + API key | **200** |
| 8b | Jobs sin cookie ni key | **401** |
| 9 | X-Frame-Options DENY, nosniff, Referrer-Policy | PASS |
| 10 | operador/asesor deny matriz | PASS |

Suites: `middleware-auth-gate.test.ts` + `access.test.ts` + `auth-gate.test.ts`  
Log: `/tmp/qa-b5-vitest.log`

B4/B6/B7 fuera de slice.
