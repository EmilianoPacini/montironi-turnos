# Contratos Backend sugeridos — Historial + Buyer (007)

## Escritura

### Al finalizar turno (obligatorio)
Misma transacción que hoy (version + km + ocupación):

```
upsertHistorialDesdeTurnoFinalizado(turnoId)
  → INSERT historial_servicio por cada detalle_turno
    ON CONFLICT (detalle_turno_id) DO UPDATE SET
      kilometraje_km, realizado_en, resultado, ...
```

### Clasificación conversacional
```
POST /api/v1/clientes/:id/clasificaciones
{ clasificacion, intencion?, tagsDelta?, scoreReclamosDelta?, wahConversationId?, wahMessageId?, fuente }
→ INSERT evento + UPDATE perfil (ultima_*, tags merge, score += delta)
```

## Lectura bot (una sola respuesta)

### `GET /api/v1/contexto-cliente?telefono=+54911...`  
o `GET /api/agents/...` tool `contexto_cliente`

Auth: panel session **o** `X-Cima-Forward-Secret` / agent token.

```json
{
  "cliente": {
    "id": "uuid",
    "nombre": "...",
    "apellido": "...",
    "telefono": "+54911...",
    "email": null
  },
  "perfilBuyer": {
    "tags": ["buyer_caliente"],
    "intencionPredominante": "turno",
    "scoreReclamos": 0,
    "ultimaClasificacion": "consulta_turno",
    "ultimaClasificacionEn": "2026-09-11T12:00:00Z",
    "wahConversationId": "uuid|null"
  },
  "vehiculos": [
    {
      "id": "uuid",
      "patente": "AB123CD",
      "marca": "Toyota",
      "modelo": "Corolla",
      "tipoVehiculo": "auto",
      "condicion": "normal",
      "kilometrajeActual": 45200,
      "esPrincipal": true
    }
  ],
  "ultimosServices": [
    {
      "id": "uuid",
      "vehiculoId": "uuid",
      "servicioNombre": "Service 10.000 km",
      "tipoServicioNombre": "Service",
      "tallerNombre": "Taller Centro",
      "realizadoEn": "2026-08-01T15:00:00Z",
      "kilometrajeKm": 40100,
      "resultado": "realizado",
      "turnoId": "uuid"
    }
  ],
  "proximosTurnos": [
    {
      "id": "uuid",
      "estado": "confirmado",
      "iniciaEn": "...",
      "vehiculoId": "uuid",
      "servicios": ["Cambio de aceite"]
    }
  ]
}
```

Query shape sugerida:
1. `cliente` by `(empresa_id, telefono)` index
2. `cliente_perfil_buyer` by `cliente_id`
3. `cliente_vehiculo` + `vehiculo`
4. `historial_servicio` `ORDER BY realizado_en DESC LIMIT 10` (o 5)
5. `turno` no terminales futuros `LIMIT 5`

## Qué necesita Backend

1. Migración Prisma `007` / `182+` siguiente número alineada a este SQL.
2. Hook finalizar turno → proyección historial (idempotente).
3. Endpoint/tool contexto por teléfono (arriba).
4. Endpoint/tool upsert clasificación buyer.
5. Backfill historial desde turnos `finalizado` existentes.
6. (Opcional) no exponer escritura directa a `historial_servicio` desde UI — solo proyección.

## Qué NO es scope Datos

UI, copy del bot, prompts Retell/WSP, reglas de scoring de negocio (solo columnas).
