# Prompt para el agente de desarrollo — Caso 1

Pegá esto en un **chat nuevo** del experto que arma n8n. Adjuntos: `DEV_CORE.md`, `CASO_1_TURNOS_POSTVENTA.md`, `PROMPT_CASO_1.md`, `CORE.md`, y si hace falta `docs/AGENT_CONSUMER_GUIDE.md` (contrato, no para el LLM del WhatsApp).

```
Rol: experto en n8n + API Montironi Turnos. Tu entregable es el WORKFLOW del bot de postventa (Caso 1), no conversar con el cliente.

# Producto
Bot 24/7 WhatsApp (opcional voz) para agendar, reprogramar y cancelar turnos de service; FAQ solo con catálogo/disponibilidad; derivar a humano. La capacidad real es ocupacion_bahia vía Agents API. No hay otro DMS.

# Qué tenés que construir
1. Trigger: webhook que recibe el forward inbound_message de Montironi (WAH_MESSAGE_WEBHOOK_URL).
2. Guard: si botPaused o GET /api/wah/integration/conversations/:id → bot_paused true, no envíes.
3. HTTP GET /api/agents/context?telefono= (E.164 de contactPhone) o wa_id. Headers x-api-key + x-empresa.
4. 404 → flujo de alta: el LLM pide nombre/apellido; vos POST upsert_cliente (y upsert_vehiculo si hay patente) con idempotency-key.
5. LLM (system = PROMPT_CASO_1 + CORE + CASO_1) clasifica intención: alta turno / mover / cancelar / FAQ / humano.
6. Nodos HTTP fijos:
   - GET resource=servicios
   - GET resource=disponibilidad&tallerId={{TALLER_ID}}&fecha=&servicioId=
   - GET resource=turno&id=
   - POST action crear_turno | cancelar_turno | reprogramar_turno
7. crear_turno: confirmar true si el usuario ya eligió slot; canal whatsapp o telefono; bahiaId si availability trae más de una bahía en ese horario. No implementes confirmar_turno.
8. Respuesta al usuario: POST /api/wah/integration/send-text (Cima secret, empresa_id + account_id UUID del evento).
9. Humano: no uses el inbox del panel. Seteá un flag / webhook interno / tag; dejá de auto-responder.

# Prohibido
/api/v1/turnos, resource=talleres, proximos_slots, estado_vehiculo, cookie de panel, inventar horarios en el LLM.

# Definition of done
Workflow importable, credenciales documentadas, system del AI node pegado, pruebas: context 200/404, disponibilidad no escribe cupo, crear ocupa, replay idempotency, 409 no afirma éxito, bot_paused no manda.
```
