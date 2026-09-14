# API agentes — contexto rápido cliente (WSP / n8n)

**Prioridad:** una sola lectura de contexto para el bot WhatsApp.  
**Auth:** `x-api-key: AGENT_API_KEY`. **Idempotencia:** no aplica (GET).

## GET /api/agents/context

Query (uno obligatorio): `telefono` (E.164) | `wa_id` (Meta / JID) | `cliente_id`  
Opcional: `empresa` o header `x-empresa` (default `montironi`).

### Response 200 (DDL 007)
```json
{
  "cliente": { "id": "uuid", "nombre": "", "apellido": "", "telefono": "+549…", "email": null, "documento": null },
  "vehiculos": [{ "id": "", "patente": "", "marca": null, "modelo": null, "anio": null, "tipoVehiculo": "auto", "condicion": "normal", "kilometrajeActual": 0, "proximosServicios": [] }],
  "turnos": {
    "programados": [],
    "realizados": []
  },
  "buyer_profile": {
    "id": "uuid",
    "clienteId": "uuid",
    "tags": ["fiel"],
    "intencionPredominante": "service",
    "perfilBuyer": "service",
    "scoreReclamos": 0,
    "ultimaClasificacion": "vip",
    "ultimaClasificacionEn": "2026-09-11T…",
    "wahConversationId": null,
    "metadata": null,
    "updatedAt": "2026-09-11T…"
  },
  "perfilBuyer": { "...": "alias de buyer_profile" },
  "historial_services": [
    {
      "id": "uuid",
      "servicioNombre": "Cambio de aceite",
      "tipoServicioNombre": "Mecánica",
      "tallerNombre": "Centro",
      "realizadoEn": "2026-09-11T…",
      "kilometrajeKm": 55000,
      "duracionMinutos": 60,
      "precio": 95000,
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
    "lookup": "telefono|wa_id|cliente_id"
  }
}
```

- `turnos.programados`: próximos turnos no terminales (`!finalizado|cancelado|vencido|ausente`)
- `turnos.realizados`: turnos en estado `finalizado` (legacy, desde turno)
- `historial_services` / `ultimosServices`: últimos 10 de `historial_servicio`
- `meta.partial`: `false` post-DDL 007; `missing` lista campos vacíos (`buyer_profile`, `historial_services`)

404 sin cliente. 422 `ValidacionCliente` si teléfono inválido.

Compat: `GET /api/agents?resource=cliente&telefono=` sigue (shape legacy plano).

## POST /api/agents — clasificar_cliente

```json
{
  "action": "clasificar_cliente",
  "clienteId": "uuid",
  "clasificacion": "vip",
  "intencion": "service",
  "tagsDelta": ["fiel"],
  "scoreReclamosDelta": 0,
  "wahConversationId": "uuid?",
  "wahMessageId": "uuid?",
  "fuente": "integracion"
}
```

## POST /api/v1/clientes/:id/clasificaciones

Mismo body. Auth: `x-api-key` **o** cookie sesión panel.

Ver también: `docs/DOMAIN_HISTORIAL_BUYER.md`
