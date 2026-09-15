# Guía de consumo para agentes IA (montironi-turnos)

Documento operativo para bots, n8n y orquestadores que **consultan y mutan** la agenda de postventa. Fuente de verdad: código + tests + `prisma/schema.prisma`. Si un contrato no está en esos lugares, está marcado `NO CONFIRMADO`.

**Canónico para agentes:** este archivo.  
Docs internas (`README.md`, `docs/AGENTS_CONTEXT_API.md`, `docs/DOMAIN_SERVICES.md`, `docs/COMUNICACIONES_API.md`) son pista; donde divergen, gana este documento.

---

## 0. Cómo leer este documento

### Glosario

| Término | Significado en este repo |
|---|---|
| **empresa** | Tenant. Tabla `empresa`. Se resuelve por slug (`x-empresa`, default `montironi`) o por `sesion.empresaId`. |
| **taller** | Sede física. Tiene bahías, patrón horario, `configuracion_turnos.margen_minutos`. |
| **bahía** | Recurso de capacidad. Un turno ocupa **una** bahía en un intervalo. Compatibilidad con servicios vía `bahia_servicio`. |
| **ocupación** | Fila en `ocupacion_bahia`. Fuente de verdad de capacidad. `activo=true` + EXCLUDE GiST impide solapes. Tipos: `turno` \| `bloqueo`. |
| **turno** | Reserva de agenda (`turno`). Estados FSM en enum `estado_turno`. Tiene `version` (optimistic locking). |
| **detalle** | `detalle_turno`: servicios del turno con snapshots (`nombre_snapshot`, `duracion_min`, `precio_snapshot`, `modo_precio_snapshot`). |
| **hold** | `ocupacion_bahia` activa `tipo=turno` insertada al **crear** (pendiente o confirmado). No es una tabla aparte. |
| **buyer** | `cliente_perfil_buyer`: tags, intención, score de reclamos, última clasificación. Writable vía `clasificar_cliente`. |
| **historial_servicio** | Snapshot por `detalle_turno` al **finalizar**. Solo lectura para agentes. UNIQUE `detalle_turno_id`. |
| **canal** | Enum `canal_turno`: `web` \| `telefono` \| `whatsapp` \| `interno` \| `agente_ia`. Canónico en body. |
| **origen** | Alias legacy de `canal`. Se mapea en `resolveCanal`. No es un campo Prisma. |
| **idempotency replay** | Misma `idempotency-key` + misma huella SHA-256 del body → 200 con la respuesta cacheada y `idempotencyReplay: true`. |
| **version** | Entero en `turno.version` (default 1). Cada mutación de estado/reprogramación hace `version++`. |

### Convenciones

| Tema | Contrato real |
|---|---|
| **Timezone** | `NO CONFIRMADO` TZ de producción. No hay `TZ` en `.env.example`. El código usa `Date` nativo + `date-fns` (`startOfDay`, `parseISO`) en TZ **del proceso Node**. Persistencia: `timestamptz`. |
| **Fecha date-only** | Query `fecha` = `YYYY-MM-DD`. En v1: `startOfDay(parseISO(fecha))`. En Agents GET `resource=disponibilidad`: `new Date(fecha)` (sin `startOfDay`/`parseISO`) — **divergencia**. |
| **Fecha/hora de turno** | ISO-8601 parseable por `new Date(...)`. `inicio` y `finaliza_en` se serializan como ISO en JSON. |
| **Teléfono** | E.164: `^\+[1-9]\d{7,14}$` (`normalizeTelefonoE164`). Lookup WAH `wa_id` se normaliza con `waIdToE164` (más permisivo; no valida el regex E.164 estricto). |
| **UUIDs** | PKs `gen_random_uuid()`. Path params y FKs son UUID string. WAH integration Zod exige `.uuid()` en `empresa_id` / `account_id` / `conversation_id`. Agents/v1 agenda **no** validan formato UUID con Zod. |
| **Slug `x-empresa`** | Header. Default `"montironi"` si falta. Slug inexistente → **404** `{ error: "Empresa no encontrada" }` (Agents; sin `code`). |
| **JSON** | `Content-Type: application/json` en POST/PATCH. Prisma `Decimal` (precios) se serializa como string en JSON. `Date` → ISO string. |

### Sesgo de producto (verificado en código)

- Consultar disponibilidad **no reserva** (`READ_ONLY_AVAILABILITY`; test `tests/unit/occupation.test.ts`).
- Crear turno (pendiente **o** confirmado) **sí** inserta `ocupacion_bahia` activa `tipo=turno`.
- Confirmar **mantiene** ocupación; cancelar / ausente / vencido / finalizado **liberan** (`activo=false`).
- Reprogramar con conflicto **mantiene** slot anterior (`CapacidadConflicto`).
- Optimistic locking: `turno.version`. Headers `If-Match` / `x-turno-version` solo en **v1**.
- Única transición automática: `pendiente → vencido` (job `expirePendingTurnos` o side-effect al intentar confirmar un pendiente vencido).

---

## 1. Arquitectura para consumidores

```
HTTP route (src/app/api/**/route.ts)
  → auth de superficie (API key | cookie | X-Cima-Forward-Secret)
  → (opcional) withIdempotency → operacion_api
  → dispatchAgentAction | caso de uso agenda/appointments
  → domain policies / FSM / resolveBahiaAssignment
  → Prisma (turno, ocupacion_bahia, cliente, …)
```

Capas internas (el agente **no** las llama):

| Capa | Path |
|---|---|
| HTTP Agents | `src/app/api/agents/route.ts`, `src/app/api/agents/context/route.ts` |
| Dispatch | `src/lib/modules/agents-api/dispatch.ts` + `actions/*` |
| HTTP v1 | `src/app/api/v1/**` + `src/lib/modules/agenda/api/http.ts` |
| Application | `src/lib/modules/appointments/application/*` (reexport `agenda/application`) |
| Domain | `src/lib/modules/appointments/constants.ts`, `agenda/domain/{policies,invariants,errors}.ts` |
| Persistencia | Prisma + EXCLUDE GiST en `ocupacion_bahia` |

**Fuente de verdad de capacidad:** filas `ocupacion_bahia` con `activo=true`. El estado del turno **no** basta. Constraint PostgreSQL `ocupacion_bahia_no_overlap` (EXCLUDE gist `bahia_id` + `periodo` WHERE activo). Carreras → `CapacidadConflicto` (P2034 o mensaje del constraint).

**Multi-tenant**

1. Agents / jobs con API key: `x-empresa` → `getEmpresaBySlug(slug)` (`src/lib/modules/agents-api/idempotency.ts`). Default slug `montironi`. Si no existe → 404.
2. Panel / v1 (excepto jobs): `requireSession()` → `sesion.empresaId` (DB, no cookie).
3. WAH integration: `empresa_id` UUID en body/query (no slug).
4. Mutaciones de dominio filtran `{ id, empresaId }` (o join equivalente). Cross-tenant → `RecursoNoEncontrado` (404). Tests: `tests/integration/tenant-isolation.test.ts`.
5. **No hay RLS** PostgreSQL (B3 lo deja explícito).

`GET /api/agents/context` también acepta query `empresa` **antes** que `x-empresa`.

---

## 2. Seguridad (fail-closed)

### Superficies — tabla de decisión

| Quiero | Llamo | Auth | Notas |
|---|---|---|---|
| Contexto cliente / buyer / historial | `GET /api/agents/context` | `x-api-key` | Canónico para bots |
| Lookup cliente legacy | `GET /api/agents?resource=cliente` | `x-api-key` | Shape plano, sin `wa_id` |
| Catálogo servicios / disponibilidad / leer turno | `GET /api/agents?resource=…` | `x-api-key` | |
| Crear / cancelar / reprogramar / upsert / clasificar | `POST /api/agents` | `x-api-key` + `idempotency-key` recomendada | |
| Agenda/disponibilidad/turnos/bloqueos del **panel** | `/api/v1/**` (no jobs) | Cookie `montironi_session` | Edge **401** sin cookie. API key **no** alcanza. |
| Vencer pendientes (cron) | `POST /api/v1/jobs/vencer-pendientes` | `x-api-key` **o** sesión admin | Única excepción v1 en Edge |
| Inbox WhatsApp (humano) | `/api/wah/*` (no `integration`) | Cookie sesión | Pausa bot al enviar |
| Enviar WhatsApp (n8n/Cima) | `/api/wah/integration/*` | `X-Cima-Forward-Secret` | No es API de turnos |
| Inbound Meta | `POST /api/webhooks/whatsapp/received-data` | `X-Cima-Forward-Secret` | Forward a n8n si bot no pausado |
| Clasificar vía v1 | `POST /api/v1/clientes/:id/clasificaciones` | Cookie **en Edge** | El handler acepta API key, pero Edge lo bloquea (ver §14) |

### Paths públicos en Edge (`isPublicPath` en `src/lib/auth/access.ts`)

- `/`, `/login`
- `/api/agents`, `/api/agents/*`
- `/api/wah/integration/*`
- `/api/webhooks/*`
- `/api/v1/jobs/*`
- estáticos (`/_next`, favicon, imágenes)

**Todo lo demás** exige cookie `montironi_session` (presencia; no unseal). Sin cookie en `/api/*` → **401** `{ error: "No autorizado", code: "UNAUTHORIZED" }`. En HTML → redirect `/login?from=`.

Confirmado por `tests/unit/middleware-auth-gate.test.ts`: `/api/v1/turnos` sin cookie = 401.

### Headers

| Header | Superficie | Required | Semántica |
|---|---|---|---|
| `x-api-key` | Agents, jobs | sí (Agents); jobs: sí **o** sesión | Valor de `AGENT_API_KEY`. También `Authorization: Bearer <key>` en Agents (`validateAgentApiKey`). |
| `x-empresa` | Agents, jobs (API key) | no | Slug. Default `montironi`. |
| `empresa` (query) | Solo `GET /api/agents/context` | no | Override de slug, **antes** que `x-empresa`. |
| `idempotency-key` | POST Agents y mutaciones v1 | no (recomendado) | UNIQUE `(empresa_id, idempotency_key)`. |
| `If-Match` / `x-turno-version` | Mutaciones v1 de turno | a veces | `parseVersion` — **no** leídos en Agents. |
| `X-Cima-Forward-Secret` | WAH integration + webhooks | sí | Timing-safe vs `CIMA_FORWARD_SECRET`. |
| Cookie `montironi_session` | Panel + `/api/v1/*` (no jobs) + `/api/wah/*` (no integration) | sí (Edge) | iron-session; payload solo `{ sessionId }`. |

### Comparación de secretos

| Secreto | Comparación | Código |
|---|---|---|
| `AGENT_API_KEY` | **No** timing-safe: `key === process.env.AGENT_API_KEY` | `validateAgentApiKey` |
| Jobs `x-api-key` | **No** timing-safe: `apiKey === expectedKey` | `vencer-pendientes/route.ts` |
| `CIMA_FORWARD_SECRET` | **Sí** timing-safe (`timingSafeEqual` + same length) | `verifyCimaForwardSecret` |

Si `AGENT_API_KEY` está vacío/undefined, Agents rechaza (el header nunca iguala). Jobs cae a sesión admin.

### Cookie vs API key

| | Cookie `montironi_session` | `x-api-key` |
|---|---|---|
| Quién | Humano del panel | Máquina (bot/n8n/cron) |
| Qué viaja | `sessionId` opaco (iron-session) | Secret compartido |
| Tenancy | `sesion.empresaId` + `usuario.empresaId` | Slug `x-empresa` |
| Roles | `admin` / `empleado` (DB); `operador`/`asesor` → 403 | Sin rol |
| TTL | Absoluto 12h; idle 45 min | Hasta rotar env |
| Edge | Requerida fuera de paths públicos | Ignorada por Edge |

### Roles

Enum Prisma `rol_usuario`: `admin`, `operador`, `asesor`, `empleado`.  
V1 panel: solo `admin` y `empleado` (`KNOWN_PANEL_ROLES`). `operador` / `asesor` → **deny** (403).

| Rol | Panel | API v1 (con cookie) |
|---|---|---|
| `empleado` | `/agenda`, `/clientes`, `/turnos`, `/comunicaciones` | Mutaciones de turnos/bloqueos/contexto; **no** crear/editar bahías |
| `admin` | lo anterior + `/servicios`, `/bahias`, `/configuracion`, `/movimientos`, `/usuarios` | + `POST .../bahias`, `PATCH .../bahias/:id`, job por sesión |
| `operador`, `asesor` | 403 / redirect | 403 |

### Secretos de entorno (solo nombres)

Obligatorios para un agente de turnos:

- `AGENT_API_KEY`
- `DATABASE_URL` (servidor; el agente no la usa)
- `x-empresa` o default `montironi`

Opcionales / otras superficies:

- `SESSION_SECRET`, `SESSION_COOKIE_SECURE` (panel)
- `CIMA_FORWARD_SECRET` (WAH / webhooks)
- `META_WHATSAPP_ACCESS_TOKEN`
- `WAH_MESSAGE_WEBHOOK_URL` (n8n inbound)
- `WAH_MEDIA_DIR`, `WAH_SEND_FILES_DIR`
- `NEXT_PUBLIC_APP_NAME`, `AUTO_SEED`, `DOCKER_DATABASE_URL`

**No existe** `CRON_API_KEY` (deuda B7). El job reutiliza `AGENT_API_KEY`.

### Aislamiento de tenant (agente)

1. Slug → una `empresa.id`.
2. Todas las queries de dominio incluyen `empresaId`.
3. `upsert_cliente` con `id` de otra empresa → 404 `RecursoNoEncontrado`.
4. `crear_turno` con taller/cliente/vehículo de otra empresa → 404 `RecursoNoEncontrado`.
5. Idempotency UNIQUE es por `(empresa_id, key)`: la misma key en otra empresa **no** es replay.

### Superficies que un agente de turnos **no** debe llamar

- HTML del panel (`/agenda`, `/login`, `/clientes`, …)
- `/api/v1/*` con solo API key (Edge 401), **excepto** jobs
- `/api/wah/media/*` (binario, cookie)
- `/api/wah/conversations/*` (inbox humano; enviar **pausa el bot**)
- Webhooks como si fueran API de negocio
- Mezclar `x-api-key` + cookie + `X-Cima-Forward-Secret` en la misma intención

### Rate limits / auditoría

- **Rate limit HTTP:** no hay en código. `NO CONFIRMADO` a nivel reverse-proxy.
- **Auditoría:** `movimiento` (crear/cancelar/transición/bahía) y `evento_turno` (append-only por transición/reprogramación). `cliente_clasificacion_evento` para buyer. El agente no tiene endpoint de lectura de `movimiento`.

---

## 3. Catálogo completo de endpoints

**Inventario:** 31 `route.ts` únicos (el glob del repo lista 32 por paths Windows duplicados). **No hay Zod** en Agents ni en v1 agenda (interfaces TS + casts). Zod **sí** en WAH integration (`src/lib/modules/wah/schemas.ts`).

Auth Edge = cookie presence. Auth Node = lo que hace el handler.

---

### 3.A Contexto de cliente / buyer / historial

#### GET `/api/agents/context`

Archivo: `src/app/api/agents/context/route.ts`  
Superficie / auth: Agents / `validateAgentApiKey`  
Idempotencia: no  
Side effects: **no escribe**

**Cuándo:** primer mensaje WhatsApp / n8n — una lectura de cliente + vehículos + turnos + buyer + historial.  
**Cuándo no:** no usar el lookup legacy si necesitás `wa_id` o buyer. No usar v1 context (cookie).

Query (uno obligatorio):

| Param | Tipo | Required | Validación |
|---|---|---|---|
| `telefono` | string E.164 | uno de tres | `normalizeTelefonoE164` si se usa |
| `wa_id` | string Meta/JID | uno de tres | `waIdToE164` |
| `cliente_id` | uuid string | uno de tres | lookup directo |
| `empresa` | slug | no | gana sobre header |

Headers: `x-api-key` (req), `x-empresa` (opt).

Response 200 — shape canónico (`raw._context` de `getClienteContext`):

```json
{
  "cliente": {
    "id": "uuid",
    "nombre": "string",
    "apellido": "string",
    "telefono": "+549…",
    "email": "string|null",
    "documento": "string|null"
  },
  "vehiculos": [
    {
      "id": "uuid",
      "patente": "string",
      "marca": "string|null",
      "modelo": "string|null",
      "anio": "number|null",
      "tipoVehiculo": "auto|camioneta",
      "condicion": "nuevo|normal|viejo",
      "kilometrajeActual": "number|null",
      "proximosServicios": [
        { "servicioId": "uuid", "servicioNombre": "string", "proximoKm": "number" }
      ]
    }
  ],
  "turnos": {
    "programados": [
      {
        "id": "uuid",
        "estado": "pendiente|confirmado|recibido|en_servicio",
        "inicio": "ISO",
        "finalizaEn": "ISO",
        "kilometraje": "number|null",
        "patente": "string",
        "servicios": ["string"],
        "bahia": "string|null"
      }
    ],
    "realizados": []
  },
  "buyer_profile": {
    "id": "uuid",
    "clienteId": "uuid",
    "tags": ["string"],
    "intencionPredominante": "string|null",
    "perfilBuyer": "string|null",
    "scoreReclamos": 0,
    "ultimaClasificacion": "string|null",
    "ultimaClasificacionEn": "ISO|null",
    "wahConversationId": "uuid|null",
    "metadata": "unknown|null",
    "updatedAt": "ISO"
  },
  "perfilBuyer": { },
  "historial_services": [
    {
      "id": "uuid",
      "servicioNombre": "string",
      "tipoServicioNombre": "string|null",
      "tallerNombre": "string|null",
      "realizadoEn": "ISO",
      "kilometrajeKm": "number|null",
      "duracionMinutos": "number|null",
      "precio": "number|null",
      "moneda": "ARS",
      "resultado": "realizado",
      "turnoId": "uuid",
      "vehiculoId": "uuid"
    }
  ],
  "ultimosServices": [],
  "meta": {
    "partial": false,
    "missing": [],
    "lookup": "cliente_id|telefono|wa_id"
  }
}
```

- `perfilBuyer` = alias de `buyer_profile` (mismo objeto).
- `ultimosServices` = alias de `historial_services` (últimos 10, `realizadoEn` desc).
- `meta.partial` es **siempre `false`** cuando hay `_context` (código actual). `missing` lista `"buyer_profile"` y/o `"historial_services"` si están vacíos.
- `turnos.programados`: estados **no** en `finalizado|cancelado|vencido|ausente`.
- `turnos.realizados`: solo `finalizado` (desde tabla `turno`, no historial).
- Fallback sin `_context` (código defensivo): `buyer_profile`/`historial_services` null, `meta.partial: true`. En el flujo actual `getClienteContext` **siempre** setea `_context` si hay cliente.

Errores:

| HTTP | Body | Condición |
|---|---|---|
| 401 | `{ error: "No autorizado" }` | API key inválida (**sin** `code`) |
| 404 | `{ error: "Empresa no encontrada" }` | slug inválido |
| 400 | `{ error: "telefono, wa_id o cliente_id requerido", code: "VALIDATION" }` | sin lookup |
| 404 | `{ error: "No encontrado" }` | cliente inexistente |
| 422 | `{ error, code: "ValidacionCliente" }` | teléfono no E.164 (path `telefono`) |
| 500 | `{ error: "Error interno" }` | no tipado |

Ejemplo mínimo:

```http
GET /api/agents/context?telefono=%2B5491155551001
x-api-key: $AGENT_API_KEY
x-empresa: montironi
```

#### GET `/api/agents?resource=cliente` (legacy)

Archivo: `src/app/api/agents/route.ts` `GET`  
Auth: API key  
Side effects: no

Query: `id` **o** `telefono` (no `wa_id`).  
Response 200: `{ cliente: <fila getClienteContext plana> }` — incluye `id`, datos, `vehiculos`, `turnos` (array plano, no `{programados,realizados}`), y `_context` **también** en el objeto (el handler devuelve el return completo de `getClienteContext`, no solo `_context`).

400 si faltan `id` y `telefono`. 404 `{ error: "No encontrado" }`. 422 `ValidacionCliente`.

#### GET `/api/v1/clientes/context`

Archivo: `src/app/api/v1/clientes/context/route.ts`  
Auth: cookie (Edge + `requireSession`)  
Query: `id` o `telefono`  
Response: `{ cliente: <mismo objeto getClienteContext> }`  
400 `{ error: "Parámetro id o telefono requerido", code: "VALIDATION" }`  
404 `{ error: "Cliente no encontrado", code: "RecursoNoEncontrado" }`  
422 `ValidacionCliente`  
**Agente M2M: no usar.**

#### GET `/api/v1/clientes/:id/context`

Archivo: `src/app/api/v1/clientes/[id]/context/route.ts`  
Auth: cookie  
Path: `id` uuid  
Response: `{ cliente: context }`  
404 `RecursoNoEncontrado`  
**Agente M2M: no usar.**

---

### 3.B Catálogo (servicios, talleres, bahías)

#### GET `/api/agents?resource=servicios`

Auth: API key. Side effects: no.

Response: `{ servicios: Servicio[] }` — `listServicios`: `activo=true`, include `tipoServicio`, order tipo+nombre.

Campos Prisma de cada servicio: `id`, `empresaId`, `tipoServicioId`, `nombre`, `descripcion`, `duracionMin`, `precio` (Decimal→string), `modoPrecio` (`fijo`\|`desde`\|`a_presupuestar`), `activo`, timestamps, `tipoServicio: { id, empresaId, nombre, activo, … }`.

**No hay** `GET /api/agents?resource=talleres`. `listTalleres` solo lo usa el panel (RSC). El agente **debe conocer `tallerId`** (config/seed/ops). Hueco: §14.

400 no aplica. 401/404 empresa como el resto de Agents.

#### GET `/api/v1/talleres/:tallerId/bahias`

Auth: cookie. GET: cualquier rol de panel.  
Response: `{ bahias }` — include `bahiaServicios.servicio`, últimos 5 bloqueos activos.  
**Agente M2M: no usar.**

#### POST `/api/v1/talleres/:tallerId/bahias`

Auth: cookie + `assertAdminRole`.  
Body: `{ nombre: string, orden?: number, servicioIds?: string[] }`  
201 `{ bahia }`  
403 `{ error: "No autorizado" }` (sin code)  
**No es para agentes.**

#### PATCH `/api/v1/bahias/:bahiaId`

Auth: cookie + admin.  
Body: `{ nombre?, activa?, servicioIds? }`  
Response `{ bahia }`  
**No es para agentes.**

---

### 3.C Disponibilidad y agenda (read-only)

#### GET `/api/agents?resource=disponibilidad`

Auth: API key. **No reserva.**

Query:

| Param | Tipo | Required | Notas |
|---|---|---|---|
| `tallerId` | uuid | sí | |
| `fecha` | string | sí | `new Date(fecha)` — preferí `YYYY-MM-DD` o ISO |
| `servicioId` | uuid (repetible) | ≥1 | `getAll("servicioId")` |
| `bahiaId` | uuid | no | filtra bahías compatibles |

400 `{ error: "Parámetros requeridos: tallerId, fecha, servicioId" }` (sin `code`).

Response:

```json
{
  "availability": [
    {
      "bahiaId": "uuid",
      "bahiaNombre": "string",
      "slots": [{ "inicio": "ISO", "fin": "ISO" }]
    }
  ]
}
```

Algoritmo (`getAvailabilityForDate`): duración = suma `duracionMin` de servicios activos + `margenMinutos` (default 15). Ventanas = patrón del día o excepción. Resta ocupaciones activas. Slots cada **15 min** que entren enteros. Taller cerrado / sin franja → `[]`. No escribe DB.

#### GET `/api/v1/talleres/:tallerId/disponibilidad`

Auth: cookie. Query: `fecha` (default hoy `YYYY-MM-DD`), `servicioId` (req, repetible), `bahiaId` opt.  
Taller de otra empresa → 404 `RecursoNoEncontrado`.  
Response: `{ fecha, tallerId, availability }`  
400 `{ error: "servicioId requerido", code: "VALIDATION" }`.

#### GET `/api/v1/talleres/:tallerId/agenda`

Auth: cookie. Query: `fecha` default hoy.  
Response: `{ fecha, tallerId, bahias, turnos, bloqueos, schedule, isClosed }`  
Read-only. **No para M2M.**

#### GET `/api/agents?resource=turno`

Query: `id` (req).  
200 `{ turno }` = `getTurnoById`: include `cliente`, `vehiculo`, `detalles.servicio`, `bahia`, `taller`, `creador`, `eventos` (desc + `usuario`).  
400 `{ error: "id requerido" }`. 404 `{ error: "No encontrado" }`.

---

### 3.D Ciclo de vida del turno

**Agents no tiene `confirmar_turno` ni `transicionar`.** Confirmar / FSM operativo (`recibido`, `en_servicio`, `finalizado`, `ausente`) es **solo v1 + cookie** (o crear ya confirmado).

#### POST `/api/agents` — ver §4 para cada `action`

Auth: API key. Idempotencia **opcional** (`idempotency-key`).  
401 `{ error: "No autorizado" }` (sin code).  
404 empresa.  
422 `ValidacionCliente`.  
Domain → `{ error, code }` + `httpStatusForDomainError`.  
Acción desconocida → **500** `{ error: "Error interno" }` (`throw new Error("Acción no soportada")`).  
Replay: 200 `{ …value, idempotencyReplay: true, code: "IdempotencyReplay" }`.

#### POST `/api/v1/turnos`

Auth: cookie `requireSession`.  
Idempotencia: opt. operation `"crear_turno"`.

Body (TS, sin Zod):

```ts
{
  tallerId: string;
  bahiaId?: string;
  clienteId: string;
  vehiculoId: string;
  servicioIds: string[];
  inicio: string; // ISO
  canal?: "web"|"telefono"|"whatsapp"|"interno"|"agente_ia";
  kilometraje?: number;
  notas?: string;
  confirmar?: boolean; // default FALSO → pendiente
}
```

`canal` default `interno`. `creadorId` = `session.userId`.  
`confirmar === true` → `createTurno` estado `confirmado`; si no → `crearTurnoPendiente`.  
`assertNotPastInicio` → `HorarioVencido` 422.

Response: `{ turno }` (+ `idempotencyReplay` si replay; **sin** `code` en v1).

#### POST `/api/v1/turnos/:id/confirmar`

Auth: cookie. Body opt `{ version?: number }`. Version: body o `If-Match` / `x-turno-version`.  
operation `"confirmar_turno"`.  
Si pendiente con `inicio < now`: vence en tx, libera hold, lanza `TransicionInvalida` ("Turno vencido — no se puede confirmar").  
Revalida horario y slot (excluye el propio turno). Mantiene/refresh ocupación. `freezeSnapshots` si venía `pendiente`.

#### POST `/api/v1/turnos/:id/cancelar`

Auth: cookie. Body `{ version?: number, motivo?: string }`.  
operation `"cancelar_turno"`. Libera ocupación.

#### POST `/api/v1/turnos/:id/reprogramar`

Auth: cookie. Body `{ inicio: string, bahiaId?: string, version?: number }`.  
Version **requerida** (400 `{ error: "version requerida", code: "VALIDATION" }` si falta).  
operation `"reprogramar_turno"`. Fuera de horario / bahía incompatible se **mapean** a `CapacidadConflicto` ("Conflicto al reprogramar — se mantiene el horario anterior").

#### POST `/api/v1/turnos/:id/transiciones`

Auth: cookie.  
Body: `{ estado?: EstadoTurno, nuevoEstado?: EstadoTurno, version?: number, detalle?: string }`  
`estado` canónico; `nuevoEstado` alias; si ambos, gana `estado` (`parseTransicionEstado`).  
400 si falta estado. 400 si falta version.  
`vencido` manual → `TransicionInvalida`.  
`cancelado` delega a `cancelTurno`.  
`finalizado` libera ocupación, copia km al vehículo si hay, `upsertHistorialDesdeTurnoFinalizado`.

---

### 3.E Clasificación / tags buyer

#### POST `/api/agents` `action=clasificar_cliente`

Ver §4. Canónico para agentes.

#### POST `/api/v1/clientes/:id/clasificaciones`

Archivo: `src/app/api/v1/clientes/[id]/clasificaciones/route.ts`  
Handler: API key **o** cookie.  
**Edge: exige cookie** (path no público). Un agente con solo `x-api-key` recibe **401 UNAUTHORIZED en middleware** y el dual-auth del handler **no corre**.  
Los tests de integración invocan el handler en proceso (bypassean Edge).  
Docs viejas que dicen “x-api-key o cookie” están **desactualizadas para HTTP real**.

Body (sin Zod): `clasificacion`, `intencion?`, `tagsDelta?`, `scoreReclamosDelta?`, `wahConversationId?`, `wahMessageId?`, `fuente?`, `payload?`.  
Response: `{ perfil, evento: { id, clasificacion, intencion, createdAt } }`.  
`fuente` default en service: `"bot"` si el handler no manda (Agents action default `"integracion"`).

---

### 3.F Upsert cliente y vehículo

Solo vía `POST /api/agents` actions `upsert_cliente` / `upsert_vehiculo` (§4).  
No hay `POST /api/v1/clientes` en este repo.

---

### 3.G Bloqueos de bahía

#### POST `/api/v1/bahias/:bahiaId/bloqueos`

Auth: cookie (empleado+).  
Body: `{ inicio: string, fin: string, motivo: string }` — `motivo` trim no vacío o `BloqueoInvalido`.  
`tipo=bloqueo`, `turno_id` null, `creadoPorUsuarioId` = sesión.  
Idempotencia opt, operation `"crear_bloqueo"`.  
Response `{ bloqueo }` (fila `ocupacion_bahia`).

#### DELETE `/api/v1/bloqueos/:ocupacionId`

Auth: cookie. Soft: `activo=false`.  
404 `RecursoNoEncontrado` si no es bloqueo del tenant.  
Response `{ bloqueo }`.  
**No hay** action Agents de bloqueo.

---

### 3.H Jobs

#### POST `/api/v1/jobs/vencer-pendientes`

Archivo: `src/app/api/v1/jobs/vencer-pendientes/route.ts`  
Edge: público. Node: `x-api-key === AGENT_API_KEY` **o** `requireSession` + admin.

Con API key: `x-empresa` default `montironi`.  
200 `{ vencidos: number, empresa: slug }`.  
404 `{ error: "Empresa no encontrada", code: "RecursoNoEncontrado" }`.

Con sesión admin: `{ vencidos, empresaId }` (UUID).  
Empleado: **403** `{ error: "No autorizado", code: "RecursoNoEncontrado" }` — code **engañoso**.

Efecto: cada `pendiente` con `inicio < now` → `vencido`, libera ocupación, evento. **No** toca confirmados (no hay auto-ausente).

Reintentos: no idempotente por key; es seguro reejecutar (0 vencidos la segunda vez).

---

### 3.I WhatsApp / WAH (agente de conversación)

El bot de **turnos** no necesita el inbox. Flujo típico: Meta → webhook Montironi → `WAH_MESSAGE_WEBHOOK_URL` (n8n) → Agents API → (opcional) `POST /api/wah/integration/send-text`.

Si `bot_paused=true`, el webhook **no** forwardea a n8n. Un humano en panel que envía mensaje **pausa** el bot (`botPaused: true`).

#### Panel (cookie) — no usar como API de turnos

| METHOD | Path | Efecto |
|---|---|---|
| GET | `/api/wah/accounts` | `{ accounts: [{ id, label, phoneNumberId, displayPhoneNumber, active }] }` |
| GET | `/api/wah/dashboard?accountId=` | `{ kpis: { total, unread, pending, botPaused } }` |
| GET | `/api/wah/conversations?accountId=&filter=all\|pending\|unread` | `{ conversations: [...] }` |
| GET | `/api/wah/conversations/:id` | `{ conversation, messages }` |
| POST | `/api/wah/conversations/:id/messages` | body `{ body, generatedByAi? }` — **pausa bot** |
| POST | `/api/wah/conversations/:id/bot/resume` | `{ botPaused: false }` |
| POST | `/api/wah/conversations/:id/read` | marca leído |
| GET | `/api/wah/media/:mediaId` | binario |

Auth Node: `requireWahSession` (sesión + rol panel conocido). 401/403 vía `wahErrorResponse` (`{ error }` sin codes de dominio).

Zod panel: `sendWahPanelMessageSchema` — `body` min 1, `generatedByAi` opt.

#### Integración (secret) — enviar al usuario

Auth: `requireWahIntegration` → 401 `{ error: "Unauthorized integration" }`.  
Zod: 400 `{ error: <primer issue Zod> }`.

**POST `/api/wah/integration/send-text`**

```json
{
  "empresa_id": "uuid",
  "account_id": "uuid",
  "to": "+5491112345678",
  "text": "Mensaje",
  "contact_name": "opcional",
  "conversation_id": "uuid opcional",
  "external_id": "opcional"
}
```

`to` min 8 chars (no E.164 estricto).  
200 `{ conversation_id, message_id, wa_message_id, message }`.

**POST `/api/wah/integration/send-audio`** — `audio_url` URL, `filename?`.  
**POST `/api/wah/integration/send-file`** — `file_url`, `filename` min 1, `caption?`.

**GET `/api/wah/integration/media/:mediaId?empresa_id=`** — binario; `empresa_id` requerido.

**GET `/api/wah/integration/conversations/:id`**

200:

```json
{
  "bot_paused": false,
  "contact_phone": "+549…",
  "account_id": "uuid",
  "empresa_id": "uuid"
}
```

404 `{ error: "Conversación no encontrada" }`.  
**No filtra por empresa del secret** (el secret es global). Usar solo IDs ya conocidos. `NO CONFIRMADO` aislamiento extra.

`message` serializado: `{ id, direction, senderType, messageType, body, status, createdAt, media }`.  
`direction`: `inbound` \| `outbound`.  
`senderType`: `contact` \| `human` \| `bot` \| `integration`.  
`messageType`: `text` \| `audio` \| `file` \| `image` \| `document` \| `video` \| `sticker` \| `system`.

#### POST `/api/webhooks/whatsapp/received-data`

Auth: mismo secret. Body: payload Meta Cloud API (`entry[].changes[].value`).  
Lookup `metadata.phone_number_id` → `whatsapp_accounts`; 404 si no existe.  
Idempotencia inbound por `wamid`.  
Forward n8n (si `WAH_MESSAGE_WEBHOOK_URL` y `!botPaused`):

```json
{
  "event": "inbound_message",
  "empresaId": "uuid",
  "accountId": "uuid",
  "phoneNumberId": "string",
  "conversationId": "uuid",
  "messageId": "uuid",
  "wamid": "string",
  "contactPhone": "+…",
  "contactName": "string|null",
  "body": "string",
  "messageType": "text|…",
  "botPaused": false
}
```

Response: `{ messages: [{ wamid, messageId?, skipped? }], statuses: [{ wamid, status, updated }] }`.

**No crear turnos desde el webhook.**

---

### 3.J Compatibilidad legacy `GET/POST /api/agents`

| Recurso GET | Estado |
|---|---|
| (sin `resource`) | 200 `{ endpoints: [ "GET ?resource=servicios", "GET ?resource=disponibilidad&tallerId=&fecha=&servicioId=", "GET ?resource=turno&id=", "GET ?resource=cliente&id= | telefono=", "POST turnos, clientes, vehiculos" ] }` — lista **desactualizada** (no menciona context ni clasificar) |
| `servicios` | canónico |
| `disponibilidad` | canónico |
| `turno` | canónico |
| `cliente` | **legacy** vs `/api/agents/context` |

POST `action` canónico: ver §4. `origen` → `canal` via `resolveCanal`.

---

## 4. Acciones de `POST /api/agents`

Dispatcher: `dispatchAgentAction` (`src/lib/modules/agents-api/dispatch.ts`).

Headers comunes: `x-api-key`, `x-empresa`, `Content-Type: application/json`, `idempotency-key` (opt; **usar siempre** en canales con retry).

Idempotencia: si hay key, envuelve **todas** las actions (incl. upsert/clasificar). Huella = SHA-256 de `JSON.stringify(body)`. Key reusada con body distinto → `CapacidadConflicto` 409 (“Clave idempotente reutilizada con distinta solicitud”) — **code reutilizado**, no es conflicto de bahía.

`creadorId` en crear turno: **undefined** (no hay usuario de sesión).

---

### 4.1 `crear_turno`

**Cuándo:** el usuario eligió servicio + slot.  
**Cuándo no:** sin `clienteId`/`vehiculoId`/vínculo; slot pasado; como “consulta”.

**Default crítico:** `confirmar` es **`true` si el campo está ausente** (`handleCrearTurno`). Eso crea estado **`confirmado`**, no `pendiente`.  
Para hold pendiente: `"confirmar": false`.  
**No existe** `action: "confirmar_turno"`. Confirmar un pendiente después = solo `POST /api/v1/turnos/:id/confirmar` (cookie). Un bot M2M **no puede confirmar** un pendiente.

Body:

| Campo | Tipo | Required | Notas |
|---|---|---|---|
| `action` | `"crear_turno"` | sí | |
| `tallerId` | string | sí | |
| `clienteId` | string | sí | mismo tenant + vínculo con vehículo |
| `vehiculoId` | string | sí | |
| `servicioIds` | string[] | sí | activos, existen |
| `inicio` | ISO string | sí | no pasado (`HorarioVencido`) |
| `bahiaId` | string | no | si hay >1 bahía libre compatible, **obligatorio** o `BahiaIncompatible` |
| `canal` | enum | no | default `agente_ia` si inválido/ausente |
| `origen` | string | no | alias; map legacy `panel`→`interno`, `voz`→`telefono`, `api`→`agente_ia` |
| `notas` | string | no | |
| `confirmar` | boolean | no | **default true** |

`kilometraje` **no** se pasa desde Agents (sí en v1).

Validaciones: tenant scope; servicios; `assertWithinSchedule`; `resolveBahiaAssignment`.  
Caso de uso: `createTurno`.  
Equivale a `POST /api/v1/turnos` **salvo** default de `confirmar` (v1 default pendiente) y `canal` (v1 default `interno`).

Errores: `RecursoNoEncontrado` 404, `FueraDeHorario` 409, `BahiaIncompatible` 409, `CapacidadConflicto` 409, `HorarioVencido` 422.

Efectos: INSERT `turno` + `detalle_turno` + `ocupacion_bahia` activa + `evento_turno` + `movimiento`.  
Idempotency-key: recomendada.  
Reintento: seguro **con la misma key**.

Ejemplo (pendiente / hold):

```json
{
  "action": "crear_turno",
  "tallerId": "uuid",
  "clienteId": "uuid",
  "vehiculoId": "uuid",
  "servicioIds": ["uuid"],
  "inicio": "2026-09-16T13:00:00.000Z",
  "canal": "whatsapp",
  "confirmar": false
}
```

Response: `{ turno: { id, estado, version, inicio, finalizaEn, bahiaId, … includes cliente, vehiculo, detalles, bahia } }`.

---

### 4.2 `cancelar_turno`

Body: `turnoId` (req), `version?` (number), `motivo?`.  
`cancelTurno`. FSM: solo desde estados que permiten `cancelado` (ver §5).  
Libera ocupación.  
Equivale a `POST /api/v1/turnos/:id/cancelar` (v1 manda `usuarioId`).  
Idempotency-key: sí en WhatsApp/n8n.  
Errores: `RecursoNoEncontrado`, `VersionConflicto` 409, `TransicionInvalida` 422.

---

### 4.3 `reprogramar_turno`

Body: `turnoId`, `inicio` (ISO), `version` (**Number**, requerido a nivel dominio; `NaN` si falta → casi seguro fallo de version), `bahiaId?`.  
Solo estados activos (`pendiente|confirmado|recibido|en_servicio`).  
Errores de horario/bahía → `CapacidadConflicto` (mensaje de “se mantiene el horario anterior”).  
Equivale a v1 reprogramar.  
**Enviar `version` leída del turno.** No preguntársela al usuario.

---

### 4.4 `upsert_cliente`

**No es upsert por teléfono.** Sin `id` → **INSERT**. Con `id` → `updateMany` scoped tenant.

Body: `nombre` (req), `apellido` (req en validación), `telefono` (req E.164), `id?`, `email?`, `documento?`. `notas` no se mapea en el action (sí existe en `upsertCliente`).

422 `ValidacionCliente` (nombre/apellido/teléfono). 404 si `id` de otra empresa.

Response:

```json
{ "cliente": { "id": "uuid", "nombre": "string", "apellido": "string", "telefono": "+…" } }
```

Teléfono **no es UNIQUE**. Dos altas con el mismo E.164 crean dos filas. Lookup usa `findFirst` + `activo: true`.

---

### 4.5 `upsert_vehiculo`

Body: `patente` (req, se guarda UPPERCASE), `clienteId` (req — el action hace `String(body.clienteId)`), `marca?`, `modelo?`, `anio?`, `color?`, `tipoVehiculo?` (`auto`\|`camioneta`), `condicion?` (`nuevo`\|`normal`\|`viejo`), `kilometrajeActual?`.

UNIQUE `(empresa_id, patente)`. Crea o update. Link `cliente_vehiculo` (`esPrincipal: true` en create).  
Defaults create: `tipoVehiculo=auto`, `condicion=normal`.  
Response `{ vehiculo }` (fila Prisma).  
Enums inválidos: riesgo de error Prisma → 500. No hay Zod.

---

### 4.6 `clasificar_cliente`

Body:

| Campo | Tipo | Required |
|---|---|---|
| `clienteId` | string | sí (si falta → **500**, `throw new Error`) |
| `clasificacion` | string libre | sí |
| `intencion` | string | no |
| `tagsDelta` | string[] | no — **solo agrega** (merge set) |
| `scoreReclamosDelta` | number | no — se suma; floor 0 |
| `wahConversationId` | uuid | no |
| `wahMessageId` | uuid | no |
| `fuente` | `"bot"\|"humano"\|"sistema"\|"integracion"` | no, default `"integracion"` |
| `payload` | object | no → `metadata` del perfil |

`clasificacion` / `intencion` / tags: **sin catálogo en código**. No inventar taxonomía de producto; usar valores que el orquestador ya acordó.

Response: `{ perfil: serializePerfilBuyer, evento: { id, clasificacion, intencion, createdAt } }`.  
404 `RecursoNoEncontrado`.  
Equivale en dominio a v1 clasificaciones (pero v1 no es usable M2M por Edge).

---

### 4.7 GET `resource=servicios|disponibilidad|turno|cliente`

Documentados en §3. No pasan por el dispatcher POST.

---

## 5. Máquina de estados del turno

Enum Prisma `estado_turno`:

`pendiente` | `confirmado` | `recibido` | `en_servicio` | `finalizado` | `cancelado` | `ausente` | `vencido`

Grafo (`VALID_TRANSITIONS` + `canTransition`). `vencido` **nunca** es destino manual (`canTransition(*, vencido) === false`). Job escribe `vencido` **sin** pasar por `canTransition`.

| Origen | Destinos API/panel | Actor | Ocupación |
|---|---|---|---|
| `pendiente` | `confirmado`, `cancelado` | humano v1 / agente (cancelar; crear ya confirmado) | confirmado: **mantiene**; cancelado: **libera** |
| `pendiente` | `vencido` | job o confirm de pendiente expirado | **libera** |
| `confirmado` | `recibido`, `cancelado`, `ausente` | panel v1 transiciones | recibido: mantiene; cancel/ausente: libera |
| `recibido` | `en_servicio`, `cancelado`, `ausente` | panel | idem |
| `en_servicio` | `finalizado`, `cancelado` | panel | ambos liberan; finalizado escribe historial |
| `finalizado`, `cancelado`, `ausente`, `vencido` | (ninguno) | — | ya liberada |

| Transición | Superficie |
|---|---|
| crear `pendiente` / `confirmado` | Agents `crear_turno`, v1 `POST /turnos` |
| `pendiente → confirmado` | **solo** v1 `/confirmar` (o crear con `confirmar: true`) |
| `* → cancelado` | Agents `cancelar_turno`, v1 `/cancelar` o `/transiciones` |
| `pendiente → vencido` | job; side-effect en confirm tardío |
| `confirmado → recibido → en_servicio → finalizado` | **solo** v1 `/transiciones` |
| `→ ausente` | **solo** v1 `/transiciones` |
| reprogramar (mismo estado) | Agents + v1; `version++`; swap ocupación |

**Optimistic locking**

- Agents cancelar: `version` opt. Si se envía y no coincide → `VersionConflicto` 409 (“El turno fue modificado”).
- Agents reprogramar: `version` se caste a `Number` (obligatorio en dominio).
- v1: `parseVersion` = `If-Match` \| `x-turno-version` \| `body.version`. Confirmar/cancelar: version opt. Reprogramar/transiciones: req.
- `transitionTurno` usa `updateMany` `where: { id, version }` → 0 filas = `VersionConflicto`.

---

## 6. Capacidad, bahías y disponibilidad

### Consultar ≠ reservar

`getAvailabilityForDate` / `getAgendaForDate` solo leen. Test: el count de `ocupacion_bahia` no cambia.

### Asignación de bahía (`resolveBahiaAssignment`)

1. Bahías del taller `activa=true` compatibles: cada `servicioId` tiene fila `bahia_servicio` activa.
2. 0 compatibles → `BahiaIncompatible` (“Ninguna bahía compatible con los servicios”).
3. Si el caller manda `bahiaId` y no es compatible → `BahiaIncompatible`.
4. Si manda `bahiaId` compatible pero ocupada → `CapacidadConflicto`.
5. Sin `bahiaId`: filtra libres. 0 → `CapacidadConflicto`. 1 → autoasigna. **>1 → `BahiaIncompatible`** (“Seleccioná una bahía — hay varias compatibles disponibles”).

Duración ocupada: suma duraciones + `configuracion_turnos.margen_minutos` (default 15).  
`finaliza_en = inicio + duracionMin * 60_000`.

### Errores de capacidad

| Code | HTTP | Cuándo |
|---|---|---|
| `CapacidadConflicto` | 409 | Slot ocupado, EXCLUDE, carrera P2034, reprogramar fallido, **idempotency key reuse** |
| `BahiaIncompatible` | 409 | 0 compatibles, bahía mala, o varias libres sin elegir |
| `FueraDeHorario` | 409 | Taller cerrado o fuera de franja (`assertWithinSchedule`) |
| `HorarioVencido` | 422 | `inicio < now` al crear (Agents/v1) |
| `BloqueoInvalido` | 409* | Motivo vacío (*`httpStatusForDomainError` default 409; DOMAIN_SERVICES decía 422 — **diverge**) |

\* `BloqueoInvalido` está en el `default: return 409` de `httpStatusForDomainError`, no en el case 422.

### Bloqueos

`tipo=bloqueo`, `turno_id` null, `motivo` obligatorio, mismo EXCLUDE. Solo v1 + cookie.

### Reprogramar

Libera ocupación vieja e inserta nueva **en la misma tx**. Si el INSERT falla, rollback → slot original intacto. Version no incrementa si falló.

---

## 7. Clientes, vehículos, buyer, historial

### Lookup

| Clave | Endpoint | Normalización |
|---|---|---|
| `telefono` | context + legacy cliente | E.164 estricto |
| `wa_id` | **solo** `/api/agents/context` | `waIdToE164` |
| `cliente_id` / `id` | context / legacy | UUID, `activo` no filtrado en `getCliente` (sí en list/by phone) |

`getClienteByTelefono`: `findFirst` `{ empresaId, telefono, activo: true }`. Índice parcial `ix_cliente_empresa_telefono` **no UNIQUE**.

### Writable vs read-only

| Dato | Writable por agente |
|---|---|
| nombre, apellido, telefono, email, documento | `upsert_cliente` |
| vehículo / vínculo | `upsert_vehiculo` |
| tags (add), clasificación, intención, score delta, metadata | `clasificar_cliente` |
| historial_servicio | **no** — solo al finalizar (panel) |
| turnos.realizados / programados | no (son lecturas) |
| `proximosServicios` | calculado (intervalo km + último turno) |

`tagsDelta` no borra tags. `scoreReclamos` no baja de 0.

No hay enum de `clasificacion` en Prisma (`String`).

---

## 8. Playbooks para el agente

IDs internos, `version` y API keys **nunca** se piden ni se muestran al usuario.

### Playbook 1 — Inbound WhatsApp → contexto

**Precondiciones:** n8n recibió `event: inbound_message` (bot no pausado). Tenés `contactPhone`, opcional `conversationId`.

1. `GET /api/agents/context?telefono=` (E.164) o `wa_id=`.
2. **404** → pedir nombre y apellido (no IDs). `upsert_cliente` con E.164. Si hay patente, `upsert_vehiculo`. Volver a context.
3. **422 ValidacionCliente** → corregir teléfono a `+549…`.
4. Usar `cliente.id`, `vehiculos[]`, `turnos.programados`, `buyer_profile.tags` / `scoreReclamos`.
5. Si `meta.missing` incluye `buyer_profile` o `historial_services`, operar igual (`partial` es false pero missing informa vacíos).

**No** pegarle al webhook ni a `/api/v1/clientes/context`.

Fallback: lookup legacy `resource=cliente` si el orquestador aún no migró; no tiene `wa_id`.

---

### Playbook 2 — Pedido de turno

**Precondiciones:** `clienteId`, `vehiculoId` vinculados, `tallerId` conocido (config; **no hay listado HTTP para agentes**).

1. `GET /api/agents?resource=servicios` — ofrecer por `nombre` / `tipoServicio.nombre` / precio informativo (`modoPrecio`).
2. Usuario elige servicio(s) → `servicioIds`.
3. `GET ...&resource=disponibilidad&tallerId=&fecha=&servicioId=` (repetir `servicioId` si hay varios). **No reserva.**
4. Si `availability` vacío o todos `slots` vacíos → otra fecha/taller (si tenés otro `tallerId`). **No forzar.**
5. Si varias bahías tienen el mismo horario, al crear **mandá `bahiaId`** (si no, `BahiaIncompatible`).
6. **Decisión de estado (código real):**
   - Acuerdo firme y el bot puede dejarlo cerrado: `crear_turno` **sin** `confirmar` o `confirmar: true` → queda **`confirmado`** + hold.
   - Querer hold y confirmar después: `confirmar: false` → `pendiente` + hold. **El bot no puede confirmar después.** Solo cancelar/reprogramar, o un humano en panel.
7. `idempotency-key` única por intención (p.ej. `wa:{wamid}:crear_turno`).
8. Comunicar horario (`inicio`–`finalizaEn`) y que el cupo **ya está ocupado**.
9. 409 `CapacidadConflicto` / `FueraDeHorario` → reconsultar disponibilidad; no reusar el slot.
10. `HorarioVencido` → ofrecer horario futuro.

**No** uses v1 `POST /turnos`.

---

### Playbook 3 — Mover turno

1. Context o `GET ?resource=turno&id=` → `version`, `estado`, `inicio`.
2. Si estado terminal → no reprogramable (`TurnoNoReprogramable` 422).
3. Nueva disponibilidad (sin reservar).
4. `reprogramar_turno` + `version` + `idempotency-key`.
5. **409 VersionConflicto** → re-leer turno, reintentar con version nueva (nueva key o misma solo si el body es idéntico — si cambió version en el body, **nueva** key).
6. **409 CapacidadConflicto** → el slot **viejo sigue**; ofrecer otro horario.

No preguntes la version.

---

### Playbook 4 — Cancelar

1. Identificar `turnoId` desde programados (no pedir UUID).
2. `cancelar_turno` + `turnoId` + `version` si la tenés + `motivo` opcional + **idempotency-key**.
3. 422 `TransicionInvalida` → ya terminal o FSM no permite; re-leer y explicar estado real.

---

### Playbook 5 — Retry de red

1. Reenviar **la misma** `idempotency-key` y **el mismo body** (mismo `JSON.stringify`).
2. 200 + `idempotencyReplay: true` + `code: "IdempotencyReplay"` → devolver ese `turno`/`cliente`; **no** crear otro.
3. 409 `CapacidadConflicto` con mensaje de clave reutilizada → **no** es solape de bahía: generaste la misma key con otro payload. Nueva key.

Sin key: cada retry puede **doble reserva**.

---

### Playbook 6 — VIP / reclamo

1. No inventar tags. `tagsDelta` solo etiquetas acordadas (ej. `fiel`, `urgente` si el flujo las usa).
2. `clasificar_cliente` con `clienteId`, `clasificacion` (string libre), `intencion?`, `scoreReclamosDelta` (p.ej. +1 reclamo).
3. `fuente`: `"bot"` o `"integracion"`.
4. No uses v1 clasificaciones desde n8n sin cookie.

---

### Playbook 7 — Sin cupo

1. No crear turno “igual”.
2. Otra `fecha` o, si ops te dio más de un `tallerId`, otro taller.
3. Explicar cierre (`availability: []` = cerrado o sin hueco de duración).
4. No bloquees bahías (eso es panel).

---

## 9. Contratos de error (normalizados)

| code | HTTP | Significado | Acción del agente |
|---|---|---|---|
| *(sin code)* `No autorizado` | 401 | Agents: API key mala | Revisar `AGENT_API_KEY`; no reintentar en loop |
| `UNAUTHORIZED` | 401 | Edge: sin cookie en path protegido | **No** pegarle a `/api/v1/*` (no jobs) |
| *(sin code)* `Empresa no encontrada` | 404 | Slug inválido | Corregir `x-empresa` |
| `VALIDATION` | 400 | Query/body incompleto (context, v1) | Completar params |
| `ValidacionCliente` | 422 | E.164 / nombre / apellido | Pedir datos bien formados |
| `RecursoNoEncontrado` | 404 | Tenant miss, IDs ajenos, taller/servicio/turno | Re-lookup; no cruzar empresa. **Ojo:** jobs 403 admin usa este code |
| `CapacidadConflicto` | 409 | Slot ocupado, carrera, reprogramar fallido, **o** idempotency mismatch | Releer disponibilidad **o** revisar key |
| `BahiaIncompatible` | 409 | 0 bahías, bahía mala, o varias libres | Elegir `bahiaId` o cambiar servicios |
| `FueraDeHorario` | 409 | Fuera de calendario (crear/bloqueo) | Otra fecha/hora |
| `HorarioVencido` | 422 | `inicio` en el pasado | Slot futuro |
| `TransicionInvalida` | 422 | FSM / vencido manual / confirm de vencido | Re-leer estado |
| `VersionConflicto` | 409 | `turno.version` no coincide | GET turno; reenviar |
| `TurnoNoReprogramable` | 422 | Estado terminal | No mover |
| `BloqueoInvalido` | 409 | Motivo vacío (code HTTP diverge de docs viejas 422) | Mandar motivo |
| `IdempotencyReplay` | 200 | Replay OK (Agents pone `code` en body) | Usar payload; no mutar de nuevo |
| *(sin code)* `Acción no soportada` | 500 | `action` desconocida | Typo de action |
| `Error interno` | 500 | no tipado / clasificar sin campos | Log; no retry ciego en mutaciones sin key |
| WAH `Unauthorized integration` | 401 | secret Cima | Rotar `CIMA_FORWARD_SECRET` |

---

## 10. Idempotencia y concurrencia

- Scope: UNIQUE `(empresa_id, idempotency_key)` en `operacion_api`.
- Huella: SHA-256 de `JSON.stringify(body)` (`fingerprintRequest`).
- Primera: corre handler, guarda `respuesta` JSON.
- Replay misma huella: `{ value: respuesta, replay: true }` — **no** re-ejecuta.
- Misma key, otra huella: `CapacidadConflicto`.

Mutaciones que **pueden** usarla: todo POST `/api/agents` con header; v1 crear/confirmar/cancelar/reprogramar/transición/bloqueo.

`turno.version` es **otra** dimensión: dos mutaciones distintas (aunque con keys distintas) sobre el mismo turno pueden 409 por version.

Carrera de dos `createTurno` mismo slot: uno gana, otro `CapacidadConflicto` (`tests/integration/concurrency.test.ts`).  
Dos confirm con misma version: uno OK, otro `VersionConflicto`.

Al cliente (usuario WhatsApp): si `replay=true`, comunicá el mismo turno que ya se creó. No digas “error”.

---

## 11. Anti-patrones

| No hacer | Motivo técnico |
|---|---|
| Llamar `/api/v1/*` (no jobs) con solo `x-api-key` | Edge 401 `UNAUTHORIZED` |
| Tratar GET disponibilidad como reserva | No inserta `ocupacion_bahia` |
| Crear turno sin servicio/taller/`inicio` válidos | 404/409/422; casts `String(undefined)` = `"undefined"` |
| Asumir `crear_turno` deja `pendiente` | Default Agents `confirmar: true` |
| Confirmar pendiente vía Agents | **No existe la action** |
| Confirmar y asumir el slot eterno | Server revalida; pendiente vencido se vence al confirmar |
| Reprogramar sin `version` | `VersionConflicto` / NaN |
| Mutar WhatsApp/n8n sin `idempotency-key` | Doble hold |
| Inventar `canal`/`origen` | Solo enums + 3 aliases; resto → `agente_ia` |
| Cruzar `x-empresa` o IDs de otro tenant | 404; o peor, crear basura en el tenant del slug |
| Exponer `AGENT_API_KEY` al usuario | Secret de entorno |
| Usar webhooks WAH como API de turnos | Solo persistencia inbound + forward |
| Enviar texto por inbox panel desde el bot | `bot_paused=true` corta n8n |
| Mezclar cookie + API key + Cima secret “por las dudas” | Cada superficie valida **una** cosa |
| Alta `upsert_cliente` sin `id` para “actualizar” | Crea **otro** cliente (teléfono no unique) |
| Forzar turno si hay varias bahías libres sin `bahiaId` | `BahiaIncompatible` |
| Transición `vencido` por API | `TransicionInvalida` |
| B7: usar job como API de negocio del bot | Es cron; blast radius = misma key que el bot |

---

## 12. Checklist de onboarding de un agente nuevo

1. Variables: `AGENT_API_KEY` (obligatoria), slug `montironi` (o el de la empresa), `tallerId`(s) de ops (no hay listado Agents).
2. Base URL dev: `http://localhost:43123` (`next dev -p 43123`).
3. Headers mínimos: `x-api-key`, `x-empresa: montironi`, `Content-Type: application/json`.
4. Sanidad: `GET /api/agents` → 200 + `{ endpoints }` (o 401 si la key es mala).
5. Sanidad tenant: `GET /api/agents/context?telefono=%2B5491155551001` (seed María González) → 200 o 404 si no hay seed.
6. `GET /api/agents?resource=servicios` → lista.
7. En **no-prod**: POST `upsert_cliente` de prueba con `idempotency-key` fija; repetir → `idempotencyReplay: true`.
8. No apunte a `/api/v1/turnos`. No ponga la key en el system prompt visible al usuario final.
9. n8n: guardar `tallerId` y `account_id` / `empresa_id` (UUID) aparte del slug.
10. Cron (ops, no el bot): `POST /api/v1/jobs/vencer-pendientes` con la **misma** `AGENT_API_KEY` hasta B7.

---

## 13. Mapa de archivos (re-sincronizar docs)

| Concepto | Implementación | Tests |
|---|---|---|
| Edge gate | `src/middleware.ts`, `src/lib/auth/access.ts` | `tests/unit/middleware-auth-gate.test.ts`, `tests/unit/access.test.ts` |
| Sesión | `src/lib/auth/session/*` | `tests/integration/session.test.ts`, `tests/integration/auth-gate.test.ts` |
| API key / idempotencia | `src/lib/modules/agents-api/idempotency.ts` | tenant-isolation (replay no cubre mismatch) |
| Dispatch Agents | `src/lib/modules/agents-api/dispatch.ts`, `actions/*` | `tests/integration/agents-cliente.test.ts`, historial-buyer |
| Canal | `src/lib/modules/agents-api/resolve-canal.ts` | `tests/unit/format-origen.test.ts` (labels, no resolve) |
| Context | `src/lib/modules/customers/application/get-cliente-context.ts` | historial-buyer |
| FSM / ocupación | `appointments/constants.ts`, `application/*`, `agenda/domain/*` | `fsm.test.ts`, `occupation.test.ts`, `domain-bugs.test.ts` |
| Bahía | `resolve-bahia.ts`, `availability/service.ts` | occupation, concurrency, reschedule |
| Bloqueos | `appointments/service.ts` `blockBahia` | `tests/integration/blocks.test.ts` |
| Buyer | `src/lib/modules/buyer/service.ts` | historial-buyer |
| Historial | `src/lib/modules/historial/service.ts` | historial-buyer |
| WAH auth | `wah/integration-auth.ts`, `wah/scope.ts` | `wah-integration-auth.test.ts`, `wah.test.ts` |
| Webhook | `wah/process-webhook.ts` | `whatsapp-webhook.test.ts` |
| Tenant | create/upsert scoped | `tenant-isolation.test.ts` |
| Schema | `prisma/schema.prisma`, `prisma/migrations/20260911152000_authoritative_init/` | — |
| Authz roles | `access.ts` | `tests/unit/authz.test.ts` |

---

## 14. Huecos y deuda

### Divergencias docs ↔ código

| Doc | Afirma | Código |
|---|---|---|
| `README.md` API agentes | Actions sin `clasificar_cliente`; GET sin `cliente` | Dispatcher sí tiene clasificar; GET sí tiene `resource=cliente` |
| `README.md` | “22 tests” | Suite creció (unit+integration WAH/historial/auth). Contar con `npm run test` |
| `docs/AGENTS_CONTEXT_API.md` / `DOMAIN_HISTORIAL_BUYER.md` | v1 clasificaciones = `x-api-key` **o** cookie | Handler sí; **Edge no**. HTTP M2M = 401 |
| `docs/DOMAIN_SERVICES.md` | Snapshots se congelan al confirmar | También se escriben **al crear**; `freezeSnapshots` relee catálogo al confirmar pendiente |
| `docs/DOMAIN_SERVICES.md` | `BloqueoInvalido` HTTP 422 | `httpStatusForDomainError` → **409** |
| `docs/DOMAIN_SERVICES.md` | lista v1 incompleta | Faltan context clientes, bahías CRUD, clasificaciones |
| GET `/api/agents` `endpoints` | no menciona context/clasificar | Desactualizado |
| Producto “crear pendiente → confirmar” | — | Agents default **confirma**; no hay action confirmar |

### Huecos de producto para agentes

1. **No hay `confirmar_turno`** en Agents. Hold-then-confirm M2M incompleto.
2. **No hay listado de talleres/bahías** por API key. `tallerId` es config externa.
3. **`upsert_cliente` no matchea por teléfono** — riesgo de duplicados.
4. **Teléfono no UNIQUE.**
5. **B7:** job y bot comparten `AGENT_API_KEY`.
6. **API key no timing-safe.**
7. **Sin Zod** en Agents/v1 agenda — bodies mal formados → 500 o `"undefined"` IDs.
8. **Action desconocida / clasificar sin campos → 500**, no 400.
9. **401 Agents sin `code`.**
10. **Disponibilidad Agents** parsea `fecha` distinto que v1.
11. **GET integration conversation** no scopea empresa del caller (secret global).
12. **Rate limit:** no en app.
13. **Timezone de prod:** `NO CONFIRMADO`.
14. **Catálogo de tags/clasificaciones buyer:** `NO CONFIRMADO` (string libre).
15. **Login machine-to-machine** para v1: no existe (solo `/login` HTML).
16. No hay `GET /api/v1/turnos` list.
17. `TODO` cableado de Agents: no hay TODOs pendientes en `agents-api`. `NO CONFIRMADO` TODOs globales irrelevantes al contrato.

### Auth inconsistente (resumen)

| Ruta | Edge | Handler |
|---|---|---|
| `/api/agents*` | público | API key |
| `/api/v1/jobs/*` | público | API key **o** admin |
| `/api/v1/clientes/:id/clasificaciones` | cookie | API key **o** sesión (**muerto** para M2M) |
| resto `/api/v1/*` | cookie | sesión |
| `/api/wah/integration/*` | público | Cima secret |
| resto `/api/wah/*` | cookie | sesión |

---

## Anexo A — Inventario HTTP (método + auth + side effect)

| METHOD | Path | Edge | Auth handler | Escribe DB | Reserva capacidad |
|---|---|---|---|---|---|
| GET | `/api/agents` | público | API key | no | no |
| POST | `/api/agents` | público | API key | sí (según action) | sí si `crear_turno` / no en upsert/clasificar; cancelar/reprogramar mutan ocupación |
| GET | `/api/agents/context` | público | API key | no | no |
| POST | `/api/v1/turnos` | cookie | sesión | sí | sí |
| POST | `/api/v1/turnos/:id/confirmar` | cookie | sesión | sí | mantiene |
| POST | `/api/v1/turnos/:id/cancelar` | cookie | sesión | sí | libera |
| POST | `/api/v1/turnos/:id/reprogramar` | cookie | sesión | sí | swap |
| POST | `/api/v1/turnos/:id/transiciones` | cookie | sesión | sí | según destino |
| GET | `/api/v1/talleres/:id/agenda` | cookie | sesión | no | no |
| GET | `/api/v1/talleres/:id/disponibilidad` | cookie | sesión | no | no |
| GET | `/api/v1/talleres/:id/bahias` | cookie | sesión | no | no |
| POST | `/api/v1/talleres/:id/bahias` | cookie | admin | sí | no |
| PATCH | `/api/v1/bahias/:id` | cookie | admin | sí | no |
| POST | `/api/v1/bahias/:id/bloqueos` | cookie | sesión | sí | sí (bloqueo) |
| DELETE | `/api/v1/bloqueos/:id` | cookie | sesión | sí | libera bloqueo |
| GET | `/api/v1/clientes/context` | cookie | sesión | no | no |
| GET | `/api/v1/clientes/:id/context` | cookie | sesión | no | no |
| POST | `/api/v1/clientes/:id/clasificaciones` | cookie | API key *o* sesión | sí (buyer) | no |
| POST | `/api/v1/jobs/vencer-pendientes` | público | API key *o* admin | sí | libera vencidos |
| GET | `/api/wah/accounts` | cookie | sesión panel | no | no |
| GET | `/api/wah/dashboard` | cookie | sesión | no | no |
| GET | `/api/wah/conversations` | cookie | sesión | no | no |
| GET | `/api/wah/conversations/:id` | cookie | sesión | no | no |
| POST | `/api/wah/conversations/:id/messages` | cookie | sesión | sí | no — **pausa bot** |
| POST | `/api/wah/conversations/:id/bot/resume` | cookie | sesión | sí | no |
| POST | `/api/wah/conversations/:id/read` | cookie | sesión | sí | no |
| GET | `/api/wah/media/:mediaId` | cookie | sesión | no | no |
| POST | `/api/wah/integration/send-text` | público | Cima secret | sí + Meta | no |
| POST | `/api/wah/integration/send-audio` | público | Cima secret | sí | no |
| POST | `/api/wah/integration/send-file` | público | Cima secret | sí | no |
| GET | `/api/wah/integration/media/:id` | público | Cima secret | no | no |
| GET | `/api/wah/integration/conversations/:id` | público | Cima secret | no | no |
| POST | `/api/webhooks/whatsapp/received-data` | público | Cima secret | sí inbound | no |

No hay otros `src/app/api/**/route.ts`.

---

## Anexo B — Seed útil (dev, no PII de prod)

Empresa slug `montironi`. Talleres: “Taller Centro” (margen 15), “Taller Norte” (margen 20). Horario lun–vie 08:00–12:00 y 13:00–18:00. Servicios: Cambio de aceite, Frenos - revisión, Service 10.000 km, Alineación y balanceo. Cliente de ejemplo `+5491155551001` María González. **Los UUIDs cambian en cada `migrate reset`.**
