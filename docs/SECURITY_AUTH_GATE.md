# Security — Central Auth Gate (B5)

Fail-closed authorization for Montironi panel and API routes. **Pages alone are not the defense**; every protected request passes through Edge cookie presence and Node session revalidation.

## Two layers

| Layer | Where | What it checks |
|-------|--------|----------------|
| **Edge gate** | `src/middleware.ts` | Session cookie **presence** only (`montironi_session`). No DB, no iron-session unseal. Adds security headers. |
| **Node gate** | Route handlers, server actions, panel layout | `requireSession` / `requireAdmin` (DB-backed `sesion`) + `assertPanelAccess` role matrix in `src/lib/auth/access.ts`. |

Edge answers: “Is there a session cookie?” Node answers: “Is the session valid, and does this role belong here?”

## Public paths (no cookie at Edge)

- `/`, `/login`
- `/api/agents` and `/api/agents/*` — API key validated in handler
- `/api/wah/integration/*` — `X-Cima-Forward-Secret` in handler
- `/api/webhooks/*` — forward secret in handler
- `/api/v1/jobs/*` — cron uses `x-api-key` **or** admin session inside handler (AppSec-approved exception). **Only** this prefix is machine-exempt at Edge; all other `/api/v1/*` routes still require a session cookie.
- Static assets (`/_next/*`, favicons, images)

**Everything else requires a session cookie at Edge** (fail-closed). New panel routes under `(panel)` are protected automatically without updating a path allow-list.

## Role matrix V1

Source of truth: `src/lib/auth/access.ts` (re-exported from `guards.ts` for legacy imports).

| Role | Panel access |
|------|----------------|
| **empleado** | `/agenda`, `/clientes`, `/turnos`, `/comunicaciones`, bloqueos de bahía |
| **admin** | empleado routes + `/servicios`, `/bahias`, `/configuracion`, `/movimientos`, `/usuarios` |

**Unknown roles** (`operador`, `asesor`, etc.) → **deny** (403), not treated as empleado.

### HTTP mapping

| Condition | UI | API |
|-----------|----|-----|
| No / invalid session | Redirect `/login` | `401` `{ error, code: "UNAUTHORIZED" }` |
| Valid session, insufficient role | Redirect `/agenda` (panel layout) | `403` `{ error }` |

## Security headers (P1-lite)

Set on all middleware responses:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Follow-up (B7)

Post-B5 cron jobs should use a **dedicated secret** (e.g. `CRON_API_KEY`) distinct from `AGENT_API_KEY`. Today `vencer-pendientes` reuses `AGENT_API_KEY` for backward compatibility; split in B7 to limit blast radius if one key leaks.

## Related docs

- B1+B2 sessions: `docs/SECURITY_SESSIONS.md`
- Tenant isolation: `docs/SECURITY_TENANT_ISOLATION.md`
