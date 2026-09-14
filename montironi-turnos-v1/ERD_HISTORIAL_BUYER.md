# ERD — Historial de services + buyer profile (007)

## Decisión clave

| Opción | Veredicto |
|--------|-----------|
| Solo query sobre `turno`/`detalle_turno` | ❌ Bot WSP necesita denormalizar (nombres, km, tipo) y latencia estable |
| Vista materializada | ⚠️ Refresh/concurrencia feos en Postgres + Prisma |
| **Tabla proyección `historial_servicio`** | ✅ Insert al `finalizado`; UNIQUE `detalle_turno_id` evita dupes; índices listos |

**Fuente de verdad del hecho:** `turno` + `detalle_turno` (estado `finalizado`).  
**Fuente de lectura operativa (bot/panel):** `historial_servicio`.

## Cardinalidades

```
cliente 1 ─── N historial_servicio
vehiculo 1 ─── N historial_servicio
turno 1 ─── N historial_servicio          (1 por cada detalle)
detalle_turno 1 ─── 0..1 historial_servicio  (UNIQUE detalle_turno_id)

cliente 1 ─── 0..1 cliente_perfil_buyer
cliente 1 ─── N cliente_clasificacion_evento
wah_conversations 0..1 ── N perfil / eventos (opcional)
```

## Índices bot

1. `cliente (empresa_id, telefono) WHERE deleted_at IS NULL`
2. `historial_servicio (empresa_id, cliente_id, realizado_en DESC)`
3. `historial_servicio (empresa_id, vehiculo_id, realizado_en DESC)`

## Buyer MVP

- `cliente_perfil_buyer`: tags[], intencion_predominante, score_reclamos, ultima_clasificacion, wah_conversation_id
- `cliente_clasificacion_evento`: append-only para auditar cambios del bot/humano

Misma verdad para empleado (panel) y agente IA (tools).
