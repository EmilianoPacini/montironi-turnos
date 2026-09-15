# Dominio — Historial de servicios + Buyer profile (DDL 007)

Fuente SQL: `montironi-turnos-v1/007_historial_y_buyer.sql`  
Migración Prisma: `20260911200700_historial_y_buyer`

## Tablas

| Tabla | Propósito |
|-------|-----------|
| `historial_servicio` | Snapshot por `detalle_turno` al finalizar turno. UNIQUE `detalle_turno_id`. |
| `cliente_perfil_buyer` | Perfil comercial/bot por cliente. UNIQUE `cliente_id`. FK opcional `wah_conversations`. |
| `cliente_clasificacion_evento` | Auditoría de clasificaciones (bot/humano/sistema/integracion). |

## Flujo turno finalizado

En la misma transacción que hoy (`finalizado` + km vehículo + liberar ocupación + movimiento):

`upsertHistorialDesdeTurnoFinalizado(turnoId, tx)` → INSERT por cada `detalle_turno`  
ON CONFLICT (`detalle_turno_id`) DO UPDATE snapshots.

Campos snapshot:
- `servicio_nombre`, `tipo_servicio_nombre`, `taller_nombre`
- `realizado_en` = timestamp de finalización
- `kilometraje_km` = `turno.kilometraje`
- `duracion_minutos`, `precio` desde detalle

## Backfill

```bash
npm run db:backfill-historial
# opcional: EMPRESA_ID=<uuid> npm run db:backfill-historial
```

Idempotente: omite turnos que ya tienen filas en `historial_servicio`.

## Clasificación buyer

`POST /api/agents` `{ "action": "clasificar_cliente", ... }` — **canónico para agentes** (ver `docs/AGENT_CONSUMER_GUIDE.md`).  
`POST /api/v1/clientes/:id/clasificaciones` — el handler acepta x-api-key o sesión, pero **Edge exige cookie** en `/api/v1/*` (salvo jobs). Un agente M2M no debe usar esta ruta.

Body:
```json
{
  "clasificacion": "vip",
  "intencion": "service",
  "tagsDelta": ["fiel"],
  "scoreReclamosDelta": 0,
  "wahConversationId": "uuid?",
  "wahMessageId": "uuid?",
  "fuente": "bot"
}
```

→ INSERT `cliente_clasificacion_evento` + UPSERT `cliente_perfil_buyer` (merge tags, score += delta).

## Índice cliente teléfono

Datos spec usa `deleted_at IS NULL`; Montironi mapea a `activo IS TRUE` (`ix_cliente_empresa_telefono`).
