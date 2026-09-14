# QA SOLID slice1 — appointments extract

**Fecha:** 2026-09-11 20:24 ART  
**SHA:** `33ce2b3` (`refactor(appointments): extract use cases from service god module`)  
**Veredicto:** **PASS — no bloquear merge**  
**Contratos:** sin regresión vs main `2d0ac02`

## Verde (slice)

| Área | Resultado |
|------|-----------|
| Crear + hold ocupación | PASS |
| Confirmar (mantiene hold) | PASS |
| Reprogramar atómico + conflicto | PASS |
| Cancelar libera ocupación | PASS |
| Transicionar / finalizado libera | PASS |
| Anti-solape concurrente (create/confirm/reschedule) | PASS |
| Bloqueos bahía EXCLUDE | PASS |
| Agents `upsert_cliente` 422 | PASS |
| Finalize → historial 007 | PASS |
| V1.1 cancel/finalizado/movimientos | PASS |

28 PASS en el paquete pedido.

## Residual (NO es del extract)

4 FAIL iguales en **main `2d0ac02`** y en `33ce2b3`:

- `fsm` expirePendingTurnos / confirmado pasado
- `occupation` vencido automático libera
- `domain-bugs` confirmar pendiente con inicio pasado

Causa: tests siembran `now - 30..120 min` y `assertWithinSchedule` (ya existía en main) los rechaza después de las 20:00 ART / en UTC. Flake de reloj, no de slice1.

WAH no tocado.
