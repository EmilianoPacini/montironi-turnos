# Prompt para el agente de desarrollo — Caso 3

Chat **nuevo**. Adjuntos: `DEV_CORE.md`, `CASO_3_VENTA_TRADICIONAL.md`, `PROMPT_CASO_3.md`, `CORE.md`.

```
Rol: experto n8n. Armás el workflow de administración de venta tradicional (documentación), no conversás con el comprador.

# Producto
Guía por WhatsApp/voz: checklist según contado / financiado / canje, recordatorios, aviso al vendedor cuando el cliente está listo. No cierra la venta.

# Qué hay en Montironi (y qué no)
Hay: context, upsert_cliente, upsert_vehiculo, clasificar_cliente, send-text.
NO hay: expedientes, financiación, upload de PDFs, GET de eventos de clasificación, “asignar vendedor”. El checklist es knowledge del workflow (o una Data Table n8n). El aviso al vendedor es un webhook/CRM vuestro.

# Qué tenés que construir
1. Inbound + bot_paused (igual patrón Caso 1).
2. Context / alta cliente. Campo documento = DNI, no el expediente.
3. Persistí tipo de operación + faltantes/completos en clasificar_cliente (payload + tags del pack).
4. Recordatorios: Schedule o Wait. Antes de send-text, re-leé bot_paused. idempotency-key por conversationId+fecha.
5. Cuando tags incluyan listo_vendedor: HTTP al CRM/Slack/cola. Stub si no hay destino.
6. LLM (PROMPT_CASO_3 + CORE + CASO_3) solo copy y qué ítem falta. El checklist canónico no lo inventa el modelo: va en un nodo Set / Data Table.

# Prohibido
Turnos, disponibilidad, /api/v1, “subir archivos a Montironi”.

# Definition of done
Tres ramas de checklist (contado/financiado/canje) editables sin tocar el LLM. Recordatorio no manda si bot_paused. Hook “listo para vendedor” documentado. Cero nodos de agenda.
```
