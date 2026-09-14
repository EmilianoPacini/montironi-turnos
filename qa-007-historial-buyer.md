# QA DDL 007 — historial + buyer (PR #9)

**Fecha:** 2026-09-11  
**SHA:** `2d0ac02` (`merge DDL 007 historial+buyer onto main (#9)`)  
**Veredicto:** **PASS** — 5/5

| Caso | Resultado |
|------|-----------|
| Finalize turno proyecta `historial_servicio` (1 fila por detalle, km snapshot, upsert idempotente) | PASS |
| `GET /api/agents/context` incluye `historial_services` + `buyer_profile` / `perfilBuyer` | PASS |
| `getClienteContext` expone `_context.historial_services` | PASS |
| Clasificar buyer (v1 + agents) | PASS |
| Backfill historial idempotente | PASS |

Migración `20260911200700_historial_y_buyer` aplicada.  
Log: `/tmp/qa-007-historial-buyer.log`
