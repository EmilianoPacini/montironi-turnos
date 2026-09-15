# Montironi Turnos — Documentación completa del proyecto

**Producto:** Montironi Turnos / Cima AI — agenda compartida de postventa automotor  
**Versión doc:** septiembre 2026  
**Audiencia:** Producto, desarrollo, integraciones (n8n/WhatsApp), QA, AppSec

---

## Resumen

Montironi Turnos unifica en **una sola agenda** la operación del taller (panel web) y los agentes IA (WhatsApp, n8n). Humanos y bots compiten por la misma capacidad física en PostgreSQL (`ocupacion_bahia`). El stack es un monolito **Next.js 16 + PostgreSQL + Prisma**, con ~31 rutas API, 19 pantallas de panel y suite Vitest.

**Norte:** consultar disponibilidad **no reserva**; reservar ocurre al crear turno. Tenancy estricto por `empresa_id`. Si un humano escribe en WhatsApp, el bot se pausa (`bot_paused`).

---

## Arranque rápido

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma migrate reset --force   # dev: reset + seed
npm run dev                        # http://localhost:43123
```

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@montironi.com | admin123 |
| Empleado | empleado@montironi.com | empleado123 |

DB dev: `postgresql://montironi:montironi@localhost:5433/montironi_turnos`

---

## Glosario

| Término | Significado |
|---------|-------------|
| Empresa | Tenant (`empresa_id` en tablas de negocio) |
| Bahía | Recurso físico (lift/box) que ocupa un turno |
| Ocupación | Fila `ocupacion_bahia` activa — turno o bloqueo |
| Hold | Reserva de capacidad al crear turno pendiente |
| Agents API | `/api/agents` — HTTP para bots con `x-api-key` |
| WAH | WhatsApp Hub — inbox + integración cima-ai |
| Buyer profile | Perfil comercial del cliente para el bot |

---

## Tabla de contenidos

1. [Visión y objetivos](#parte-1--visión-y-objetivos)
2. [Estado actual desarrollado](#parte-2--estado-actual-desarrollado)
3. [Arquitectura técnica](#parte-3--arquitectura-técnica)
4. [Dominio agenda y turnos](#parte-4--dominio-agenda-y-turnos)
5. [Panel web (empleados)](#parte-5--panel-web-empleados)
6. [API agentes y bot (n8n)](#parte-6--api-agentes-y-bot-n8n)
7. [Comunicaciones WhatsApp (WAH)](#parte-7--comunicaciones-whatsapp-wah)
8. [Clientes, historial y buyer](#parte-8--clientes-historial-y-buyer)
9. [Catálogo y disponibilidad](#parte-9--catálogo-y-disponibilidad)
10. [Seguridad y tenancy](#parte-10--seguridad-y-tenancy)
11. [Base de datos y migraciones](#parte-11--base-de-datos-y-migraciones)
12. [Roadmap y pendientes](#parte-12--roadmap-y-pendientes)

### Referencias complementarias (repo)

| Archivo | Uso |
|---------|-----|
| `docs/DOMAIN_SERVICES.md` | Contrato dominio agenda (dev) |
| `docs/AGENTS_CONTEXT_API.md` | Shape `/api/agents/context` |
| `docs/COMUNICACIONES_API.md` | Contrato WAH literal |
| `docs/SUPER_PROMPT_AGENTES.md` | System prompt + endpoints |
| `.cursor/n8n-agent-system-prompt.txt` | Prompt operativo Agustina |

---

# Parte 1 — Visión y objetivos
## Problema de negocio

Montironi (concesionaria / taller automotor) necesita **una sola agenda de postventa** donde convivan:

1. **Empleados del taller** — recepción, asesores, administración — usando un panel web.
2. **Agentes de IA** — principalmente WhatsApp, pero también teléfono y automatizaciones — que agendan, consultan y modifican turnos con las **mismas reglas** que un humano.

Sin esta unificación, el bot promete horarios que el panel no ve, o un empleado reserva encima de un slot que el bot ya ofreció. El producto elimina esa divergencia.

## Norte / visión de producto

> **Una agenda compartida, una fuente de verdad de capacidad, humanos y bots compitiendo por el mismo espacio físico (bahías).**

### Objetivos estratégicos (plan original)

| # | Objetivo | Estado |
|---|----------|--------|
| O1 | Panel web V1 para operación diaria del taller (agenda, turnos, clientes) | ✅ Desarrollado |
| O2 | API para agentes IA con paridad de reglas de negocio vs panel | ✅ Desarrollado |
| O3 | Capacidad real en PostgreSQL (`ocupacion_bahia`), no slots “virtuales” del bot | ✅ Desarrollado |
| O4 | Comunicaciones WhatsApp: inbox humano + envío bot vía integración | ✅ Desarrollado |
| O5 | Contexto rico de cliente para bot (turnos + historial + buyer) | ✅ Desarrollado (DDL 007) |
| O6 | Seguridad multi-tenant y auth fail-closed | ✅ Desarrollado (B1–B5) |
| O7 | Bot operativo en n8n (Agustina) con tools conectadas al backend | 🟡 Prompt + API listos; orquestación n8n en paralelo |
| O8 | Multi-empresa SaaS completo (onboarding self-service) | ⏳ Fuera de alcance V1 |

## Principios de diseño (no negociables)

Estos principios aparecen en backlog P0 (MT-P0-01…06), en `docs/DOMAIN_SERVICES.md` y en las reglas de Cursor del repo.

### 1. Consultar ≠ reservar

- `GET` de disponibilidad, agenda o `proximos_slots` **solo lee**.
- La reserva (hold) ocurre en `POST crear_turno` (turno `pendiente` + fila activa en `ocupacion_bahia`).
- El bot **nunca** debe asumir que mostrar un slot implica reservarlo.

### 2. Una capacidad compartida

- Humanos y bots compiten por `ocupacion_bahia` (`activo = true`).
- Tipos: `turno` (vinculado a turno) | `bloqueo` (bloqueo manual de bahía, sin turno).
- Anti-solape: constraint PostgreSQL `EXCLUDE USING gist` por bahía + periodo.

### 3. Persistencia en PostgreSQL

- El frontend y el bot **no** son fuente de verdad.
- Altas, ediciones y bajas van a DB vía server actions o APIs.
- Tras un write, invalidar todas las superficies que leen ese dato (`revalidateDomainSurfaces`).

### 4. Concordancia de catálogo

- Un servicio nuevo debe ofertarse en **todos** los talleres y bahías activos (`taller_servicio` + `bahia_servicio`), igual que el seed.
- Si solo existe la fila en `servicio`, el turno no lo lista al filtrar por compatibilidad.

### 5. Tenancy estricto

- Todo dato de negocio lleva `empresa_id`.
- APIs validan que el actor (sesión, API key, secret WAH) solo opere su empresa.

### 6. Idempotencia y concurrencia

- Mutaciones con `Idempotency-Key` → tabla `operacion_api`.
- Turnos con `version` (optimistic locking) en cancelar, reprogramar, transiciones.
- Errores tipados (`CapacidadConflicto`, `VersionConflicto`, etc.) en lugar de fallos genéricos.

### 7. Comunicaciones: humano pausa bot

- Si un operador escribe en el inbox WAH → `bot_paused = true`.
- El bot no debe seguir respondiendo hasta `POST .../bot/resume`.

## Alcance V1 / V1.1 (sí)

- Turnos de service automotor: talleres, bahías, servicios, disponibilidad.
- Crear, confirmar, cancelar, reprogramar turnos; bloqueos de bahía.
- FSM de estados: `pendiente → confirmado → recibido → en_servicio → finalizado` + salidas `cancelado`, `ausente`, `vencido`.
- Clientes y vehículos (CRUD panel + upsert vía Agents API).
- Catálogo de servicios con precios informativos (`fijo`, `desde`, `a_presupuestar`).
- Intervalos por km según tipo/condición de vehículo.
- Movimientos / auditoría append-only.
- Job `VencerPendientes` (cron con API key).
- WAH: cuentas, conversaciones, mensajes, media, webhook Meta, integración send-text/audio/file.
- Historial de services al finalizar turno + perfil buyer + clasificación cliente.
- Sesiones server-side (tabla `sesion`) + auth gate en middleware.

## Fuera de alcance V1 (explícito)

- Panel de configuración de agentes / plantillas versionadas (admin producto).
- Planificación multi-bahía por etapas del mismo turno.
- Fusión automática de clientes duplicados.
- Inventar catálogo u horarios en el cliente o en el prompt del bot.
- Operar otra empresa sin header/contexto de tenancy correcto.
- Venta de autos, plan de ahorro, financiación (derivar a humano).
- Pagos, tarjetas, datos financieros sensibles.

## Usuarios del sistema

| Actor | Canal | Autenticación |
|-------|-------|---------------|
| Admin | Panel web | Cookie sesión (`admin`) |
| Empleado | Panel web | Cookie sesión (`empleado`) |
| Bot Agustina / n8n | WhatsApp + Agents API | `x-api-key` + WAH secret |
| Cron / jobs | HTTP | `x-api-key` (hoy reutiliza `AGENT_API_KEY`) |
| Meta WhatsApp | Webhook inbound | `X-Cima-Forward-Secret` |

Roles en enum Prisma: `admin`, `empleado`, `operador`, `asesor`. **V1 del panel solo usa `admin` y `empleado`**; roles desconocidos reciben 403.

## Objetivos de una conversación de agendamiento (bot)

Flujo de producto acordado para el agente operativo:

1. Identificar o dar de alta cliente (nombre, apellido, teléfono E.164).
2. Identificar o dar de alta vehículo (patente + mínimos).
3. Elegir servicio(s) del catálogo.
4. Elegir taller o “lo antes posible”.
5. Consultar disponibilidad y presentar **solo** slots devueltos por API (3–5 opciones).
6. Confirmación explícita del usuario antes de `crear_turno`.
7. Comunicar resumen con id de turno; ante 409 reconsultar alternativas.
8. Respetar `bot_paused` en conversaciones WAH.

Referencia operativa del bot: `.cursor/n8n-agent-system-prompt.txt` y `docs/SUPER_PROMPT_AGENTES.md`.

## Coordinación de equipos (contexto plan)

| Rol | Responsabilidad |
|-----|-----------------|
| **Emi (PO)** | Decisiones de producto, hold en pendiente, priorización backlog |
| **Datos** | DDL oficiales en `montironi-turnos-v1/` (005 WAH, 007 historial) |
| **Dev / cloud agents** | Implementación Prisma + APIs + panel |
| **Gabi / n8n** | Caso 1: workflow bot WhatsApp conectado a Agents API + WAH |
| **QA** | Smoke reports en `qa-*.md` del repo |

## Métricas de éxito implícitas

- Cero doble reserva del mismo hueco bahía (garantizado por EXCLUDE + revalidación en tx).
- Panel y bot ven el mismo catálogo y la misma ocupación tras cualquier mutación.
- Bot no inventa precios, horarios ni estados de vehículo.
- Humano puede tomar conversación WAH sin que el bot siga interfiriendo.
# Parte 2 — Estado actual desarrollado

Inventario funcional de lo que **existe y corre** en el repositorio a septiembre 2026. Estado: ✅ completo | 🟡 parcial | ⏳ planificado.

## Resumen ejecutivo

Montironi Turnos es un **monolito Next.js 16** con PostgreSQL, ~30 rutas API, 19 pantallas de panel, 40+ archivos de tests (Vitest), y 6 migraciones Prisma en cadena. Cubre agenda operativa, CRM ligero, catálogo, WhatsApp y superficie para bots.

---

## Backend y dominio

| Área | Entregable | Estado | Ubicación principal |
|------|------------|--------|---------------------|
| Esquema autoritativo V1 | 21+ tablas, enums, EXCLUDE gist | ✅ | `prisma/migrations/20260911152000_*` |
| V1.1 clientes/vehículos/movimientos | Tablas + movimientos audit | ✅ | `20260911170000_*` |
| Comunicaciones WAH (005) | 4 tablas WA | ✅ | `20260911182000_*` |
| Historial + buyer (007) | 3 tablas | ✅ | `20260911200700_*` |
| Sesiones server-side | Tabla `sesion` + iron-session | ✅ | `20260911225000_*` |
| Horarios taller agents | Endpoints talleres/slots | ✅ | `20260914140000_*` |
| Casos de uso agenda | Crear, confirmar, cancelar, reprogramar, bloqueos, vencer | ✅ | `src/lib/modules/appointments/application/` |
| Disponibilidad | Cálculo on-the-fly sin store de slots | ✅ | `src/lib/modules/availability/service.ts` |
| Repos dominio | Turno, Ocupación, OperacionApi | ✅ | `src/lib/modules/agenda/infrastructure/` |
| Idempotencia API | `operacion_api` + replay | ✅ | `src/lib/modules/agents-api/idempotency.ts` |
| Seed desarrollo | Empresa Montironi, 2 talleres, servicios, turnos demo | ✅ | `prisma/seed.ts` |
| Backfill historial | Script idempotente | ✅ | `npm run db:backfill-historial` |

---

## API HTTP

### Panel / dominio v1 (cookie sesión)

| Método | Ruta | Función | Estado |
|--------|------|---------|--------|
| GET | `/api/v1/talleres/{id}/agenda` | Agenda del día | ✅ |
| GET | `/api/v1/talleres/{id}/disponibilidad` | Slots por fecha/servicio | ✅ |
| GET | `/api/v1/talleres/{id}/bahias` | Bahías del taller | ✅ |
| POST | `/api/v1/turnos` | Crear turno pendiente | ✅ |
| POST | `/api/v1/turnos/{id}/confirmar` | Confirmar + snapshots | ✅ |
| POST | `/api/v1/turnos/{id}/transiciones` | FSM manual | ✅ |
| POST | `/api/v1/turnos/{id}/reprogramar` | Reprogramar atómico | ✅ |
| POST | `/api/v1/turnos/{id}/cancelar` | Cancelar + liberar | ✅ |
| POST | `/api/v1/bahias/{id}/bloqueos` | Bloqueo manual | ✅ |
| DELETE | `/api/v1/bloqueos/{id}` | Quitar bloqueo | ✅ |
| POST | `/api/v1/jobs/vencer-pendientes` | Cron pendientes vencidos | ✅ |
| GET | `/api/v1/clientes/context` | Contexto por teléfono/id | ✅ |
| GET | `/api/v1/clientes/{id}/context` | Contexto por id | ✅ |
| POST | `/api/v1/clientes/{id}/clasificaciones` | Clasificar buyer | ✅ |
| GET/PATCH | `/api/v1/bahias/{id}` | Detalle bahía | ✅ |

### Agents API (`x-api-key`)

| Superficie | Función | Estado |
|------------|---------|--------|
| `GET /api/agents?resource=servicios` | Catálogo para bot | ✅ |
| `GET /api/agents?resource=servicio&id=` | Detalle un servicio | ✅ (nuevo `servicio-agents.ts`) |
| `GET /api/agents?resource=talleres` | Sucursales compatibles | ✅ |
| `GET /api/agents?resource=proximos_slots` | N próximos huecos | ✅ |
| `GET /api/agents?resource=disponibilidad` | Día específico | ✅ |
| `GET /api/agents?resource=cliente` | Contexto legacy | ✅ |
| `GET /api/agents?resource=turno` | Detalle turno | ✅ |
| `GET /api/agents?resource=estado_vehiculo` | “¿Dónde está mi auto?” | ✅ |
| `GET /api/agents/context` | Contexto unificado DDL 007 | ✅ |
| `POST /api/agents` | crear/cancelar/reprogramar/upsert/clasificar | ✅ |

Acciones POST soportadas (`dispatch.ts`):

- `crear_turno`, `cancelar_turno`, `reprogramar_turno`
- `upsert_cliente`, `upsert_vehiculo`
- `clasificar_cliente`

### WAH / WhatsApp

| Ruta | Función | Estado |
|------|---------|--------|
| `GET /api/wah/accounts` | Cuentas WA empresa | ✅ |
| `GET /api/wah/dashboard` | KPIs inbox | ✅ |
| `GET /api/wah/conversations` | Lista conversaciones | ✅ |
| `GET /api/wah/conversations/:id` | Thread + mensajes | ✅ |
| `POST /api/wah/conversations/:id/messages` | Humano escribe → pausa bot | ✅ |
| `POST /api/wah/conversations/:id/bot/resume` | Reanudar bot | ✅ |
| `POST /api/wah/conversations/:id/read` | Marcar leído | ✅ |
| `GET /api/wah/media/:mediaId` | Media panel | ✅ |
| `POST /api/wah/integration/send-text` | Bot envía texto | ✅ |
| `POST /api/wah/integration/send-audio` | Bot envía audio | ✅ |
| `POST /api/wah/integration/send-file` | Bot envía archivo | ✅ |
| `GET /api/wah/integration/media/:mediaId` | Media integración | ✅ |
| `GET /api/wah/integration/conversations/:id` | Conversación integración | ✅ |
| `POST /api/webhooks/whatsapp/received-data` | Inbound Meta | ✅ |

---

## Panel web (pantallas)

| Ruta | Descripción | Rol | Estado |
|------|-------------|-----|--------|
| `/login` | Login email/password | público | ✅ |
| `/agenda` | Grilla + lista diaria por bahía | empleado+ | ✅ |
| `/agenda/bloquear` | Formulario bloqueo bahía | empleado+ | ✅ |
| `/turnos/nuevo` | Alta turno con modals cliente/vehículo | empleado+ | ✅ |
| `/turnos/[id]` | Detalle, confirmar, transiciones | empleado+ | ✅ |
| `/turnos/[id]/reprogramar` | Reprogramación con slots | empleado+ | ✅ |
| `/clientes` | Listado clientes | empleado+ | ✅ |
| `/clientes/nuevo` | Alta cliente | empleado+ | ✅ |
| `/clientes/[id]` | Detalle + vehículos | empleado+ | ✅ |
| `/clientes/[id]/editar` | Edición cliente | empleado+ | ✅ |
| `/clientes/.../vehiculo/nuevo` | Alta vehículo | empleado+ | ✅ |
| `/clientes/.../vehiculo/.../editar` | Edición vehículo | empleado+ | ✅ |
| `/comunicaciones` | Inbox WAH + chat | empleado+ | ✅ |
| `/servicios` | Catálogo + intervalos km | admin | ✅ |
| `/bahias` | Gestión bahías | admin | ✅ |
| `/taller` | Listado talleres | admin | ✅ |
| `/taller/[id]` | Horarios, excepciones, datos | admin | ✅ |
| `/configuracion` | Config turnos (margen, etc.) | admin | ✅ |
| `/movimientos` | Auditoría movimientos | admin | ✅ |
| `/usuarios` | Usuarios empresa | admin | ✅ |

---

## Tests automatizados

Suite Vitest en `tests/` (~40 archivos):

| Categoría | Ejemplos | Qué verifica |
|-----------|----------|--------------|
| Unit | `occupation.test.ts`, `fsm.test.ts`, `authz.test.ts` | Invariantes dominio, FSM, roles |
| Integration | `concurrency.test.ts`, `reschedule.test.ts`, `blocks.test.ts` | EXCLUDE, reprogramación, bloqueos |
| Integration | `wah.test.ts`, `whatsapp-webhook.test.ts` | WAH end-to-end |
| Integration | `historial-buyer.test.ts`, `agents-cliente.test.ts` | Context API, buyer |
| Integration | `tenant-isolation.test.ts`, `auth-gate.test.ts` | Seguridad |
| Integration | `servicio-agents.test.ts`, `talleres-horario-agents.test.ts` | Agents API catálogo |

Comandos: `npm run test`, `npm run test:unit`, `npm run test:integration`.

---

## Integraciones externas (configuración)

Variables en `.env.example`:

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | PostgreSQL |
| `SESSION_SECRET` | iron-session |
| `AGENT_API_KEY` | Auth Agents API + cron job |
| `AGENT_API_EMPRESA` | Slug empresa default para API key |
| `CIMA_FORWARD_SECRET` | Auth WAH integración + webhook |
| `META_WHATSAPP_ACCESS_TOKEN` | Graph API (envío real WA) |
| `WAH_MESSAGE_WEBHOOK_URL` | Forward inbound a n8n |
| `WAH_MEDIA_DIR` / `WAH_SEND_FILES_DIR` | Almacenamiento media |

---

## Trabajo en curso (working tree)

Según estado git al documentar:

| Archivo | Natureza |
|---------|----------|
| `src/lib/modules/catalog/servicio-agents.ts` | DTO catálogo para agents (`servicio` + `servicios`) |
| `tests/integration/servicio-agents.test.ts` | Tests del recurso |
| `src/app/api/agents/route.ts` | Endpoints `servicio` / `servicios` agents |
| `.cursor/n8n-agent-system-prompt.txt` | Prompt Agustina para n8n |

---

## Lo que NO está desarrollado (ver [Parte 12](#parte-12--roadmap-y-pendientes))

- Onboarding multi-empresa self-service.
- Panel admin de prompts/plantillas de agentes.
- Roles `operador` / `asesor` con UX propia.
- `CRON_API_KEY` separada de `AGENT_API_KEY` (follow-up B7).
- Refactors frontend deferred (ver `docs/FRONTEND_CLEAN_CODE_AUDIT.md`).
- Workflow n8n productivo desplegado (depende de infra Gabi, no del repo).
# Parte 3 — Arquitectura técnica

## Stack

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js 20+ |
| Framework | Next.js 16 App Router |
| UI | React 19, Tailwind CSS 4 |
| ORM | Prisma 5 → PostgreSQL 15+ |
| Auth sesión | iron-session + tabla `sesion` |
| Validación | Zod 4 |
| Tests | Vitest 5 |
| Fechas | date-fns 4 |
| TZ negocio | `America/Argentina/Buenos_Aires` (`src/lib/time/business-tz.ts`) |

Puerto dev: **43123**. DB Docker: **5433**.

## Patrón arquitectónico

**Monolito modular**: un deploy, boundaries por dominio en `src/lib/modules/`, HTTP en `src/app/api/`.

```
┌─────────────────────────────────────────────────────────────┐
│                     Clientes HTTP                            │
│  Browser (panel) │ n8n/bot │ Meta WA │ cron                  │
└────────┬─────────┴────┬────┴────┬────┴───┬──────────────────┘
         │              │         │        │
         v              v         v        v
┌─────────────────────────────────────────────────────────────┐
│              Next.js — middleware (Edge)                     │
│  Cookie presence │ security headers │ public path allowlist  │
└────────────────────────────┬────────────────────────────────┘
                             v
┌─────────────────────────────────────────────────────────────┐
│         Route handlers / Server Actions / RSC pages          │
│  requireSession │ requireAdmin │ validateAgentApiKey         │
└────────────────────────────┬────────────────────────────────┘
                             v
┌─────────────────────────────────────────────────────────────┐
│                    Application layer                         │
│  appointments/application │ agents-api/actions │ wah/*       │
└────────────────────────────┬────────────────────────────────┘
                             v
┌─────────────────────────────────────────────────────────────┐
│              Domain + Infrastructure                         │
│  agenda/domain (errors, policies, invariants)                │
│  agenda/infrastructure (Prisma repos)                        │
│  catalog │ customers │ availability │ historial │ buyer      │
└────────────────────────────┬────────────────────────────────┘
                             v
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL                                │
│  ocupacion_bahia EXCLUDE │ operacion_api UNIQUE │ sesion     │
└─────────────────────────────────────────────────────────────┘
```

## Módulos (`src/lib/modules/`)

| Módulo | Responsabilidad |
|--------|-----------------|
| `auth` | Login, logout, server actions sesión |
| `agenda` | Domain errors, repos, HTTP helpers API v1 |
| `appointments` | Casos de uso turnos (create, confirm, cancel, reschedule, expire, transition) |
| `availability` | Cálculo slots libres leyendo ocupación + horarios |
| `catalog` | Servicios, talleres, bahías, oferta, intervalos km, DTO agents |
| `customers` | Clientes, vehículos, contexto, validación E.164 |
| `agents-api` | Dispatch acciones, idempotencia, resolve empresa/canal |
| `wah` | Cuentas, conversaciones, mensajes, media, webhook, integración |
| `historial` | Upsert historial al finalizar turno |
| `buyer` | Perfil buyer + clasificación |
| `audit` | Movimientos append-only |

## Capas de autorización

Ver [Parte 10 — Seguridad y tenancy](#parte-10--seguridad-y-tenancy). Resumen:

1. **Edge** (`src/middleware.ts`): ¿hay cookie `montironi_session`?
2. **Node** (`requireSession`, `assertPanelAccess`): ¿sesión válida en DB? ¿rol permitido?

APIs machine-to-machine bypass cookie en Edge pero validan credencial en handler:

- `/api/agents*` → `x-api-key`
- `/api/wah/integration/*` → `X-Cima-Forward-Secret`
- `/api/webhooks/*` → secret
- `/api/v1/jobs/*` → `x-api-key` o sesión admin

## Flujo de datos: crear turno (panel o bot)

```
1. Cliente POST crear_turno / server action
2. Validar horario no vencido, servicios compatibles con bahías
3. Calcular finaliza_en = sum(duraciones detalle) + margen config
4. Resolver bahía (auto si una compatible libre; error si ambiguo)
5. TX PostgreSQL:
   a. INSERT turno (estado pendiente o confirmado según flujo)
   b. INSERT detalle_turno (precios snapshot si confirmado)
   c. INSERT ocupacion_bahia activa tipo=turno
   d. INSERT evento_turno
   e. INSERT operacion_api (si idempotency key)
6. revalidateDomainSurfaces (panel)
7. Response con turno + bahía asignada
```

Misma lógica compartida entre `/api/v1/turnos` y `POST /api/agents` action `crear_turno`.

## Flujo de datos: mensaje WhatsApp inbound

```
Meta → POST /api/webhooks/whatsapp/received-data
  → validate CIMA_FORWARD_SECRET
  → lookup whatsapp_accounts by phone_number_id
  → idempotencia wamid
  → persist wah_messages + wah_media
  → si bot_paused=false y WAH_MESSAGE_WEBHOOK_URL:
       forward POST a n8n (event: inbound_message)
n8n → Agents API (consultar/responder) + WAH integration send-text
```

## Invalidación de cache (Next.js)

Tras mutaciones de catálogo/agenda/clientes, usar `revalidateDomainSurfaces` (regla Cursor) para que panel, disponibilidad y Agents API vean el mismo estado.

Superficies típicas:

- Catálogo: `/servicios`, `/turnos/nuevo`, `/agenda`, `/bahias`
- Agenda: `/agenda`, rutas turno
- Clientes: `/clientes/*`

## Convenciones de código

- **Tenancy:** siempre filtrar por `empresaId` del actor; nunca confiar en IDs del cliente sin verificar ownership.
- **Errores dominio:** clases en `agenda/domain/errors.ts` con `code` estable para HTTP mapping.
- **Server actions:** panel usa actions en `appointments/actions.ts`, `catalog/*.actions.ts`, `auth/actions.ts`.
- **DTO agents:** snake_case en JSON (`duracion_minutos`, `modo_precio`) para compatibilidad n8n.

## Estructura de directorios relevante

```
montironi-turnos/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/          # cadena única (ver Parte 11)
├── src/
│   ├── app/
│   │   ├── (panel)/         # UI empleados/admin
│   │   ├── api/             # REST handlers
│   │   ├── login/
│   │   └── middleware.ts    # (en src/, no app/)
│   ├── components/          # UI React
│   └── lib/
│       ├── auth/            # guards, session, access
│       ├── modules/         # dominio (ver tabla arriba)
│       └── time/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── helpers/
├── docs/                    # contratos técnicos puntuales
├── .docs/                   # esta documentación extensa
└── montironi-turnos-v1/     # DDL oficiales Datos (shared box)
```

## Dependencias externas runtime

- **PostgreSQL** con extensiones `pgcrypto`, `btree_gist` (requerido para EXCLUDE).
- **Docker Compose** para dev DB (`docker-compose.yml`).
- **Meta Graph API** opcional para envío WA real (dev puede mockear).
- **n8n** externo — consume APIs, no embebido en el repo.
# Parte 4 — Dominio agenda y turnos

Referencia de negocio alineada a `docs/DOMAIN_SERVICES.md` y migración autoritativa `20260911152000`.

## Modelo mental

```
empresa
  └── taller(es)
        └── bahía(s)          ← recurso físico que se ocupa
        └── horarios          ← patrones + franjas + excepciones
  └── servicio(s)             ← catálogo empresa
        └── oferta en taller_servicio + bahia_servicio
  └── turno
        └── detalle_turno     ← líneas de servicio (duración, precio snapshot)
        └── ocupacion_bahia   ← hold de capacidad (periodo tstzrange)
        └── evento_turno      ← auditoría append-only FSM
```

Un turno ocupa **exactamente una bahía** durante `[inicio, finaliza_en)`.

### Cálculo de `finaliza_en`

```
finaliza_en = inicio + Σ(duracion_min detalle_turno) + configuracion_turnos.margen_minutos
```

## Fuente de verdad de capacidad

**Tabla `ocupacion_bahia`** con `activo = true` es lo que bloquea una bahía.

| Campo | Significado |
|-------|-------------|
| `bahia_id` | Bahía ocupada |
| `periodo` | `tstzrange(inicio, finaliza_en)` |
| `tipo` | `turno` \| `bloqueo` |
| `turno_id` | Obligatorio si tipo=turno; NULL si bloqueo |
| `motivo` | Obligatorio si bloqueo |
| `activo` | false = liberado (cancelado, vencido, etc.) |

**Constraint anti-solape:**

```sql
EXCLUDE USING gist (bahia_id WITH =, periodo WITH &&) WHERE (activo)
```

Dos ocupaciones activas no pueden solaparse en la misma bahía.

## Hold en pendiente (decisión producto)

| Evento | Ocupación |
|--------|-----------|
| Crear turno `pendiente` | INSERT ocupación activa |
| Confirmar turno | Se mantiene (o swap si cambia bahía/periodo) |
| Cancelar / ausente / vencido / finalizado | `activo = false` |
| Reprogramar | Swap atómico; si falla, original intacto |

**Implicación para bots:** `crear_turno` con confirmación ocupa capacidad real de inmediato. Consultar slots antes no garantiza el hueco hasta el POST.

## Máquina de estados (FSM)

```
                    ┌──────────┐
                    │ pendiente│
                    └────┬─────┘
           vence job     │ confirmar
              ┌──────────┼──────────┐
              v          v          │
         ┌────────┐  ┌──────────┐   │
         │ vencido│  │confirmado│   │
         └────────┘  └────┬─────┘   │
                          │ recibido (manual)
                          v
                     ┌──────────┐
                     │ recibido │
                     └────┬─────┘
                          │ en_servicio (manual)
                          v
                     ┌────────────┐
                     │ en_servicio│
                     └─────┬──────┘
                           │ finalizado (manual)
                           v
                     ┌────────────┐
                     │ finalizado │
                     └────────────┘

Salidas manuales desde varios estados: cancelado, ausente
```

| Transición automática | Cuándo |
|----------------------|--------|
| `pendiente → vencido` | Job `VencerPendientes` o confirmación rechazada si `inicio` pasado |

**No hay auto-ausente.** Estados operativos del taller son siempre manuales.

## Consulta vs reserva

| Operación | Escribe ocupación |
|-----------|-------------------|
| GET agenda | No |
| GET disponibilidad | No |
| GET proximos_slots (agents) | No |
| POST crear turno | **Sí** |
| POST bloqueo bahía | **Sí** (tipo bloqueo) |

## Resolución de bahía

Al crear/reprogramar:

1. Filtrar bahías del taller compatibles con servicios (`bahia_servicio`).
2. Excluir periodos con ocupación activa o fuera de horario.
3. Si **exactamente una** bahía libre → asignación automática.
4. Si **cero** → `CapacidadConflicto` o `BahiaIncompatible`.
5. Si **varias** libres → panel puede elegir; agents API **no envía bahía** (backend elige o error).

## Optimistic locking

Campo `turno.version` (entero). Toda mutación de turno exige versión actual:

- Cancelar, reprogramar, transiciones → mismatch = `VersionConflicto` (409).

Headers aceptados en API v1: `If-Match`, `x-turno-version`, o `version` en body.

## Idempotencia

Tabla `operacion_api`:

- UNIQUE `(empresa_id, idempotency_key)`
- Guarda hash/request/response para replay

| Resultado | HTTP |
|-----------|------|
| Misma key + mismo body | `IdempotencyReplay` → 200 con respuesta cacheada |
| Misma key + body distinto | conflicto 409 |
| Key nueva | ejecuta normalmente |

**Agents API:** header `idempotency-key` obligatorio en `crear_turno`. Convención bot: `idempotency_base + "-" + inicio`.

## Snapshots en detalle

Al **confirmar**, se congelan en `detalle_turno`:

- `servicio_nombre_snapshot`, `precio_snapshot`, `duracion_min_snapshot`, etc.

Reprogramación **no** reescribe snapshots por cambios de catálogo posteriores.

## Bloqueos manuales

- `tipo_ocupacion = bloqueo`
- `turno_id IS NULL`
- `motivo` obligatorio
- `creado_por_usuario_id` opcional
- No se crea turno ficticio

Panel: `/agenda/bloquear` y acciones desde grilla.

## Job VencerPendientes

```
POST /api/v1/jobs/vencer-pendientes
Header: x-api-key: AGENT_API_KEY
Opcional: x-empresa: montironi
```

Ejecuta `expirePendingTurnos`: turnos `pendiente` con `inicio < now` → `vencido`, libera ocupación.

**No depende** de que alguien abra `/agenda`.

## Errores tipados

| Código | HTTP | Cuándo |
|--------|------|--------|
| `CapacidadConflicto` | 409 | Solape bahía / carrera |
| `BahiaIncompatible` | 409 | Servicio no compatible con bahía |
| `FueraDeHorario` | 409 | Fuera de franja taller |
| `VersionConflicto` | 409 | Version desactualizada |
| `TransicionInvalida` | 422 | FSM ilegal |
| `TurnoNoReprogramable` | 422 | Estado no permite reprogramar |
| `BloqueoInvalido` | 422 | Datos bloqueo inválidos |
| `HorarioVencido` | 409 | Inicio en el pasado |
| `RecursoNoEncontrado` | 404 | ID inexistente en empresa |
| `ValidacionCliente` | 422 | Teléfono/nombre inválido |
| `IdempotencyReplay` | 200 | Replay idempotente OK |

Implementación: `src/lib/modules/agenda/domain/errors.ts`, mapping HTTP en `appointments/service.ts` y route handlers.

## Casos de uso (application layer)

| Caso de uso | Archivo aproximado |
|-------------|-------------------|
| CrearTurnoPendiente | `appointments/application/create-turno.ts` |
| ConfirmarTurno | `appointments/application/confirm-turno.ts` |
| CancelarTurno | `appointments/application/cancel-turno.ts` |
| TransicionarEstado | `appointments/application/transition-turno-state.ts` |
| ReprogramarTurno | `appointments/application/reschedule-turno.ts` |
| VencerPendientes | `appointments/application/expire-pending.ts` |
| Crear/Liberar bloqueo | repos ocupación + API v1 bloqueos |

## Precios (V1 informativos)

Enum `modo_precio`:

| Modo | Comunicación al cliente |
|------|-------------------------|
| `fijo` | Precio referencia exacto |
| `desde` | “Desde $X” |
| `a_presupuestar` | No inventar cifra; presupuesto en taller |

Se snapshotean al confirmar/reservar en detalle.

## Tests de invariantes

| Test | Verifica |
|------|----------|
| `tests/unit/occupation.test.ts` | Reglas hold/liberación |
| `tests/unit/fsm.test.ts` | Transiciones válidas |
| `tests/integration/concurrency.test.ts` | EXCLUDE bajo carrera |
| `tests/integration/reschedule.test.ts` | Swap atómico |
| `tests/integration/blocks.test.ts` | Bloqueos vs turnos |
| `tests/integration/domain-bugs.test.ts` | Regresiones conocidas |

## Calendario vs ocupación

No confundir:

- **`estado_calendario`** en franjas/excepciones: `disponible`, `bloqueado`, `cerrado` — define horario de apertura.
- **`tipo=bloqueo`** en `ocupacion_bahia`: bloqueo operativo puntual de una bahía.

Un día “cerrado” en calendario no crea fila de bloqueo; simplemente no hay slots.
# Parte 5 — Panel web (empleados)

Interfaz **Cima AI** para operación diaria del taller. Server Components + Server Actions; autenticación obligatoria excepto login.

## Roles y navegación

Matriz en `src/lib/auth/access.ts`:

| Ruta | Admin | Empleado |
|------|:-----:|:--------:|
| `/agenda` | ✅ | ✅ |
| `/clientes`, `/turnos/*` | ✅ | ✅ |
| `/comunicaciones` | ✅ | ✅ |
| `/servicios`, `/bahias`, `/taller` | ✅ | ❌ |
| `/configuracion`, `/movimientos`, `/usuarios` | ✅ | ❌ |

Roles `operador`, `asesor` → **403** (no degradan a empleado).

Sidebar: `src/components/layout/Sidebar.tsx` — colapsable, persistencia en `localStorage`.

## Pantallas en detalle

### Login (`/login`)

- Email + contraseña → `loginAction`
- Crea fila `sesion` + cookie iron-session
- Redirect post-login → `/agenda`

### Agenda (`/agenda`)

**Objetivo:** vista operativa del día por taller y bahía.

Componentes principales:

- `AgendaGrid.tsx` — grilla temporal por bahía
- `AgendaFilters.tsx` — filtros estado, origen/canal, pendientes
- `AgendaToolbar.tsx` — fecha, taller, vista lista/grilla
- `TurnoCard` / tiles en grilla
- Acciones: ir a detalle, bloquear bahía

Datos: server fetch agenda vía queries Prisma / helpers `agenda-query.ts`.

Filtros típicos:

- Estado turno (pendiente, confirmado, en taller, etc.)
- Origen/canal (`whatsapp`, `web`, etc.)
- Toggle “solo pendientes”

### Bloquear bahía (`/agenda/bloquear`)

Formulario `BloquearForm.tsx`:

- Selección bahía, inicio/fin, motivo
- Crea `ocupacion_bahia` tipo `bloqueo`
- Liberar desde grilla o API DELETE

### Nuevo turno (`/turnos/nuevo`)

Formulario grande `NuevoTurnoForm.tsx`:

- Selección cliente (existente o modal alta inline)
- Vehículo (existente o modal)
- Taller, servicios, fecha/hora
- Preview slots: `AvailabilitySlotsPanel.tsx`
- Submit → server action crear turno pendiente/confirmado

**Nota refactor:** audit SOLID marca este componente como “god component”; extracciones parciales hechas (PRs #10–#15).

### Detalle turno (`/turnos/[id]`)

- Datos turno, cliente, vehículo, servicios, bahía
- Botones según estado: confirmar, transiciones FSM, cancelar
- Link reprogramar
- Helper `getProximosKmForTurno` para intervalos km sugeridos

Transiciones manuales: recibido → en_servicio → finalizado; cancelar/ausente según política.

### Reprogramar (`/turnos/[id]/reprogramar`)

- `ReprogramarForm.tsx` + panel disponibilidad
- Requiere versión actual del turno
- Misma lógica de slots que nuevo turno

### Clientes (`/clientes/*`)

| Pantalla | Función |
|----------|---------|
| Listado | Búsqueda, paginación simple |
| Detalle | Datos + vehículos vinculados |
| Nuevo/editar | `ClienteForm.tsx`, validación teléfono |
| Vehículo nuevo/editar | `VehiculoFields.tsx`, patente, km, condición |

Persistencia: `src/lib/modules/customers/service.ts` — siempre PostgreSQL.

### Servicios (`/servicios`) — admin

- `ServiciosCatalogTable.tsx` — listado tipos y servicios
- Alta/edición servicio con duración, precio, modo_precio
- `IntervaloKmFields.tsx` — intervalos por tipo/condición vehículo
- **Importante:** usar `createServicio` / actions que llamen `offerServicioInEmpresa` (regla concordancia catálogo)

### Bahías (`/bahias`) — admin

- `BahiaCreateForm.tsx` — crear bahía en taller
- Compatibilidad servicios (`bahia_servicio`)

### Taller (`/taller`, `/taller/[id]`) — admin

- `CrearTallerForm`, `UpdateTallerForm`
- `TallerHorarioForm` — patrones + franjas por día
- `TallerExcepcionForm` — cierres y horarios especiales
- `TallerDatosFields` — dirección desglosada (calle, localidad, etc.)

### Configuración (`/configuracion`) — admin

- Margen entre turnos (`configuracion_turnos.margen_minutos`)
- Parámetros globales empresa

### Movimientos (`/movimientos`) — admin

- Log audit `movimiento` — quién hizo qué
- Formato legible: `format-movimiento.ts`

### Usuarios (`/usuarios`) — admin

- Gestión usuarios empresa (admin/empleado)
- Password hash bcrypt

### Comunicaciones (`/comunicaciones`)

Ver [Parte 7 — Comunicaciones WhatsApp (WAH)](#parte-7--comunicaciones-whatsapp-wah):

- `WahChatPanel.tsx`, `WahAccountSwitcher.tsx`
- Hook cliente `use-wah-api.ts` (SWR)
- Inbox + envío humano → pausa bot

## Server Actions vs API

| Operación panel | Mecanismo |
|-----------------|-----------|
| Login/logout | Server actions `auth/actions.ts` |
| CRUD clientes/vehículos | Actions + `customers/service` |
| Turnos (crear, confirmar, etc.) | `appointments/actions.ts` |
| Catálogo servicios/talleres | `catalog/*.actions.ts` |

El panel **no** debería usar estado React como fuente de verdad post-mutación; tras guardar, revalidar y re-leer DB.

## UX compartida

- `PanelShell.tsx` — layout con sidebar
- `AdminOnlyBanner.tsx` — aviso en rutas admin
- `FormSubmitButton.tsx`, `DateTimeClockField.tsx`, `TimeClockPicker.tsx`
- Hook `useActionTransition` — patrón loading + refresh post-action (PR #10)

## Zona horaria

Toda presentación de hora en agenda usa TZ negocio Buenos Aires. API serializa ISO UTC; UI formatea local.

## Accesibilidad y estilo

Tailwind utility-first, paleta azul Montironi/Cima. Sidebar con `aria-label` en modo colapsado.

## Smoke QA recomendado

Checklist en `docs/FRONTEND_CLEAN_CODE_AUDIT.md`:

1. Login admin + empleado
2. Agenda filtros + grilla/lista
3. Nuevo turno con modals cliente/vehículo
4. Detalle: confirmar, transiciones, cancelar, reprogramar
5. Bloqueo bahía
6. Comunicaciones inbox
7. Clientes CRUD
# Parte 6 — API agentes y bot (n8n)

Superficie HTTP para **agentes IA**, workflows n8n y integraciones de voz. Autenticación: header `x-api-key` = env `AGENT_API_KEY`.

## Configuración

| Variable | Descripción |
|----------|-------------|
| `AGENT_API_KEY` | Secret compartido con n8n |
| `AGENT_API_EMPRESA` | Slug default (`montironi`) si falta header |

Headers comunes:

```
x-api-key: <AGENT_API_KEY>
x-empresa: montironi          # opcional; debe coincidir con scope de la key
Content-Type: application/json
idempotency-key: <uuid>       # obligatorio en crear_turno
```

## Arquitectura handlers

```
GET/POST /api/agents/route.ts
  → validateAgentApiKey
  → resolveAgentEmpresa (slug → empresa UUID)
  → GET: switch resource
  → POST: withIdempotency → dispatchAgentAction
```

Dispatch (`src/lib/modules/agents-api/dispatch.ts`):

| action | Handler |
|--------|---------|
| `crear_turno` | `actions/crear-turno.ts` |
| `cancelar_turno` | `actions/cancelar-turno.ts` |
| `reprogramar_turno` | `actions/reprogramar-turno.ts` |
| `upsert_cliente` | `actions/upsert-cliente.ts` |
| `upsert_vehiculo` | `actions/upsert-vehiculo.ts` |
| `clasificar_cliente` | `actions/clasificar-cliente.ts` |

Canal turno: body `canal` (`whatsapp`, `telefono`, `agente_ia`, `web`, `interno`). Legacy `origen` mapeado en `resolve-canal.ts`.

---

## GET `/api/agents` — recursos de lectura

Query param **`resource`** (obligatorio salvo rutas legacy).

### `resource=servicios`

Lista catálogo activo empresa.

```json
{
  "servicios": [
    {
      "id": "uuid",
      "nombre": "Service 10.000 km",
      "descripcion": "...",
      "tipo": "Mecánica",
      "duracion_minutos": 90,
      "precio": 85000,
      "moneda": "ARS",
      "modo_precio": "desde"
    }
  ]
}
```

Implementación: `listServiciosForAgents` en `catalog/servicio-agents.ts`.

### `resource=servicio`

Query `id` (uuid). Detalle de un servicio — mismo shape que item de lista.

### `resource=talleres`

Query opcional `servicioId` — filtra talleres con bahía compatible.

```json
{
  "talleres": [
    {
      "id": "uuid",
      "nombre": "Centro",
      "localidad": "Godoy Cruz",
      "direccion": "..."
    }
  ]
}
```

### `resource=proximos_slots`

Query:

- `servicioId` (requerido)
- `tallerId` (opcional — omitir para “cualquier taller”)
- `desde` (ISO opcional)
- `limite` (default 5, max 20)

```json
{
  "slots": [
    {
      "inicio": "2026-09-16T14:00:00.000Z",
      "fin": "2026-09-16T15:30:00.000Z",
      "tallerId": "uuid",
      "tallerNombre": "Centro",
      "localidad": "Godoy Cruz"
    }
  ]
}
```

**No reserva.** Solo lectura calculada.

### `resource=disponibilidad`

Query: `tallerId`, `fecha` (YYYY-MM-DD), `servicioId` (repetible), `bahiaId` opcional.

```json
{
  "availability": [ /* por bahía */ ],
  "horario_del_dia": [{ "abre": "08:00", "cierra": "18:00" }],
  "ventanas_disponibles": [ /* agregado */ ]
}
```

Usar cuando el cliente pide un **día concreto** (“el martes por la tarde”).

### `resource=cliente`

Query: `id` **o** `telefono` (E.164).

Shape legacy plano con cliente, vehículos, turnos, `atencion_actual`.

Preferir **`GET /api/agents/context`** para bots nuevos.

### `resource=turno`

Query: `id` — detalle turno incluyendo `version` para mutaciones.

### `resource=estado_vehiculo`

Query: `telefono` | `wa_id` | `cliente_id`, opcional `patente`.

Respuesta: atención actual en taller o último historial — “¿Dónde está mi auto?”.

404 si no hay datos en la empresa.

---

## GET `/api/agents/context` — lectura unificada

**Prioridad para bot WhatsApp** — una sola llamada al inicio de conversación.

Query (uno obligatorio): `telefono` | `wa_id` | `cliente_id`  
Opcional: `empresa` o header `x-empresa`.

Ver shape completo en `docs/AGENTS_CONTEXT_API.md`.

Campos clave:

| Campo | Contenido |
|-------|-----------|
| `cliente` | Identidad |
| `vehiculos` | Flota + `proximosServicios` |
| `turnos.programados` | No terminales |
| `turnos.realizados` | Estado finalizado |
| `buyer_profile` / `perfilBuyer` | Tags, score reclamos, clasificación |
| `historial_services` / `ultimosServices` | Últimos 10 services |
| `meta.partial` | Indicador campos faltantes post-migración |

404 sin cliente. 422 `ValidacionCliente` teléfono inválido.

---

## POST `/api/agents` — mutaciones

Body: `{ "action": "...", ...campos }`

### `crear_turno`

```json
{
  "action": "crear_turno",
  "tallerId": "uuid",
  "clienteId": "uuid",
  "vehiculoId": "uuid",
  "servicioIds": ["uuid"],
  "inicio": "2026-09-15T14:00:00.000Z",
  "canal": "whatsapp",
  "notas": "opcional",
  "confirmar": true
}
```

Reglas:

- Header **`idempotency-key` obligatorio**
- **No enviar `bahiaId`** — backend asigna
- `inicio` debe ser slot real devuelto por proximos_slots/disponibilidad
- Rechaza pasado → `HorarioVencido`
- 409 `CapacidadConflicto` si hubo carrera

### `cancelar_turno`

```json
{
  "action": "cancelar_turno",
  "turnoId": "uuid",
  "version": 2,
  "motivo": "Cliente canceló"
}
```

Libera ocupación.

### `reprogramar_turno`

```json
{
  "action": "reprogramar_turno",
  "turnoId": "uuid",
  "inicio": "2026-09-16T15:00:00.000Z",
  "version": 2
}
```

Nueva idempotency-key recomendada por intención.

### `upsert_cliente`

```json
{
  "action": "upsert_cliente",
  "nombre": "Ana",
  "apellido": "Pérez",
  "telefono": "+5493511234567",
  "email": "opcional",
  "documento": "opcional",
  "id": "uuid-opcional"
}
```

Teléfono **E.164 estricto**: `^\+[1-9][0-9]{1,14}$`

### `upsert_vehiculo`

```json
{
  "action": "upsert_vehiculo",
  "patente": "AB123CD",
  "clienteId": "uuid",
  "marca": "Toyota",
  "modelo": "Corolla",
  "anio": 2020,
  "tipoVehiculo": "auto",
  "condicion": "normal",
  "kilometrajeActual": 45000
}
```

### `clasificar_cliente`

```json
{
  "action": "clasificar_cliente",
  "clienteId": "uuid",
  "clasificacion": "vip",
  "intencion": "service",
  "tagsDelta": ["fiel"],
  "scoreReclamosDelta": 0,
  "wahConversationId": "uuid?",
  "fuente": "bot"
}
```

Alternativa panel: `POST /api/v1/clientes/:id/clasificaciones`.

---

## Flujos del bot (Agustina)

Prompt operativo: `.cursor/n8n-agent-system-prompt.txt`

### Agendar (orden estricto)

1. `consultar_contexto_cliente` (telefono sesión) — recomendado
2. Si no hay cliente → pedir nombre/apellido → `upsert_cliente`
3. `consultar_servicios` → elegir servicio
4. Si falta vehículo → patente → `upsert_vehiculo`
5. `consultar_talleres(servicioId)` → sucursal o “lo antes posible”
6. Disponibilidad:
   - vaga → `consultar_proximos_slots`
   - día concreto → `consultar_disponibilidad`
7. Presentar 3–5 opciones **solo de API**
8. Confirmación explícita usuario
9. `crear_turno` sin bahiaId
10. Si 409 → reconsultar slots, **no** afirmar reserva

### Reprogramar / Cancelar

Siempre obtener `turnoId` + `version` vía contexto o `consultar_turno`. Confirmación explícita antes de mutar.

### Catálogo / precios

Usar `modo_precio` del servicio. Nunca inventar cifras en `a_presupuestar`.

### Errores

| Código | Acción bot |
|--------|------------|
| 401 | No reintentar; derivar humano |
| 404 | No encontrado en esta empresa |
| 409 CapacidadConflicto | Reconsultar slots |
| VersionConflicto | GET turno, reintentar |
| HorarioVencido | No ofrecer ese horario |

---

## Integración n8n (plan)

| Pieza | Responsable | Estado |
|-------|-------------|--------|
| Agents API backend | Repo Montironi | ✅ |
| System prompt Agustina | `.cursor/n8n-agent-system-prompt.txt` | ✅ |
| Super-prompt + apéndice | `docs/SUPER_PROMPT_AGENTES.md` | ✅ |
| Workflow n8n Caso 1 | Gabi / infra | 🟡 paralelo |
| Webhook inbound | `WAH_MESSAGE_WEBHOOK_URL` → n8n | Config env |

Tools n8n deben mapear 1:1 a recursos/actions documentados — **no inventar rutas**.

---

## Códigos HTTP resumen

| Status | Significado |
|--------|-------------|
| 200 | OK / IdempotencyReplay |
| 400 | Parámetros faltantes |
| 401 | API key inválida |
| 403 | Empresa no autorizada para key |
| 404 | Recurso no encontrado |
| 409 | Conflicto dominio (capacidad, versión, horario) |
| 422 | Validación / FSM |
| 500 | Error interno |
# Parte 7 — Comunicaciones WhatsApp (WAH)

Módulo de **inbox WhatsApp** compatible con contratos cima-ai. Permite operadores humanos en panel y bots vía integración, con regla **`bot_paused`** cuando interviene una persona.

## Objetivo de producto

1. Centralizar conversaciones WA por cuenta de negocio.
2. Permitir que un empleado responda desde `/comunicaciones`.
3. Permitir que n8n/bot envíe mensajes sin usar el panel.
4. Pausar automáticamente el bot cuando un humano escribe.
5. Recibir inbound Meta y opcionalmente forwardear a n8n.

## Fuente de verdad schema

| Artefacto | Ubicación |
|-----------|-----------|
| DDL oficial Datos | `montironi-turnos-v1/005_comunicaciones_wah.sql` |
| ERD | `montironi-turnos-v1/ERD_COMUNICACIONES.md` |
| Migración Prisma | `20260911182000_wah_comunicaciones_005` |
| Referencia cima-ai | `docs/wah-source-reference/` |

**Tenancy:** Montironi usa `empresa_id` (UUID FK), no `tenant_id`.

## Modelo de datos

| Tabla | Propósito |
|-------|-----------|
| `whatsapp_accounts` | Cuentas WA por empresa (`phone_number_id` Meta) |
| `wah_conversations` | Thread por contacto + cuenta; flags `bot_paused`, `pending_human` |
| `wah_messages` | Mensajes inbound/outbound, `wamid`, status Meta |
| `wah_media` | Archivos adjuntos (CASCADE desde message) |

Relaciones clave:

- Conversación opcionalmente vinculada a `cliente_id`
- `wah_conversations.bot_paused` — control central del bot
- Idempotencia inbound por `wamid`

## Autenticación por superficie

| Superficie | Auth |
|------------|------|
| Panel `/api/wah/*` (except integration) | Cookie sesión panel |
| Integración `/api/wah/integration/*` | Header `X-Cima-Forward-Secret` = `CIMA_FORWARD_SECRET` |
| Webhook Meta | Mismo secret en `received-data` |

Comparación timing-safe en `wah/integration-auth.ts`.

## API Panel (humano)

Contrato literal: `docs/COMUNICACIONES_API.md`

### Cuentas y dashboard

```
GET /api/wah/accounts
GET /api/wah/dashboard?accountId=
```

KPIs: total conversaciones, unread, pending, botPaused.

### Conversaciones

```
GET /api/wah/conversations?accountId=&filter=all|pending|unread
GET /api/wah/conversations/:id
POST /api/wah/conversations/:id/read
```

Lista incluye preview, unread count, flags bot, cliente vinculado.

### Enviar mensaje humano

```
POST /api/wah/conversations/:id/messages
{ "body": "Texto", "generatedByAi": false }
```

**Comportamiento crítico:** en la misma transacción DB:

1. Persiste mensaje outbound (`senderType` operador)
2. Setea **`bot_paused = true`**

Response incluye `{ "message": {...}, "botPaused": true }`.

### Reanudar bot

```
POST /api/wah/conversations/:id/bot/resume
→ { "botPaused": false }
```

### Media panel

```
GET /api/wah/media/:mediaId
```

Stream binario; aislamiento por `empresa_id`.

## API Integración (bot / n8n)

Canonical paths (preferir sobre aliases legacy):

```
POST /api/wah/integration/send-text
POST /api/wah/integration/send-audio
POST /api/wah/integration/send-file
GET  /api/wah/integration/media/:mediaId?empresa_id=
GET  /api/wah/integration/conversations/:id
```

### send-text (ejemplo)

```json
{
  "empresa_id": "uuid",
  "account_id": "uuid",
  "to": "+5491112345678",
  "text": "Tu turno quedó confirmado…",
  "contact_name": "opcional",
  "conversation_id": "uuid opcional",
  "external_id": "opcional"
}
```

Response: `conversation_id`, `message_id`, `wa_message_id`, objeto `message`.

Schemas Zod: `src/lib/modules/wah/schemas.ts`.

Envío real vía Meta Graph si `META_WHATSAPP_ACCESS_TOKEN` configurado.

## Webhook inbound Meta

```
POST /api/webhooks/whatsapp/received-data
Header: X-Cima-Forward-Secret
Body: payload Meta Cloud API (entry[].changes[].value)
```

Pipeline (`process-webhook.ts`):

1. Resolver cuenta por `metadata.phone_number_id` → 404 si no existe
2. Mensajes: idempotencia `wamid`, persist `wah_messages` + media
3. Normalizar contacto E.164 en `contact_phone` / `wa_contact_id`
4. Status updates Meta → actualizar `wah_messages.status`
5. Si `bot_paused === false` y existe `WAH_MESSAGE_WEBHOOK_URL`:
   - POST forward a n8n con `event: inbound_message`

Response:

```json
{
  "messages": [{ "wamid": "...", "messageId": "uuid", "skipped": false }],
  "statuses": [{ "wamid": "...", "status": "delivered", "updated": 1 }]
}
```

## UI Panel (`/comunicaciones`)

Componentes:

- `WahAccountSwitcher` — multi-cuenta si aplica
- `WahChatPanel` — thread + composer
- `use-wah-api.ts` — cliente SWR para polling/refetch

Flujo operador:

1. Ve conversación unread
2. Responde → bot pausado automáticamente
3. Cuando termina intervención humana → “Reanudar bot”

## Reglas para el bot

1. **Antes de auto-responder:** verificar `bot_paused` (en payload webhook o GET conversación).
2. Si `bot_paused === true` → no enviar; opcional derivar humano.
3. Respuestas por integración `send-text`, no por panel.
4. Teléfonos siempre E.164.

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `CIMA_FORWARD_SECRET` | Auth integración + webhook |
| `META_WHATSAPP_ACCESS_TOKEN` | Graph API envío |
| `WAH_MESSAGE_WEBHOOK_URL` | Forward inbound → n8n |
| `WAH_MEDIA_DIR` | Storage inbound |
| `WAH_SEND_FILES_DIR` | Storage outbound |

## Servicios internos

| Servicio | Archivo |
|----------|---------|
| Cuentas | `wah/account.service.ts` |
| Conversaciones | `wah/conversation.service.ts` |
| Mensajes | `wah/message.service.ts` |
| Media | `wah/media.service.ts` |
| Meta client | `wah/meta-client.ts` |
| Scope empresa | `wah/scope.ts` |
| Normalización tel | `wah/phone.ts` |

## Tests

| Archivo | Cobertura |
|---------|-----------|
| `tests/integration/wah.test.ts` | Flujos panel + integración |
| `tests/integration/whatsapp-webhook.test.ts` | Inbound Meta |
| `tests/integration/wah-accounts.test.ts` | Cuentas |
| `tests/unit/wah-integration-auth.test.ts` | Secret validation |
| `tests/unit/wah-account.test.ts` | Account service |

QA smoke reports: `qa-wah-*.md` en raíz repo.

## Migraciones y deuda

Ver `MIGRATIONS_LINEA_UNICA.md`: históricamente hubo linajes WAH superpuestos en QA; objetivo es **una sola migración 005** alineada al box Datos.

No reescribir SQL 005 desde spec de agente — copiar verbatim desde shared box con header `★ FUENTE OFICIAL`.
# Parte 8 — Clientes, historial y buyer

CRM **ligero** integrado con agenda y bot: clientes, vehículos, historial de services realizados y perfil comercial (“buyer”) para personalización del agente IA.

## Clientes y vehículos

### Tablas principales

| Tabla | Propósito |
|-------|-----------|
| `cliente` | Persona; UNIQUE `(empresa_id, telefono)` activos |
| `vehiculo` | Patente única por empresa |
| `cliente_vehiculo` | N:M cliente ↔ vehículo |
| `documento_cliente` | Documentos adjuntos (V1.1) |

### Validación teléfono

Módulo `customers/validation.ts`:

- Formato **E.164** obligatorio en APIs
- Error `ValidacionCliente` (422) si inválido
- Índice: `ix_cliente_empresa_telefono` con `activo IS TRUE` (mapeo spec Datos `deleted_at IS NULL`)

### Contexto cliente

Funciones en `customers/service.ts` y `customers/application/get-cliente-context.ts`:

| Endpoint | Uso |
|----------|-----|
| `GET /api/v1/clientes/context?telefono=` | Panel / integraciones |
| `GET /api/v1/clientes/{id}/context` | Por UUID |
| `GET /api/agents/context` | Bot — shape enriquecido DDL 007 |
| `GET /api/agents?resource=cliente` | Legacy plano |

Contexto incluye:

- Datos cliente
- Vehículos con km, condición, tipo
- Turnos programados y recientes
- `proximosServicios` por intervalos km
- `atencion_actual` / estado vehículo en taller
- Buyer profile + historial (post-007)

### Upsert vía Agents API

- `upsert_cliente` — nombre, apellido, teléfono mínimos
- `upsert_vehiculo` — patente + `clienteId`

Misma persistencia que panel; tenancy por `empresaId` del API key.

### Panel CRUD

Pantallas bajo `/clientes/*` — ver [Parte 5 — Panel web](#parte-5--panel-web-empleados).

Server actions → `customers/service.ts` → Prisma. **Nunca** estado React como fuente de verdad.

---

## Historial de servicios (DDL 007)

Fuente SQL: `montironi-turnos-v1/007_historial_y_buyer.sql`  
Migración: `20260911200700_historial_y_buyer`

### Tabla `historial_servicio`

Snapshot **inmutable por línea de detalle** cuando el turno pasa a `finalizado`.

| Campo | Origen |
|-------|--------|
| `detalle_turno_id` | UNIQUE — una fila por línea |
| `servicio_nombre`, `tipo_servicio_nombre`, `taller_nombre` | Snapshots |
| `realizado_en` | Timestamp finalización |
| `kilometraje_km` | `turno.kilometraje` |
| `duracion_minutos`, `precio`, `moneda` | Desde detalle |
| `resultado` | ej. `realizado` |
| `turno_id`, `vehiculo_id`, `cliente_id` | FKs |

### Flujo al finalizar turno

En la **misma transacción** que:

- Transición a `finalizado`
- Actualización km vehículo
- Liberar `ocupacion_bahia`
- Registrar movimiento

Se ejecuta `upsertHistorialDesdeTurnoFinalizado(turnoId, tx)`:

- INSERT por cada `detalle_turno`
- ON CONFLICT (`detalle_turno_id`) DO UPDATE snapshots

Implementación: `historial/service.ts`.

### Backfill histórico

```bash
npm run db:backfill-historial
# EMPRESA_ID=<uuid> npm run db:backfill-historial
```

Idempotente — omite turnos ya backfilled.

---

## Perfil buyer (DDL 007)

### Tabla `cliente_perfil_buyer`

UNIQUE `cliente_id`. Campos típicos:

| Campo | Uso bot |
|-------|---------|
| `tags` | Array mergeable (`fiel`, `reclamo`, etc.) |
| `intencionPredominante` | service, reclamo, … |
| `perfilBuyer` | Segmento comercial |
| `scoreReclamos` | Acumulado |
| `ultimaClasificacion` | vip, standard, … |
| `wahConversationId` | Link conversación activa |
| `metadata` | JSON extensible |

### Tabla `cliente_clasificacion_evento`

Auditoría append-only de cada clasificación:

- `fuente`: bot | humano | sistema | integracion
- Deltas tags/score
- Referencias WA opcionales

### API clasificación

```json
POST /api/v1/clientes/:id/clasificaciones
POST /api/agents { "action": "clasificar_cliente", ... }
```

Body ejemplo:

```json
{
  "clasificacion": "vip",
  "intencion": "service",
  "tagsDelta": ["fiel"],
  "scoreReclamosDelta": 0,
  "wahConversationId": "uuid?",
  "fuente": "bot"
}
```

→ INSERT evento + UPSERT perfil (merge tags, score += delta).

Servicio: `buyer/service.ts`.

---

## Consumo en bot

`GET /api/agents/context` devuelve en un solo payload:

```json
{
  "cliente": { ... },
  "vehiculos": [ ... ],
  "turnos": { "programados": [], "realizados": [] },
  "buyer_profile": { ... },
  "historial_services": [ ... ],
  "meta": { "partial": false, "missing": [], "lookup": "telefono" }
}
```

Aliases retrocompat: `perfilBuyer`, `ultimosServices`.

Uso recomendado Agustina:

1. Al inicio de chat → context por teléfono WA
2. Personalizar tono si `scoreReclamos` alto
3. Sugerir service según `proximosServicios` e historial
4. Tras interacción significativa → `clasificar_cliente`

---

## Intervalos km (relacionado)

Tabla `servicio_intervalo_km`:

- UNIQUE `(servicio_id, tipo_vehiculo, condicion)`
- Columna `condicion` enum `condicion_vehiculo` (hotfix 006 renombró legacy)

Alimenta `proximosServicios` en contexto vehículo.

Panel admin edita en `/servicios` vía `intervalo.service.ts` / `upsertIntervaloKm`.

---

## Tests

| Archivo | Qué verifica |
|---------|--------------|
| `tests/integration/historial-buyer.test.ts` | Finalizar → historial, clasificar |
| `tests/integration/agents-cliente.test.ts` | Context agents |
| `tests/integration/slice2-context-lookups.test.ts` | Lookups telefono/wa_id |
| `tests/integration/v11.test.ts` | Clientes/vehículos V1.1 |

QA dedicado: `qa-007-historial-buyer.md`.

---

## Privacidad y límites V1

- Bot **no** debe pedir DNI salvo necesidad operativa explícita del taller.
- **No** tarjetas ni datos financieros.
- Tenancy: historial y buyer scoped a `empresa_id`; 404 cross-tenant.
# Parte 9 — Catálogo y disponibilidad

Gestión de **servicios**, **talleres**, **bahías** y cálculo de **slots libres**. Regla central: el catálogo debe estar **ofertado** en talleres y bahías para aparecer al crear turnos.

## Entidades de catálogo

```
tipo_servicio (Mecánica, Chapa, …)
    └── servicio (duración, precio, modo_precio)
            ├── taller_servicio  (oferta en taller)
            └── bahia_servicio   (compatibilidad bahía)

taller
    ├── bahia
    ├── patron_horario → franja_horaria
    └── excepcion_horario (cierres, horarios especiales)

configuracion_turnos (margen_minutos global empresa)
```

## Servicios

### Campos relevantes

| Campo | Descripción |
|-------|-------------|
| `nombre`, `descripcion` | UI y bot |
| `duracion_min` | Minutos ocupación |
| `precio`, `modo_precio` | Informativo V1 |
| `tipo_servicio_id` | Agrupación |
| `activo` | Soft disable |

### Modos de precio

| Enum | Presentación |
|------|--------------|
| `fijo` | Precio referencia |
| `desde` | “Desde $X” |
| `a_presupuestar` | Sin cifra fija |

### Alta de servicio (regla concordancia)

**Incorrecto:** solo `prisma.servicio.create`.

**Correcto:** usar `createServicio` / pipeline que incluye `offerServicioInEmpresa`:

- Inserta `taller_servicio` para cada taller activo
- Inserta `bahia_servicio` para cada bahía activa

Implementación: `catalog/service.ts`, `catalog/oferta.ts`.

Tras write: `revalidateDomainSurfaces([], "catalogo")` — afecta `/servicios`, `/turnos/nuevo`, `/agenda`, `/bahias`, Agents API.

### Intervalos km

Tabla `servicio_intervalo_km`:

- Por `servicio_id + tipo_vehiculo + condicion`
- Define cada cuántos km corresponde el service
- Panel: `IntervaloKmFields.tsx`, `intervalo.service.ts`
- Persistencia: `upsertIntervaloKm` / `saveIntervaloAction`

---

## Talleres y horarios

### Dirección

Campos desglosados (`calle`, `numero`, `localidad`, `provincia`, `codigo_postal`) + helper `catalog/direccion.ts`.

### Patrones y franjas

- `patron_horario` — por día semana (`dia_semana` enum)
- `franja_horaria` — ventanas `inicio`/`fin` time
- `excepcion_horario` — fecha específica: `cerrado` o `horario_especial`

### Cambios de horario (V1.1)

`cambio_horario` con workflow borrador → confirmado para cambios planificados.

Panel: `/taller/[id]` forms `TallerHorarioForm`, `TallerExcepcionForm`.

---

## Bahías

Recurso físico de atención dentro de un taller.

- Compatibilidad servicios vía `bahia_servicio`
- Panel admin: `/bahias`, `bahia.service.ts`
- API: `GET /api/v1/talleres/{id}/bahias`

Un turno ocupa **una** bahía durante su periodo.

---

## Disponibilidad (cálculo)

Módulo: `availability/service.ts`

**No existe tabla de “slots libres”.** Los huecos se calculan:

1. Obtener horario efectivo del taller para la fecha (patrones − excepciones).
2. Obtener duración total requerida (sum servicios + margen).
3. Listar bahías compatibles con servicios solicitados.
4. Restar periodos de `ocupacion_bahia` activa (turnos + bloqueos).
5. Generar ventanas discretas según granularidad configurada.

Funciones exportadas:

| Función | Uso |
|---------|-----|
| `getAvailabilityForDate` | API v1 disponibilidad |
| `getTallerScheduleForDate` | Horario del día |
| `aggregateVentanas` | Agrupa ventanas continuas |
| `proximosSlots` | Agents — N próximos huecos cross-fecha |

### Agents: proximos_slots vs disponibilidad

| Recurso | Cuándo usar |
|---------|-------------|
| `proximos_slots` | “Lo antes posible”, preferencia vaga |
| `disponibilidad` | “El martes”, “por la tarde” (fecha fija) |

Parámetros proximos_slots:

- `servicioId` requerido
- `tallerId` opcional
- `limite` default 5, max 20
- `desde` ISO opcional

### DTO Agents servicios

`catalog/servicio-agents.ts`:

```typescript
{
  id, nombre, descripcion, tipo,
  duracion_minutos, precio, moneda: "ARS",
  modo_precio: "fijo" | "desde" | "a_presupuestar"
}
```

Endpoints:

- `GET /api/agents?resource=servicios`
- `GET /api/agents?resource=servicio&id=`

Tests: `tests/integration/servicio-agents.test.ts`, `catalog-oferta.test.ts`, `talleres-horario-agents.test.ts`.

---

## Talleres para Agents

`catalog/taller-agents.ts` — `listTalleresForAgents`:

- Filtra activos
- Con `servicioId`: solo talleres con oferta y al menos una bahía compatible

Respuesta incluye localidad para agrupar en bot: *“Tengo talleres en Godoy Cruz y Maipú…”*

---

## Seed de referencia

`prisma/seed.ts` crea:

- Empresa Montironi
- 2 talleres (Centro, Norte) con bahías
- Tipos y servicios demo con oferta completa
- Turnos ejemplo en distintos estados
- Configuración margen

Útil para QA manual y tests integration.

---

## Errores relacionados

| Error | Causa |
|-------|-------|
| `BahiaIncompatible` | Servicio no ofrecido en bahía |
| `FueraDeHorario` | Slot fuera de franja |
| `CapacidadConflicto` | Bahía ocupada |
| 404 en agents servicio | ID inexistente o inactivo |

---

## Checklist operativo catálogo

Al agregar/modificar servicio:

- [ ] Servicio creado con oferta taller/bahía
- [ ] Intervalos km si aplica
- [ ] `revalidateDomainSurfaces` catálogo
- [ ] Verificar listado en `/turnos/nuevo`
- [ ] Verificar `GET /api/agents?resource=servicios`
- [ ] Verificar proximos_slots devuelve huecos
# Parte 10 — Seguridad y tenancy

Montironi Turnos es producto **multi-tenant**: cada fila de negocio pertenece a una `empresa`. La seguridad es **fail-closed** — sin sesión válida no hay panel; sin credencial correcta no hay API.

Documentación detallada adicional en repo:

- `docs/SECURITY_AUTH_GATE.md` (B5)
- `docs/SECURITY_SESSIONS.md` (B1+B2)
- `docs/SECURITY_TENANT_ISOLATION.md` (B3)

## Modelo de tenancy

```
empresa (slug: montironi)
  ├── usuarios
  ├── clientes, vehículos, turnos, …
  ├── whatsapp_accounts
  └── operacion_api (idempotency scoped)
```

**Regla:** toda query/mutación incluye `empresaId` del actor. Nunca confiar en UUID del body sin verificar ownership.

Tests: `tests/integration/tenant-isolation.test.ts`, `tenant-isolation-qa-extra.test.ts`, `tenant-config-get-idor.test.ts`.

---

## Capa 1: Middleware Edge

Archivo: `src/middleware.ts`

| Verifica | No verifica |
|----------|-------------|
| Presencia cookie `montironi_session` | Validez sesión DB |
| Security headers | Rol usuario |

Headers en todas las respuestas:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Paths públicos (sin cookie)

- `/`, `/login`
- `/api/agents`, `/api/agents/*`
- `/api/wah/integration/*`
- `/api/webhooks/*`
- `/api/v1/jobs/*` (auth dentro del handler)
- Assets estáticos `/_next/*`, favicons

**Todo lo demás** requiere cookie en Edge, incluido `/api/v1/*` excepto jobs.

Nuevas rutas bajo `(panel)` quedan protegidas automáticamente.

---

## Capa 2: Gate Node (sesión panel)

Archivos: `src/lib/auth/guards.ts`, `src/lib/auth/access.ts`, `src/lib/auth/session/*`

| Función | Uso |
|---------|-----|
| `requireSession()` | API/panel — valida sesión en tabla `sesion` |
| `requireAdmin()` | Rutas admin-only |
| `assertPanelAccess(path, rol)` | Matriz ruta ↔ rol |

### Sesiones server-side (B1)

Tabla `sesion`:

- `expiresAt`, `revokedAt`, `lastSeenAt`
- Cookie iron-session referencia `sessionId`
- Logout revoca fila
- Cleanup: `npm run sessions:cleanup`

Tests: `tests/integration/session.test.ts`, `tests/unit/middleware-auth-gate.test.ts`.

### Matriz roles V1

| Rol | Acceso |
|-----|--------|
| `empleado` | Agenda, clientes, turnos, comunicaciones |
| `admin` | Todo empleado + servicios, bahías, taller, config, movimientos, usuarios |
| `operador`, `asesor`, otros | **403** |

### Mapping HTTP

| Condición | UI | API |
|-----------|-----|-----|
| Sin sesión inválida | Redirect `/login` | 401 `UNAUTHORIZED` |
| Sesión OK, rol insuficiente | Redirect `/agenda` | 403 |

---

## Agents API

Archivo: `agents-api/idempotency.ts`

- Header `x-api-key` === `AGENT_API_KEY`
- `resolveAgentEmpresa`: header `x-empresa` slug debe estar autorizado para la key (`AGENT_API_EMPRESA`)
- 403 si empresa no coincide

Sin cookie. Validación completa en handler Node.

---

## WAH integración y webhooks

Archivo: `wah/integration-auth.ts`

- Header `X-Cima-Forward-Secret` timing-safe compare vs `CIMA_FORWARD_SECRET`
- 401 si mismatch

Aplica a:

- `/api/wah/integration/*`
- `/api/webhooks/whatsapp/received-data`

Panel WAH usa sesión cookie + scope `empresa_id` en queries.

---

## Cron / jobs

`POST /api/v1/jobs/vencer-pendientes`:

- Auth: `x-api-key` (= `AGENT_API_KEY` hoy) **o** sesión admin
- Excepción AppSec-approved en Edge para prefix `/api/v1/jobs/*`

**Follow-up B7:** separar `CRON_API_KEY` de `AGENT_API_KEY` para reducir blast radius.

---

## Idempotencia y abuse

- `operacion_api` UNIQUE por empresa + key — evita replay cross-tenant
- Sesiones: revocación, expiración, no extender indefinidamente
- QA session abuse: `qa-session-abuse-post-pr5.md`

---

## Aislamiento IDOR

Patrones seguros:

```typescript
// ✅ GOOD
await prisma.turno.findFirst({
  where: { id: turnoId, empresaId: session.empresaId },
});

// ❌ BAD
await prisma.turno.findUnique({ where: { id: turnoId } });
```

Revisión B3 PR6 en `_sec_b3_pr6_review/`. Config GET endpoints testeados contra IDOR.

---

## Superficies y credenciales resumen

| Superficie | Credencial | Scope |
|------------|------------|-------|
| Panel | Cookie sesión | `empresa_id` del usuario |
| Agents API | `x-api-key` | Empresa configurada |
| WAH integration | `X-Cima-Forward-Secret` | `empresa_id` en body/query |
| Webhook Meta | Forward secret | Lookup cuenta → empresa |
| Cron job | `x-api-key` | Opcional `x-empresa` |

**Nunca** hardcodear secrets en prompts públicos — usar placeholders `{{AGENT_API_KEY}}`.

---

## Checklist seguridad pre-release

- [ ] `SESSION_SECRET` y `AGENT_API_KEY` fuertes en prod
- [ ] `CIMA_FORWARD_SECRET` distinto por entorno
- [ ] Middleware activo en deploy Edge
- [ ] Tests tenant isolation verdes
- [ ] Roles desconocidos denegados
- [ ] Media WAH no filtra cross-empresa
- [ ] Agents API 401/403 sin filtrar datos
# Parte 11 — Base de datos y migraciones

PostgreSQL es la **única fuente de verdad**. Prisma mapea el schema; las migraciones SQL en `prisma/migrations/` son autoritativas para deploy.

## Conexión desarrollo

```
postgresql://montironi:montironi@localhost:5433/montironi_turnos
```

Docker Compose expone puerto **5433**. Ver `.env.example`.

## Extensiones requeridas

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

`btree_gist` necesario para EXCLUDE en `ocupacion_bahia`.

## Cadena de migraciones Prisma (objetivo)

| Timestamp | Nombre | Contenido |
|-----------|--------|-----------|
| `20260911152000` | `authoritative_init` | Schema V1 core: empresa, turnos, ocupación, catálogo, calendario |
| `20260911170000` | `v11_clients_vehicles_movimientos` | Clientes extendido, movimientos audit |
| `20260911182000` | `wah_comunicaciones_005` | Tablas WhatsApp (alineado box 005) |
| `20260911200700` | `historial_y_buyer` | DDL 007 historial + buyer |
| `20260911225000` | `sesion_server_side` | Tabla sesiones |
| `20260914140000` | `talleres_horario_agents` | Ajustes horarios / agents talleres |

Comando deploy sin reset:

```bash
npm run db:setup   # migrate deploy + seed
```

Desarrollo con reset:

```bash
npx prisma migrate reset --force
```

## Inventario de tablas (Prisma models)

| Modelo | Tabla SQL | Dominio |
|--------|-----------|---------|
| Empresa | `empresa` | Tenant root |
| Usuario | `usuario` | Panel users |
| Sesion | `sesion` | Auth server-side |
| Taller | `taller` | Sucursales |
| Bahia | `bahia` | Recursos físicos |
| TipoServicio | `tipo_servicio` | Agrupación catálogo |
| Servicio | `servicio` | Servicios |
| TallerServicio | `taller_servicio` | Oferta |
| BahiaServicio | `bahia_servicio` | Compatibilidad |
| PatronHorario | `patron_horario` | Horarios |
| FranjaHoraria | `franja_horaria` | Ventanas |
| ExcepcionHorario | `excepcion_horario` | Cierres especiales |
| ConfiguracionTurnos | `configuracion_turnos` | Margen global |
| CambioHorario | `cambio_horario` | Cambios planificados |
| Cliente | `cliente` | CRM |
| Vehiculo | `vehiculo` | Flota |
| ClienteVehiculo | `cliente_vehiculo` | N:M |
| DocumentoCliente | `documento_cliente` | Adjuntos |
| ServicioIntervaloKm | `servicio_intervalo_km` | Intervalos km |
| Turno | `turno` | Turnos |
| DetalleTurno | `detalle_turno` | Líneas servicio |
| OcupacionBahia | `ocupacion_bahia` | Capacidad |
| EventoTurno | `evento_turno` | Audit FSM |
| OperacionApi | `operacion_api` | Idempotency |
| Movimiento | `movimiento` | Audit general |
| WhatsappAccount | `whatsapp_accounts` | WA |
| WahConversation | `wah_conversations` | Inbox |
| WahMessage | `wah_messages` | Mensajes |
| WahMedia | `wah_media` | Archivos |
| HistorialServicio | `historial_servicio` | DDL 007 |
| ClientePerfilBuyer | `cliente_perfil_buyer` | DDL 007 |
| ClienteClasificacionEvento | `cliente_clasificacion_evento` | DDL 007 |

## Enums principales

| Enum PostgreSQL | Valores |
|-----------------|---------|
| `estado_turno` | pendiente, confirmado, recibido, en_servicio, finalizado, cancelado, ausente, vencido |
| `canal_turno` | web, telefono, whatsapp, interno, agente_ia |
| `tipo_ocupacion` | turno, bloqueo |
| `rol_usuario` | admin, operador, asesor, empleado |
| `modo_precio` | fijo, desde, a_presupuestar |
| `tipo_vehiculo` | auto, camioneta |
| `condicion_vehiculo` | nuevo, normal, viejo |
| `estado_calendario` | disponible, bloqueado, cerrado |

## Constraints críticos

### Ocupación anti-solape

```sql
EXCLUDE USING gist (bahia_id WITH =, periodo WITH &&) WHERE (activo)
```

### Idempotencia

```sql
UNIQUE (empresa_id, idempotency_key)  -- operacion_api
```

### Historial

```sql
UNIQUE (detalle_turno_id)  -- historial_servicio
```

### Cliente teléfono

Índice parcial activos por empresa (ver DDL 007 / Prisma).

## DDL externos (Datos shared box)

Directorio `montironi-turnos-v1/` — **no reescribir desde agente**:

| Archivo | md5 esperado | Propósito |
|---------|--------------|-----------|
| `005_comunicaciones_wah.sql` | `6f528869649dbbb4a4ef1782e6ee18b5` | WAH oficial ★ FUENTE OFICIAL |
| `006_fix_intervalo_condicion.sql` | `9cecaf43d8145ca46029a1d5f1d37d83` | Hotfix columna `condicion` |
| `007_historial_y_buyer.sql` | (en migración Prisma) | Historial + buyer |

Validación:

```bash
bash scripts/validate-datos-005.sh
bash scripts/validate-datos-006.sh
```

Ver `montironi-turnos-v1/README.md`, `EXPECTED.md`.

## Línea única migraciones (deuda resuelta / monitoreo)

Documento `MIGRATIONS_LINEA_UNICA.md` describe problema histórico:

- Linajes WAH superpuestos (80000 + 81000) en QA
- Columna `condicion_vehiculo` vs `condicion` en intervalos
- Objetivo: **una** migración WAH = box 005

Hotfix QA DB sucia:

```bash
psql ... -f montironi-turnos-v1/006_fix_intervalo_condicion.sql
```

## Seed

`prisma/seed.ts`:

- Idempotente en espíritu para dev (`migrate reset` limpia todo)
- Empresa Montironi, admin + empleado
- Talleres Centro/Norte, bahías, servicios con oferta
- Turnos demo, config margen
- Opcional WAH demo según env

```bash
npm run db:seed
```

## Scripts DB

| Comando | Acción |
|---------|--------|
| `npm run db:generate` | prisma generate |
| `npm run db:migrate` | migrate dev |
| `npm run db:setup` | deploy + seed |
| `npm run db:backfill-historial` | Backfill historial_servicio |

## Naming V1.1 cerrado

| Tabla | Columna | Tipo |
|-------|---------|------|
| vehiculo | `condicion` | `condicion_vehiculo` |
| servicio_intervalo_km | `condicion` | `condicion_vehiculo` |

Follow-up opcional Datos: `empresa_id` en `servicio_intervalo_km`.

## PKs y UUIDs

Todas las PKs UUID v4 via `gen_random_uuid()` (extensión pgcrypto).

## Backup y prod

Fuera del repo V1 — recomendaciones:

- Migrar con `prisma migrate deploy` en CI/CD
- No usar `migrate reset` en prod
- Job cron externo para `vencer-pendientes`
- Rotar secrets (`SESSION_SECRET`, `AGENT_API_KEY`, `CIMA_FORWARD_SECRET`)
# Parte 12 — Roadmap y pendientes

Qué **planeamos** pero aún no está completo, deuda técnica conocida, y siguientes pasos sugeridos.

## Estado por iniciativa

| Iniciativa | Planificado | Desarrollado | Pendiente |
|------------|:-----------:|:------------:|-----------|
| Agenda + capacidad V1 | ✅ | ✅ | — |
| Panel empleados/admin | ✅ | ✅ | Refactors UI menores |
| Agents API completa | ✅ | ✅ | — |
| WAH inbox + integración | ✅ | ✅ | Deploy prod Meta |
| Historial + buyer (007) | ✅ | ✅ | — |
| Sesiones + auth gate (B1–B5) | ✅ | ✅ | CRON key separada (B7) |
| Bot n8n Agustina Caso 1 | ✅ | 🟡 | Workflow prod Gabi |
| Multi-empresa SaaS | ⏳ V2+ | ❌ | Onboarding, billing |
| Admin prompts agentes | ⏳ | ❌ | Panel plantillas versionadas |
| Multi-bahía por turno | ⏳ | ❌ | Fuera alcance V1 |
| Merge clientes duplicados | ⏳ | ❌ | Manual V1 |

---

## Bot n8n (Caso 1) — en paralelo

**Listo en repo:**

- Agents API lectura/escritura
- `/api/agents/context`
- WAH send-text + webhook inbound forward
- Prompt `.cursor/n8n-agent-system-prompt.txt`
- `docs/SUPER_PROMPT_AGENTES.md`

**Pendiente infra/orquestación:**

- Workflow n8n con tools HTTP mapeadas
- Variables entorno n8n (`MONTIRONI_BASE_URL`, keys)
- Conectar `WAH_MESSAGE_WEBHOOK_URL` al trigger n8n
- QA conversacional end-to-end en WhatsApp real
- Coordinación: Emi PO · Gabi n8n

---

## Seguridad — follow-ups

| Item | Ticket | Descripción |
|------|--------|-------------|
| CRON_API_KEY separada | B7 | No reutilizar `AGENT_API_KEY` en jobs |
| Rate limiting Agents API | — | No implementado V1 |
| Rotación secrets documentada | — | Runbook ops |

---

## Frontend — deuda SOLID

Audit: `docs/FRONTEND_CLEAN_CODE_AUDIT.md`

| Item | Prioridad | Estado |
|------|-----------|--------|
| Split `NuevoTurnoForm.tsx` | Media | Deferred |
| Extract `AgendaGrid` layout math | Baja | Deferred |
| Sidebar icons → componentes | Baja | Deferred |
| `servicios/page.tsx` extraction | Media | Deferred |
| Unificar clases form (`input-field`) | Baja | Deferred |
| Remover/wire `TurnoCard.tsx` dead code | Baja | Deferred |

**Hecho (PRs #10–#15):** `useActionTransition`, `AgendaFilters`, `AvailabilitySlotsPanel`, `ClienteCoreFields`, `getProximosKmForTurno`.

Errores TS pre-existentes mencionados en audit: `buyer/service.ts`, `intervalo.service.ts` — revisar en PR dedicado.

---

## Base de datos

| Item | Estado |
|------|--------|
| Línea única migraciones WAH | Monitorear en deploys QA |
| Hotfix 006 condicion | Script listo para DBs sucias |
| `empresa_id` en intervalo_km | Opcional follow-up Datos |
| Squash migraciones históricas | Solo si PO aprueba en branch limpio |

---

## Producto — fuera alcance V1 (no iniciar sin PO)

1. **Panel configuración agentes** — prompts versionados, A/B, métricas bot.
2. **Planificación multi-etapa** — un turno ocupando bahías secuenciales.
3. **Fusión automática clientes** — dedup por teléfono/patente con merge UI.
4. **Roles operador/asesor** — permisos y UX específicos.
5. **Multi-empresa self-service** — registro, subdomain, aislamiento ops.
6. **Pagos / presupuestos formales** — más allá de `a_presupuestar` informativo.
7. **Notificaciones push/SMS** — solo WA en scope actual.
8. **Reporting / BI** — exportaciones, dashboards gerenciales.

---

## QA pendiente / regresión

Reports en raíz `qa-*.md` — usar como checklist release:

| Report | Área |
|--------|------|
| `qa-wah-*` | WhatsApp smoke |
| `qa-b3-tenant-isolation` | Tenancy |
| `qa-b5-auth-gate` | Middleware |
| `qa-007-historial-buyer` | DDL 007 |
| `qa-session-*` | Sesiones |
| `qa-solid-slice*` | Refactors frontend |
| `qa-fe-clean-code-*` | UI |

Automatizado: mantener `npm run test` verde en CI.

---

## Mejoras sugeridas próximo sprint

### P0 (valor operativo inmediato)

1. Desplegar workflow n8n Caso 1 en staging con smoke conversacional.
2. Verificar `WAH_MESSAGE_WEBHOOK_URL` + Meta token en entorno staging.
3. Separar `CRON_API_KEY` (B7).

### P1 (calidad)

1. Completar split `NuevoTurnoForm` (mantenibilidad).
2. Documentar runbook deploy prod (migraciones, secrets, cron).
3. Monitoreo job `vencer-pendientes` (alerta si no corre).

### P2 (producto)

1. Panel básico clasificación buyer (humano edita tags).
2. Métricas dashboard WAH (tiempos respuesta bot vs humano).
3. Export CSV movimientos / turnos.

---

## Criterios de “V1 done” (propuesta)

- [ ] Empleado puede operar día completo solo con panel
- [ ] Bot puede agendar/reprogramar/cancelar sin conflictos de capacidad
- [ ] Humano puede tomar conversación WA sin interferencia bot
- [ ] Context API alimenta personalización básica
- [ ] Tests integration críticos verdes
- [ ] Tenant isolation verificado
- [ ] Migraciones deploy limpias en DB fresca
- [ ] Documentación `.docs/` + contratos `docs/` al día

---

## Referencias de planificación originales

| Documento | Contenido |
|-----------|-----------|
| Backlog P0 MT-P0-01…06 | Referenciado en DOMAIN_SERVICES |
| `COMUNICACIONES_PLAN.md` | Índice WAH |
| `montironi-turnos-v1/ERD_*.md` | ERDs Datos |
| `.cursor/rules/*.mdc` | Reglas persistencia y catálogo |
| Agent transcripts | Decisiones PO en chats previos |

Para cambios de alcance, la fuente de decisión es **Producto (Emi)** — esta doc refleja estado técnico, no compromiso comercial.
