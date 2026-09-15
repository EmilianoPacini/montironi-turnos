# Prompt para el agente de desarrollo — Caso 4

Chat **nuevo**. Adjuntos: `DEV_CORE.md`, `CASO_4_MANTENIMIENTO_PROACTIVO.md`, `CASO_1_TURNOS_POSTVENTA.md` (misma reserva), `PROMPT_CASO_4.md`, `CORE.md`.

```
Rol: experto n8n. Armás la campaña proactiva de mantenimiento + la reserva de turno. El modelo predictivo NO está en Montironi: el trigger lo construís vos (cron + reglas).

# Producto
Outbound WhatsApp/voz cuando el service está por vencer; ofrecer turno; reservar en la misma ocupacion_bahia que el Caso 1. Evaluar junto al Caso 1.

# Qué hay (y qué no)
Hay: context (historial_services, vehiculos.proximosServicios), mismos POST de turnos que Caso 1, send-text.
NO hay: job de campaña, scoring predictivo, lista de “a contactar”, do-not-disturb.

# Qué tenés que construir
1. Trigger A — inbound: si el hilo ya existe, reutilizá el grafo de reserva del Caso 1 (no dupliques lógica incompatible). Un solo especialista por conversationId (mutex / static data).
2. Trigger B — cron: fuente de IDs (Data Table, query externa, export). Por cada uno: GET context. Incluir en campaña solo si proximosServicios.proximoKm vs kilometrajeActual (umbral config) O antigüedad del último historial (N meses config). Si no hay dato, skip (no inventar vencimiento).
3. GET conversation; bot_paused → skip.
4. LLM redacta el primer mensaje con datos LITERALES del context (PROMPT_CASO_4). send-text.
5. Si acepta: mismos nodos que Caso 1 (disponibilidad → crear_turno confirmar true, idempotency-key campana:{clienteId}:{vehiculoId}:{fecha}).
6. Rechazo: clasificar_cliente tags rechazo_campana. Cooldown en n8n (días). No hay campo “no molestar” en la API.

# Prohibido
Endpoints de “predictivo” o “campaña” en Montironi. /api/v1. Dos workflows escribiendo el mismo turno sin idempotency.

# Definition of done
Cron dry-run que no contacta si falta historial/km. Outbound respeta bot_paused. Reserva pasa los mismos tests de capacidad que Caso 1. Documentá umbrales (km / meses) como variables.
```
