# API agentes — contexto rápido cliente (WSP / n8n)

**Prioridad:** una sola lectura de contexto para el bot WhatsApp.  
**Auth:** `x-api-key: AGENT_API_KEY`. **Idempotencia:** no aplica (GET).

## GET /api/agents/context

Query (uno obligatorio): `telefono` (E.164) | `wa_id` (Meta / JID) | `cliente_id`  
Opcional: `empresa` o header `x-empresa` (default `montironi`).

### Response 200
```json
{
  "cliente": { "id": "uuid", "nombre": "", "apellido": "", "telefono": "+549…", "email": null, "documento": null },
  "vehiculos": [{ "id": "", "patente": "", "marca": null, "modelo": null, "anio": null, "tipoVehiculo": "auto", "condicion": "normal", "kilometrajeActual": 0, "proximosServicios": [] }],
  "turnos": { "programados": [], "realizados": [] },
  "buyer_profile": null,
  "historial_services": null,
  "meta": { "partial": true, "missing": ["buyer_profile", "historial_services"], "lookup": "telefono|wa_id|cliente_id" }
}
```

404 sin cliente. 422 `ValidacionCliente` si teléfono inválido.  
Sin DDL Datos: stubs null + `meta.partial=true`. `turnos.realizados` = estado finalizado.

Compat: `GET /api/agents?resource=cliente&telefono=` sigue (shape legacy plano).

## Onboarding n8n (listo)

`POST /api/agents` `{ action: "upsert_cliente", nombre, apellido, telefono, … }` → 422 E.164  
`POST /api/agents` `{ action: "upsert_vehiculo", patente, clienteId, … }`  
Flujo: upsert_cliente → upsert_vehiculo → GET /context?telefono=

## Plan
1. Contrato + GET /context + wa_id → E.164 (este change)
2. upsert_* ya OK
3. Cuando Datos entregue buyer/historial → poblar campos (mismo contrato)
