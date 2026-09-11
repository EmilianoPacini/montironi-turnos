# Comunicaciones (WAH) — API Contract

Contratos literales compatibles con cima-ai `/api/wah/*`. Montironi usa **`empresa_id`** (UUID FK) en lugar de `tenant_id`.

## Auth

| Superficie | Mecanismo |
|------------|-----------|
| Panel | Cookie de sesión (`admin` / `empleado`) |
| Integración | Header `X-Cima-Forward-Secret` = env `CIMA_FORWARD_SECRET` (comparación timing-safe). **401** si no coincide. |

## Panel

### `GET /api/wah/accounts`

```json
{ "accounts": [{ "id", "label", "phoneNumberId", "displayPhoneNumber", "active" }] }
```

### `GET /api/wah/dashboard?accountId=<uuid?>`

```json
{ "kpis": { "total", "unread", "pending", "botPaused" } }
```

### `GET /api/wah/conversations?accountId=<uuid?>&filter=all|pending|unread`

```json
{ "conversations": [{ "id", "accountId", "contactName", "contactPhone", "lastMessagePreview", "lastMessageAt", "unreadCount", "botPaused", "pendingHuman", "clienteId", "cliente" }] }
```

### `GET /api/wah/conversations/:id`

```json
{ "conversation": { ... }, "messages": [{ "id", "direction", "senderType", "messageType", "body", "status", "createdAt", "media" }] }
```

### `POST /api/wah/conversations/:id/messages`

Request:

```json
{ "body": "Texto del operador", "generatedByAi": false }
```

Comportamiento: persiste outbound + **`bot_paused=true`** en la misma transacción DB.

Response:

```json
{ "message": { ... }, "botPaused": true }
```

### `POST /api/wah/conversations/:id/bot/resume`

Response:

```json
{ "botPaused": false }
```

### `GET /api/wah/media/:mediaId`

Binary stream. Requiere sesión panel. Aislamiento por `empresa_id`.

---

## Integración

Todas requieren `X-Cima-Forward-Secret`.

### `POST /api/wah/integration/send-text`

Body (`sendWahTextIntegrationSchema`):

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

Response:

```json
{
  "conversation_id": "uuid",
  "message_id": "uuid",
  "wa_message_id": "string",
  "message": { ... }
}
```

### `POST /api/wah/integration/send-audio`

Body (`sendWahAudioIntegrationSchema`):

```json
{
  "empresa_id": "uuid",
  "account_id": "uuid",
  "to": "+549...",
  "audio_url": "https://...",
  "filename": "opcional",
  "contact_name": "opcional",
  "conversation_id": "uuid opcional"
}
```

### `POST /api/wah/integration/send-file`

Body (`sendWahFileIntegrationSchema`):

```json
{
  "empresa_id": "uuid",
  "account_id": "uuid",
  "to": "+549...",
  "file_url": "https://...",
  "filename": "doc.pdf",
  "caption": "opcional",
  "contact_name": "opcional",
  "conversation_id": "uuid opcional"
}
```

### `GET /api/wah/integration/media/:mediaId?empresa_id=<uuid>`

Binary stream. Requiere secret + query `empresa_id`.

---

## Webhook inbound (Meta → Montironi)

### `POST /api/webhooks/whatsapp/received-data`

Auth: header `X-Cima-Forward-Secret` = env `CIMA_FORWARD_SECRET` (timing-safe). **401** si no coincide.

Body: payload Meta Cloud API (`entry[].changes[].value`).

Comportamiento:

1. Lee `metadata.phone_number_id` → lookup `whatsapp_accounts` → **404** si no existe
2. Mensajes inbound: idempotencia por `wamid`; persiste `wah_messages` + `wah_media.message_id` CASCADE
3. Contacto en `wa_contact_id` / `contact_phone` (normalizado E.164)
4. Statuses Meta: actualiza `wah_messages.status` por `wamid`
5. Si `bot_paused=false` y `WAH_MESSAGE_WEBHOOK_URL`: forward POST a n8n (`event: inbound_message`)

Response:

```json
{
  "messages": [{ "wamid": "...", "messageId": "uuid", "skipped": false }],
  "statuses": [{ "wamid": "...", "status": "delivered", "updated": 1 }]
}
```

---

## Env

| Variable | Uso |
|----------|-----|
| `CIMA_FORWARD_SECRET` | Auth integración |
| `META_WHATSAPP_ACCESS_TOKEN` | Graph API (opcional dev) |
| `WAH_MESSAGE_WEBHOOK_URL` | Webhook post-envío humano + inbound (cuando bot no pausado) |
| `WAH_MEDIA_DIR` | Media inbound |
| `WAH_SEND_FILES_DIR` | Media outbound |

## Referencia

Schemas y auth: `docs/wah-source-reference/lib-wah/`
