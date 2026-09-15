# Ops — datos faltantes antes de publicar

Tres tipos de hueco. No los trates igual.

| Tipo | Qué hacer | ¿Publicar? |
|---|---|---|
| **Bloqueante** | Sin esto el bot miente o pisa capacidad | No |
| **Stub OK** | El flujo conversa; la integración real queda “pendiente” | Sí, con cartel de UAT |
| **Solo draft** | Published viejo tiene tools/secret mal | No apuntes inbound al published |

Regla: si falta un **UUID o secret de Montironi**, no publiques. Si falta **CRM / FAQ / expediente**, publicá solo si el bot **deriva o stubbea** y no inventa el destino.

---

## Compartido (Casos 1–3)

### `CIMA_FORWARD_SECRET`

**Bloqueante** para cualquier `send-text`.

- Tiene que ser **el mismo** valor que `CIMA_FORWARD_SECRET` en el `.env` de Montironi (timing-safe; si no coincide → 401).
- Sacá el fallback `"secret"` / “dev” del workflow. En n8n: credencial, no literal en el nodo.
- Hasta no setearlo: el LLM puede “pensar”; **n8n no manda** WhatsApp (IF secret vacío → stop + log).

### Publicado vs draft

Inbound (`WAH_MESSAGE_WEBHOOK_URL` / production URL de n8n) tiene que apuntar a la **versión publicada nueva**.  
Si el published viejo todavía tiene tools de turnos en Caso 2/3 o secret de mentira: **no apuntes tráfico**. Dejá el draft hasta el checklist.

### `AGENT_API_KEY` / `x-empresa` / `EMPRESA_ID` / `ACCOUNT_ID`

- Key y slug: obligatorios si hay `GET /api/agents`.
- `empresa_id` + `account_id` (UUID): salen del payload `inbound_message`. No los hardcodees si el webhook ya los trae.
- `ACCOUNT_ID` fijo en credencial solo si el número es uno solo y el evento no viene.

---

## Caso 1 — `TALLER_ID`

**Bloqueante.** Sin UUID real, `disponibilidad` y `crear_turno` fallan o pegan a un taller inexistente (404).

No hay `GET /api/agents?resource=talleres`. Ops lo saca de la DB o del panel (admin).

```sql
SELECT t.id, t.nombre
FROM taller t
JOIN empresa e ON e.id = t.empresa_id
WHERE e.slug = 'montironi' AND t.activo IS TRUE;
```

Seed típico: “Taller Centro”, “Taller Norte” — **los UUID cambian** en cada `migrate reset`. No copies un UUID de otro ambiente.

**Cómo manejarlo**

1. Un taller default en variable `TALLER_ID`.
2. Si hay dos: `TALLER_ID_CENTRO` + `TALLER_ID_NORTE`; el LLM/router elige el **nombre**, n8n manda el UUID.
3. Workflow: IF `TALLER_ID` vacío → no llames disponibilidad; respondé “ahora no puedo ver la agenda” y no publiques.

Publicar solo cuando: UUID seteado **y** draft nuevo (sin tools prohibidas) **publicado**.

---

## Caso 2 — FAQ y asignación

### FAQ (`faqPlanes` / `$vars.FAQ_PLANES`)

**No bloquea** el inbound si el bot **no inventa**.  
**Bloquea** “resolver cuotas/licitaciones” en prod.

**Cómo manejarlo**

1. Ops pega un markdown corto en variable n8n (cuotas, plazos, “esto no lo digo: derivá”).
2. Nodo IF: si FAQ vacío → el LLM solo califica y deriva; system: “sin FAQ no respondas números de plan”.
3. Cuando legal/comercial firme el texto, cargalo y republicá. No hace falta API Montironi.

### HTTP asignar lead

**Stub OK** para UAT de conversación.

- Nodo: IF `CRM_LEAD_WEBHOOK_URL` vacío → Set `{ assigned: false, stub: true }` + log. El bot dice “un asesor te contacta”.
- Cuando exista cola/CRM: misma forma de payload (`clienteId`, `telefono`, `clasificacion`, `payload`). Un HTTP POST. No inventes `/api/agents/leads`.

### Publicar

Podés publicar inbound si: secret real, FAQ vacía **con** fail-closed, asignación stub.  
No prometas “asignación automática” en el copy hasta el HTTP real.

---

## Caso 3 — CRM, sesiones, draft

### `CASO_3_CRM_WEBHOOK_URL` vacío

Igual que Caso 2: **stub OK**.  
`listo_vendedor` → Set + log. El cliente oye “te contacta un vendedor”; nadie recibe el aviso hasta que ops ponga la URL.

### Sesiones en static data

**No uses static data de n8n en prod** (se pierde en restart / no es multi-worker).

**Cómo manejarlo** (en este orden):

1. **Canónico:** estado de docs en `clasificar_cliente` (`payload.faltantes`, tags). Releé context + último payload que n8n haya guardado en Data Table.
2. **n8n Data Table** keyed por `conversationId` (sobrevive restart si el volumen es el de n8n).
3. Evitá “memoria” solo en el LLM.

Static data = solo prototipo local.

### Draft no publicado

No apuntes inbound. Checklist: secret ≠ `"secret"`, checklist de papeles en Data Table/vars (no en el LLM), CRM stub o URL real, sesión no-static.

---

## Mini ritual de publish (los 3)

1. Variables de **este** ambiente (dev ≠ prod UUID/secret).
2. Dry-run: un mensaje de prueba **sin** usuarios reales.
3. Publish **overwrite** del workflow que escucha el webhook.
4. En Montironi, `WAH_MESSAGE_WEBHOOK_URL` = URL **production** de n8n (no test-url del editor).
5. Un inbound real: si Caso 1, crear turno en un slot de prueba y cancelarlo.

---

## Qué pedirle a ops (copy-paste)

```
Caso 1
- [ ] TALLER_ID (y opcional TALLER_ID_2) desde SQL/panel de ESTE ambiente
- [ ] CIMA_FORWARD_SECRET = mismo que Montironi (sin fallback)
- [ ] Publicar draft nuevo; inbound al published nuevo

Caso 2
- [ ] FAQ_PLANES texto firmado o “vacío = solo calificar/derivar”
- [ ] CRM_LEAD_WEBHOOK_URL o explícito “stub”
- [ ] CIMA_FORWARD_SECRET real
- [ ] Inbound al published

Caso 3
- [ ] Checklist contado/financiado/canje en variable o Data Table
- [ ] CASO_3_CRM_WEBHOOK_URL o “stub”
- [ ] Estado de sesión en Data Table / clasificar, no static data
- [ ] CIMA_FORWARD_SECRET real
- [ ] Publicar draft
```

Caso 4, cuando lo activen: mismos `TALLER_ID` + secret que Caso 1; el cron no sale si context no trae historial/km.
