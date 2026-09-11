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
- `src/lib/modules/appointments` — turnos, estados, bloqueos, reprogramación
- `src/lib/modules/customers` — clientes y vehículos
- `src/lib/modules/agents-api` — idempotencia y autenticación por API key

### Capacidad

Un turno ocupa una bahía de `inicio` a `fin` = suma de duraciones en `detalle_turno` + margen (`configuracion_turnos.margen_min`).

- Consultar disponibilidad **no reserva**
- Al confirmar/crear se revalida y se inserta en `ocupacion_bahia`
- PostgreSQL `EXCLUDE` evita solapamientos activos por bahía
- Reprogramación con conflicto mantiene el slot anterior
- Optimistic locking vía `turno.version`

## API para agentes

`POST /api/agents` y `GET /api/agents`

Headers:

- `x-api-key`: valor de `AGENT_API_KEY`
- `x-empresa`: slug de empresa (default `montironi`)
- `idempotency-key`: opcional, para operaciones idempotentes

Acciones POST (`action` en body):

- `crear_turno`, `cancelar_turno`, `reprogramar_turno`
- `upsert_cliente`, `upsert_vehiculo`

GET `?resource=servicios|disponibilidad|turno`

## Tests

```bash
npm run test
```

Verifica detección de conflictos, exclusión en DB y cálculo de disponibilidad.

## Pantallas incluidas (V1)

- Login
- Agenda diaria por bahía (grilla + lista) con filtros
- Detalle de turno y transiciones de estado
- Crear turno, reprogramar, cancelar, bloquear bahía
- Clientes (listado, detalle, alta/edición, vehículos)
- Catálogo de servicios (admin)
- Configuración básica (admin)
