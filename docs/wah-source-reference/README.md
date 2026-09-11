# Wah source reference — Comunicaciones panel

Referencia del panel de chat WhatsApp (WAH) usado para portar `WahChatPanel` a Tailwind / Cima AI.

## API (`/api/wah/*`)

Todas las rutas requieren sesión de panel (cookie iron-session).

### `GET /api/wah/contacts?search=`

Lista conversaciones ordenadas por último mensaje.

```json
{
  "contacts": [
    {
      "id": "uuid",
      "telefono": "+5491155551001",
      "nombre": "María González",
      "clienteId": "uuid|null",
      "ultimoMensaje": "¿Tienen turno para el viernes?",
      "ultimoMensajeAt": "2026-09-11T14:30:00.000Z",
      "noLeidos": 2
    }
  ]
}
```

### `GET /api/wah/kpis`

Métricas compactas para la franja superior.

```json
{
  "kpis": {
    "conversacionesActivas": 12,
    "sinResponder": 3,
    "mensajesHoy": 28,
    "tiempoMedioRespuestaMin": 8
  }
}
```

### `GET /api/wah/chats/:chatId/messages`

Historial de mensajes; marca como leídos los entrantes pendientes.

```json
{
  "contact": { "...": "WahContact" },
  "messages": [
    {
      "id": "uuid",
      "direccion": "entrante",
      "cuerpo": "Hola, quiero un turno",
      "enviadoAt": "2026-09-11T14:00:00.000Z",
      "leido": true
    }
  ]
}
```

### `POST /api/wah/chats/:chatId/messages`

```json
{ "text": "¡Hola! Te confirmo disponibilidad." }
```

Respuesta: `{ "message": { ...WahMessage } }`

## Layout

- Columna contactos: **270px** (`w-[270px]`)
- Franja KPI: altura compacta (~56px)
- Área chat: flex-1, mensajes con scroll + compositor fijo abajo

## Componentes

- `components/WahChatPanel.tsx` — contenedor principal (fetch + layout)
- `components/WahContactsList.tsx` — lista con búsqueda y teclado
- `components/WahKpiStrip.tsx` — métricas
- `components/WahMessageThread.tsx` — burbujas + compositor
