# Wah source reference — cima-ai compatible

Referencia del módulo WAH de cima-ai portado a Montironi Turnos.

## Documentación

- Plan: [`COMUNICACIONES_PLAN.md`](../../COMUNICACIONES_PLAN.md)
- Contrato API completo: [`docs/COMUNICACIONES_API.md`](../COMUNICACIONES_API.md)

## Estructura

| Referencia | Implementación |
|------------|----------------|
| `api-wah/routes.md` | `src/app/api/wah/**` |
| `lib-wah/integration-auth.ts` | `src/lib/modules/wah/integration-auth.ts` |
| `lib-wah/schemas.ts` | `src/lib/modules/wah/schemas.ts` |
| Componentes inbox | `src/components/wah/*` |

## Tenancy

Montironi usa **`empresa_id`** (UUID) en integración — no `tenant_id` de cima-ai.

## Auth integración

Header `X-Cima-Forward-Secret` = env `CIMA_FORWARD_SECRET` (timing-safe).
