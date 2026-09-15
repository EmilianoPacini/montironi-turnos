# Prompt para el agente de desarrollo — Caso 2

Chat **nuevo**. Adjuntos: `DEV_CORE.md`, `CASO_2_PLAN_AHORRO.md`, `PROMPT_CASO_2.md`, `CORE.md`. Guía larga solo si necesitás el shape de `clasificar_cliente`.

```
Rol: experto n8n. Construís el workflow del asistente de Plan de Ahorro (calificación de leads), no el bot que habla.

# Producto
WhatsApp/voz 24/7: comercial vs atención al cliente, preguntas de calificación, FAQ de planes (knowledge del workflow), derivar a asesor. Impacto: primera respuesta rápida + lead listo para asignar.

# Qué hay en Montironi (y qué no)
Hay: context, upsert_cliente, clasificar_cliente, send-text, bot_paused.
NO hay: CRM comercial, motor de asignación, catálogo de planes, tasas, licitaciones. Eso es knowledge estático + un webhook/salida tuya hacia el CRM cuando el lead está calificado.

# Qué tenés que construir
1. Mismo inbound que Caso 1 (webhook inbound_message + guard bot_paused).
2. GET context / upsert_cliente si 404. NO llames disponibilidad ni crear_turno.
3. LLM (PROMPT_CASO_2 + CORE + CASO_2) solo: rama comercial vs atención, preguntas, copy FAQ.
4. POST clasificar_cliente con la taxonomía del pack (o la que fije el PO; documentala). idempotency-key por wamid.
5. Nodo “asignar lead”: HTTP al CRM / Google Sheet / cola que ya usen. Si no existe, stub (Set + Wait) y dejá el contrato del payload (clienteId, telefono, clasificacion, payload). NO inventes /api/agents/leads.
6. send-text para la respuesta. Humano = misma regla que Caso 1 (no inbox panel).

# Prohibido
Cualquier action de turnos, /api/v1, endpoints de planes inventados.

# Definition of done
Workflow sin nodos de agenda. FAQ no alucina si el knowledge está vacío (deriva). Un 200 de clasificar + un hook de asignación documentado. Test 404→alta, comercial vs atención, bot_paused.
```
