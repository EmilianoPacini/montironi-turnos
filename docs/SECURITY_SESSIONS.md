# Server-side sessions (B1 + B2)

## Model

- **Cookie** (`montironi_session`): iron-session, HttpOnly, encrypted payload contains **only** `{ sessionId }` (opaque UUID).
- **DB** (`sesion`): source of truth for validity, tenancy (`empresaId`), and user state.

| Field | Purpose |
|-------|---------|
| `id` | Opaque session id (stored in cookie) |
| `usuarioId` | Owner — indexed for bulk revocation |
| `empresaId` | Tenancy scope |
| `createdAt` | Audit |
| `lastSeenAt` | Sliding idle window |
| `expiresAt` | Absolute TTL (12h from creation) |
| `revokedAt` | Set on logout or security events |
| `userAgent`, `ip` | Optional client metadata |

## Lifetimes

| Rule | Value |
|------|-------|
| Absolute TTL | 12 hours from `createdAt` / `expiresAt` |
| Idle timeout | 45 minutes since `lastSeenAt` (sliding; updated on each authenticated request) |

On read, expired or idle sessions return **401** and the row is revoked (`revokedAt` set).

## Authorization

`requireSession` / `getAuthSession`:

1. Read `sessionId` from cookie.
2. Load `sesion` + `usuario` from DB.
3. Require `revokedAt IS NULL`, `now < expiresAt`, idle OK, `usuario.activo = true`.
4. **`rol` always from `usuario` in DB** — never from cookie.

## Revocation triggers

| Event | Action |
|-------|--------|
| Logout | Revoke current session + destroy cookie |
| `usuario.activo = false` | `revokeSessionsOnUserDeactivated(usuarioId)` |
| Password change | `revokeSessionsOnPasswordChange(usuarioId)` |
| Role change | `revokeSessionsOnRoleChange(usuarioId)` |

Helpers live in `src/lib/auth/session/revoke-session.use-case.ts`.

## API key flows (unchanged)

`/api/agents` and cron `POST /api/v1/jobs/vencer-pendientes` with `x-api-key` do **not** use cookie sessions.

## Maintenance

```bash
npx tsx scripts/cleanup-expired-sessions.ts
```

Deletes session rows expired or revoked more than 12h ago.

## NFR (AppSec)

| Requirement | Implementation |
|-------------|----------------|
| Indexes | `usuario_id` (mass revoke), `expires_at` (cleanup cron) |
| Cookie flags | `httpOnly`, `secure` in production, `sameSite: lax` |
| Anti-fixation | Login revokes prior cookie session, clears cookie, **always** inserts new `sesion` row |
| Tenancy | `sesion.empresaId` must match `usuario.empresaId`; resolved `empresaId` returned from `usuario` |
| Logging | Never log `sessionId` in plaintext (counts/metadata only) |

## Key modules

```
src/lib/auth/session/
  constants.ts
  repository.ts
  create-session.use-case.ts
  validate-session.use-case.ts
  revoke-session.use-case.ts
  cookie.ts
```
