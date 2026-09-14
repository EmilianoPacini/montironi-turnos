# B3 — Aislamiento multi-tenant (IDOR)

Historia AppSec **B3**: cerrar IDORs en mutaciones de dominio sin RLS completo.

## Regla

Toda mutación `find`/`update`/`upsert` usa scope `{ id, empresaId }` (o equivalente vía join). Si el recurso no pertenece al tenant del actor → `DomainError` `RecursoNoEncontrado` (HTTP 404). Nunca mutar cross-tenant.

## Alcance B3

| Servicio | Fix |
|----------|-----|
| `upsertCliente` | `updateMany` con `{ id, empresaId }` |
| `createTurno` | Valida `clienteId`, `vehiculoId`, `tallerId` y vínculo cliente↔vehículo en `empresaId` |
| `updateConfiguracionTaller` | Requiere `empresaId`; verifica `taller.empresaId` antes del upsert |
| `createServicio` | Verifica `tipoServicioId` en la misma empresa |

## Tests

`tests/integration/tenant-isolation.test.ts` — fixture de 2 empresas cubre los 4 casos (incl. `POST /api/agents` `upsert_cliente`).

## Fuera de alcance

RLS a nivel PostgreSQL, historias B4–B8.
