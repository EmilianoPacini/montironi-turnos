# QA abuso sesiones — post-merge PR #5

**Fecha:** 2026-09-11  
**Merge PR #5:** `3d9c977`  
**Main tip smoke:** `abdc61d` (ancestro `3d9c977` ✓; también incluye B3)  
**Veredicto:** **PASS**

## Pedido Emi PO

| Caso | Integration | E2E HTTP |
|------|-------------|----------|
| Deactivate mid-session | PASS 401 | PASS 401 |
| Demote admin→empleado | PASS 403 | PASS 403 |
| Logout replay cookie | PASS 401 | PASS 401 |
| Idle > 45 min | PASS 401 + revoke | PASS 401 + `revoked_at` |
| Absolute TTL | PASS 401 | PASS 401 |

Extras (mismo run): cookie vacía/inventada/basura 401; tenancy mismatch 401+revoke; `x-api-key` sin cookie 200.

- Vitest `session.test.ts`: **9/9** (`/tmp/qa-pr5-merge-vitest2.log`)
- E2E live `:43123`: **12/12** (`/tmp/qa-pr5-merge-e2e.log`)
