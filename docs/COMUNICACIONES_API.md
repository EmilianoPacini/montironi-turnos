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

## Env

| Variable | Uso |
|----------|-----|
| `CIMA_FORWARD_SECRET` | Auth integración |
| `META_WHATSAPP_ACCESS_TOKEN` | Graph API (opcional dev) |
| `WAH_MESSAGE_WEBHOOK_URL` | Webhook post-envío humano |
| `WAH_MEDIA_DIR` | Media inbound |
| `WAH_SEND_FILES_DIR` | Media outbound |

## Referencia

Schemas y auth: `docs/wah-source-reference/lib-wah/`
