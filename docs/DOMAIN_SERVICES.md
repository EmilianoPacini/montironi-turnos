# Servicios de dominio — Montironi Turnos V1

> Consumidores IA: contrato HTTP y playbooks en [`AGENT_CONSUMER_GUIDE.md`](./AGENT_CONSUMER_GUIDE.md).  
> Esta página describe dominio interno. Donde diverja (p.ej. HTTP de `BloqueoInvalido`, snapshots al crear vs al confirmar, lista incompleta de rutas v1), gana el código + la guía de agentes.

Alineado a: `prisma/migrations/20260911152000_authoritative_init/migration.sql`, backlog P0 (MT-P0-01…06), decisiones de producto cerradas.

Stack: monolito Next.js modular. Tenancy: todo filtrado por `empresa_id` del actor.

---

## Principios

1. **Fuente de verdad de capacidad:** `ocupacion_bahia` (`activo=true`), no el estado del turno solo.
2. **Tipos de ocupación:** `tipo_ocupacion = turno | bloqueo` (CHECK con `turno_id` / `motivo`).
3. **Consulta ≠ reserva.** El GET de disponibilidad/agenda **no escribe** `ocupacion_bahia`. La reserva (hold) ocurre en el POST de creación de turno pendiente (y en bloqueos). Mutaciones revalidan capacidad en la misma transacción (confirmar si cambia bahía/periodo, reprogramar, bloquear).
4. **Anti-solape:** constraint EXCLUDE gist; conflictos de carrera → error tipado `CapacidadConflicto` (HTTP 409).
5. **Optimistic locking:** `turno.version` en toda mutación de turno.
6. **Idempotencia:** mutaciones con `Idempotency-Key` → `operacion_api` UNIQUE(`empresa_id`, `idempotency_key`).
7. **Snapshots:** `detalle_turno.*_snapshot` se congelan al confirmar; no se reescriben por catálogo en reprogramación.
8. **Eventos:** `evento_turno` append-only en cada transición.
9. **Calendario ≠ turno:** `estado_calendario` solo en franjas/excepciones; no confundir con `tipo=bloqueo` en ocupación.
10. **Hold en pendiente (override Producto / Emi):** crear turno `pendiente` **sí** inserta `ocupacion_bahia` activa (`tipo=turno`). Se **mantiene** al confirmar; se **libera** (`activo=false`) al cancelar, ausente o vencer.

## Capas

```
src/app/api/v1/...                         # HTTP + authz + idempotency
src/lib/modules/agenda/application/        # casos de uso
src/lib/modules/agenda/domain/             # errores, políticas, invariantes
src/lib/modules/agenda/infrastructure/     # repos PostgreSQL (Prisma)
```

Repos: TurnoRepository, OcupacionRepository, CalendarioRepository, OperacionApiRepository.

## Errores tipados

| Código | HTTP |
|--------|------|
| CapacidadConflicto | 409 |
| BahiaIncompatible | 409 |
| FueraDeHorario | 409 |
| VersionConflicto | 409 |
| TransicionInvalida | 422 |
| TurnoNoReprogramable | 422 |
| BloqueoInvalido | 422 |
| RecursoNoEncontrado | 404 |
| IdempotencyReplay | 200 (replay) |

## Casos de uso

### ConsultarAgendaDia / ConsultarDisponibilidad
Solo lectura. No escriben `ocupacion_bahia`.

### CrearTurnoPendiente
Tx: validar → calcular `finaliza_en` → resolver bahía → insert turno pendiente + detalle → **insert ocupacion hold** → evento.

### ConfirmarTurno
Mantiene ocupación si bahía/periodo iguales; swap atómico si cambian. Congela snapshots. `version++`. **No libera** al confirmar.
Rechaza pendientes con `inicio` en el pasado (misma regla que VencerPendientes): aplica `vencido`, libera hold, `TransicionInvalida`.

### TransicionarEstadoTurno
Cancelar/ausente/vencido/finalizado: `ocupacion.activo=false`. `en_servicio → cancelado` permitido (cancelación excepcional).

### ReprogramarTurno
Swap atómico; conflicto deja original intacto.

### CrearBloqueoBahia / LiberarBloqueoBahia
`tipo=bloqueo`, `turno_id` NULL, `motivo` obligatorio.

### VencerPendientes (job obligatorio)
`POST /api/v1/jobs/vencer-pendientes` — ejecuta `expirePendingTurnos` sin depender de GET `/agenda` ni render del panel. Auth: `x-api-key` (= `AGENT_API_KEY`) + opcional `x-empresa`, o sesión admin.

## API v1

| Método | Ruta |
|--------|------|
| GET | `/api/v1/talleres/{tallerId}/agenda?fecha=` |
| GET | `/api/v1/talleres/{tallerId}/disponibilidad?servicioId=&fecha=` |
| POST | `/api/v1/turnos` |
| POST | `/api/v1/turnos/{id}/confirmar` |
| POST | `/api/v1/turnos/{id}/transiciones` |
| POST | `/api/v1/turnos/{id}/reprogramar` |
| POST | `/api/v1/turnos/{id}/cancelar` |
| POST | `/api/v1/bahias/{bahiaId}/bloqueos` |
| DELETE | `/api/v1/bloqueos/{ocupacionId}` |
| POST | `/api/v1/jobs/vencer-pendientes` (cron: `x-api-key` o sesión admin) |

Headers mutadores: cookie de sesión (panel), `Idempotency-Key`, body/header `version` en mutaciones de turno.

**POST `/api/v1/turnos/{id}/transiciones`** — body JSON:
- `estado` (canónico): destino FSM, ej. `"recibido"`, `"finalizado"`
- `nuevoEstado` (alias legacy, opcional si viene `estado`)
- `version` (requerido) o header `If-Match` / `x-turno-version`
- `detalle` (opcional)

## Orden de implementación

1. Migraciones 001 (+ patch bloqueos)
2. Repos + operacion_api
3. GETs lectura
4. Bloqueos
5. CrearTurnoPendiente con hold
6. ConfirmarTurno
7. Cancelar + transiciones
8. Reprogramar
9. Job VencerPendientes

## Invariantes (tests)

Ver `tests/unit/occupation.test.ts`, `tests/integration/*.test.ts` y comentarios en `domain/invariants.ts`.
