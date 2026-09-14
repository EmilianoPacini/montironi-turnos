# QA B3 — aislamiento multi-tenant (IDOR)

**Fecha:** 2026-09-11  
**Merge PR #6:** `7a76ece` (`cursor/multi-tenant-isolation-b3-01f5`)  
**Tip smoke:** `0911de8` (incluye B3)  
**Veredicto:** **PASS**

## Casos Matias

| # | Caso | Resultado |
|---|------|-----------|
| 1 | Empresa B `upsertCliente` id A | RecursoNoEncontrado; fila A intacta |
| 2 | `POST /api/agents` upsert_cliente `x-empresa` B + id A | **404** + code RecursoNoEncontrado |
| 3 | `createTurno` B con taller/cliente/vehículo A | rechazo; 0 inserts |
| 4 | Empresa B + taller B + cliente/vehículo A | rechazo; 0 inserts (extra QA) |
| 5 | `updateConfiguracionTaller` B sobre taller A | rechazo; margen intacto |
| 6 | `createServicio` B con `tipoServicioId` A | rechazo; sin fila cruzada |
| 7 | Happy path mismo tenant | upsert + config + servicio + turno OK (extra QA) |

Suite repo `tenant-isolation.test.ts`: **5/5 PASS**  
Extras 4+7: **2/2 PASS**

Log: `/tmp/qa-b3-vitest-extra.log`

Fuera de scope: RLS Postgres, B4–B7.
