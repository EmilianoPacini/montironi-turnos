# Montironi Turnos de postventa

Agenda compartida de turnos para concesionaria/taller. Empleados (panel web) y agentes IA (API) comparten las mismas reglas de negocio y la misma fuente de verdad de capacidad: `ocupacion_bahia`.

## Requisitos

- Node.js 20+
- Docker y Docker Compose (para PostgreSQL)
- npm

## Puesta en marcha

### 1. Base de datos

```bash
docker compose up -d
```

PostgreSQL queda disponible en `localhost:5433` con usuario/contraseña/base `montironi`.

### 2. Variables de entorno

Copiá `.env.example` a `.env` y ajustá si hace falta:

```bash
cp .env.example .env
```

### 3. Migraciones y seed

```bash
npm install
npm run db:setup
```

Esto aplica migraciones (incluye constraint de exclusión en `ocupacion_bahia`) y carga datos de prueba.

### 4. Servidor de desarrollo

```bash
npm run dev
```

Abrí [http://localhost:43123](http://localhost:43123)

## Usuarios de prueba

| Rol       | Email                    | Contraseña   |
|-----------|--------------------------|--------------|
| Admin     | admin@montironi.com      | admin123     |
| Empleado  | empleado@montironi.com   | empleado123  |

V1 del panel usa solo roles `admin` y `empleado` (el enum incluye también `operador` y `asesor`).

## Scripts útiles

| Comando           | Descripción                          |
|-------------------|--------------------------------------|
| `npm run dev`     | App Next.js en puerto 43123          |
| `npm run db:setup`| Migrar + seed                        |
| `npm run test`    | Tests de disponibilidad/exclusión    |
| `npm run build`   | Build de producción                  |

## Arquitectura

Monolito modular en Next.js App Router:

- `src/lib/modules/auth` — sesión email/contraseña (iron-session)
- `src/lib/modules/catalog` — servicios, talleres, configuración
- `src/lib/modules/availability` — cálculo de disponibilidad (sin store de slots libres)
- `src/lib/modules/agenda` — dominio/aplicación/infra (casos de uso + repos)
- `src/lib/modules/appointments` — implementación de turnos (delegada desde agenda)
- `src/lib/modules/customers` — clientes y vehículos
- `src/lib/modules/agents-api` — idempotencia y autenticación por API key

### Esquema PostgreSQL (autoritativo)

Migración única: `prisma/migrations/20260911152000_authoritative_init/migration.sql`

- Extensiones: `pgcrypto`, `btree_gist`
- 21 tablas con PKs UUID (`gen_random_uuid()`)
- Enums: `estado_turno`, `canal_turno`, `rol_usuario`, `tipo_ocupacion`, etc.
- `turno.finaliza_en` = suma de duraciones en `detalle_turno` + `configuracion_turnos.margen_minutos`
- `turno.version` para optimistic locking; `operacion_api` UNIQUE `(empresa_id, idempotency_key)`
- `ocupacion_bahia`: `periodo tstzrange` + `EXCLUDE USING gist (bahia_id WITH =, periodo WITH &&) WHERE (activo)`
- Bloqueos manuales: `tipo='bloqueo'`, `turno_id` NULL, `motivo` obligatorio, `creado_por_usuario_id` opcional (sin turno ficticio)
- Turnos pendientes reservan capacidad: `ocupacion_bahia` activa `tipo=turno` al crear; se libera en cancel/vencido; se mantiene al confirmar
- Errores de dominio tipados: `CapacidadConflicto`, `TransicionInvalida`, `VersionConflicto`, `BahiaIncompatible`, `FueraDeHorario`, `BloqueoInvalido`, `TurnoNoReprogramable`, `RecursoNoEncontrado`, `IdempotencyReplay`

Para resetear desde cero: `npx prisma migrate reset --force`

### Capacidad

Un turno ocupa una bahía desde `inicio` hasta `finaliza_en` (calculado como arriba). **Hold en pendiente:** crear turno pendiente inserta `ocupacion_bahia` activa; confirmar mantiene; cancelar/vencer libera.

Ver contrato completo en [`docs/DOMAIN_SERVICES.md`](docs/DOMAIN_SERVICES.md).

- Consultar disponibilidad **no reserva**
- Al confirmar/crear se revalida y se inserta en `ocupacion_bahia`
- PostgreSQL `EXCLUDE` evita solapamientos activos por bahía
- **Bahía:** si hay exactamente una bahía compatible y libre, se asigna sola; si hay varias, hay que elegir
- Reprogramación con conflicto mantiene el slot anterior
- Optimistic locking vía `turno.version`
- **Estados:** única transición automática `pendiente → vencido` al pasar la hora de inicio sin confirmar; `ausente`, `recibido`, `en_servicio` y `finalizado` son siempre manuales (no hay auto-ausente)
- **Precios:** modos `fijo`, `desde`, `a_presupuestar` (informativos en V1); se snapshotean en `detalle_turno` al reservar

## API para agentes

`POST /api/agents` y `GET /api/agents`

Headers:

- `x-api-key`: valor de `AGENT_API_KEY`
- `x-empresa`: slug de empresa (default `montironi`)
- `idempotency-key`: opcional, para operaciones idempotentes (persistido en `operacion_api.idempotency_key`)

El body acepta `canal` (`web`, `telefono`, `whatsapp`, `interno`, `agente_ia`); `origen` se mapea por compatibilidad.

Acciones POST (`action` en body):

- `crear_turno`, `cancelar_turno`, `reprogramar_turno`
- `upsert_cliente`, `upsert_vehiculo`

GET `?resource=servicios|disponibilidad|turno`

## API v1 (dominio agenda)

Sesión de panel (cookie). Mutaciones aceptan `Idempotency-Key` y `x-turno-version` / `If-Match`.

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

Capas: `src/lib/modules/agenda/{domain,application,infrastructure}` — ver `docs/DOMAIN_SERVICES.md`.

## Tests

```bash
npm run test              # suite completa (unit + integration)
npm run test:unit         # ocupación, FSM, authz
npm run test:integration  # concurrencia, reprogramación, bloqueos
```

Verifica detección de conflictos, exclusión en DB, hold de capacidad en pendientes, FSM y authz admin/empleado.

## Pantallas incluidas (V1)

- Login
- Agenda diaria por bahía (grilla + lista) con filtros
- Detalle de turno y transiciones de estado
- Crear turno, reprogramar, cancelar, bloquear bahía
- Clientes (listado, detalle, alta/edición, vehículos)
- Catálogo de servicios (admin)
- Configuración básica (admin)
