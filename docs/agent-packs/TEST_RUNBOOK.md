# Arrancar pruebas (UAT) — huecos cerrados lo justo

Objetivo: **probar conversación + API Montironi**. No hace falta CRM real ni FAQ legal firmada.

Hacé los pasos **en este orden**. Hasta el 3 inclusive, no hace falta n8n (sirve para saber si Montironi está vivo).

---

## 0) Montironi arriba

En el host del repo:

```bash
# .env con AGENT_API_KEY y CIMA_FORWARD_SECRET (mismo valor que vas a poner en n8n)
# Si ves <<<<<<< HEAD en .env.example, no lo copies así: resolvé el conflicto.
npm run dev
```

App: `http://localhost:43123`  
Login panel (opcional): `admin@montironi.com` / `admin123`.

Si la DB está vacía: `npx prisma migrate deploy` y `npm run db:seed`.

---

## 1) Secretos (los 3 casos) — 5 minutos

En **Montironi `.env`** y en **n8n** (variables del workflow / credencial), **el mismo** texto:

| Variable | Ejemplo (solo UAT, no prod) |
|---|---|
| `AGENT_API_KEY` | un string largo, el mismo en ambos lados |
| `CIMA_FORWARD_SECRET` | **otro** string largo, el mismo en ambos |
| `x-empresa` / `EMPRESA_SLUG` | `montironi` |

En n8n:

1. Abrí cada workflow Caso 1 / 2 / 3.
2. Buscá fallback `"secret"` o “dev” en el header `X-Cima-Forward-Secret` → **borralo**.
3. Header = expresión de la variable / credencial, nunca literal `secret`.
4. `x-api-key` = `AGENT_API_KEY` (mismo valor que `.env`).

Sin esto, `send-text` da 401 y no hay prueba de WhatsApp.

---

## 2) `TALLER_ID` (Caso 1 y 4) — 2 minutos

En `psql` o un cliente SQL contra **esta** DB (los UUID cambian si reseteaste seed):

```sql
SELECT t.id, t.nombre
FROM taller t
JOIN empresa e ON e.id = t.empresa_id
WHERE e.slug = 'montironi' AND t.activo IS TRUE;
```

Copiá el UUID de **Taller Centro** (o el que uses) a la variable n8n `TALLER_ID`.

Si no tenés SQL: panel `/bahias` o `/agenda` no siempre muestran el UUID. Prisma Studio: `npx prisma studio` → modelo `Taller` → copiar `id`.

Variable vacía → **no pruebes** crear turno.

---

## 3) Probar la API **sin** n8n (5 minutos)

Reemplazá `KEY`, `TALLER` y un `servicioId` (Prisma Studio → `Servicio`, o la respuesta del primer curl).

```bash
# Sanidad
curl -s -H "x-api-key: KEY" -H "x-empresa: montironi" http://localhost:43123/api/agents

# Cliente seed
curl -s -H "x-api-key: KEY" -H "x-empresa: montironi" ^
  "http://localhost:43123/api/agents/context?telefono=%2B5491155551001"

# Servicios
curl -s -H "x-api-key: KEY" -H "x-empresa: montironi" ^
  "http://localhost:43123/api/agents?resource=servicios"

# Disponibilidad (fecha de un día hábil, YYYY-MM-DD)
curl -s -H "x-api-key: KEY" -H "x-empresa: montironi" ^
  "http://localhost:43123/api/agents?resource=disponibilidad&tallerId=TALLER&fecha=2026-09-16&servicioId=SERVICIO"
```

Si esto falla, no publiques n8n: el bot no va a “arreglar” un 401/404.

---

## 4) Caso 2 — FAQ mínima para probar (no legal)

En n8n, variable `FAQ_PLANES` (o `faqPlanes`) **no vacía**. Pegá esto para UAT:

```
FAQ UAT — no es texto legal.
- Un plan de ahorro no es un crédito tradicional; las condiciones las confirma un asesor.
- No cotizo cuotas ni fechas de licitación/adjudicación. Eso lo da un asesor.
- Si ya tenés plan (cuota, mora, trámite): te derivo a atención.
- Si querés entrar: te hago 4 preguntas (nuevo/existente, interés, horizonte, si querés que te llamen) y dejo el contacto calificado.
```

Asignación de lead: dejá `CRM_LEAD_WEBHOOK_URL` **vacío**. Confirmá que el nodo IF va a stub (log) y el bot igual dice “un asesor te contacta”. Eso **alcanza** para probar.

---

## 5) Caso 3 — checklist + CRM stub + sesión

**CRM:** `CASO_3_CRM_WEBHOOK_URL` vacío. Stub. Alcanza para UAT.

**Checklist** (variable `CHECKLIST_VENTA` o Data Table). Pegá para probar:

```
contado: DNI frente y dorso; constancia CBU; comprobante de domicilio.
financiada: lo de contado + últimos recibos de sueldo o monotributo.
canje: lo de contado + título / cédula verde del usado; formulario 08 si aplica.
```

**Sesión:** para UAT de un solo worker, static data **sirve un rato**. Para no perder el hilo al restart: Data Table n8n keyed por `conversationId`, o confiar en `clasificar_cliente` + releer. No bloquea el **primer** test de un mensaje.

---

## 6) Publicar drafts y apuntar inbound

En **cada** workflow (1, 2, 3):

1. Tools: Caso 2 y 3 **sin** `crear_turno` / disponibilidad.
2. **Publish** (overwrite). El Test URL del editor no es el de producción.
3. Copiá la **Production URL** del webhook de n8n.

En Montironi `.env`:

```
WAH_MESSAGE_WEBHOOK_URL="https://TU-N8N/webhook/....."
```

Reiniciá `npm run dev` (el env se lee al arrancar).

Si tenés **un solo** webhook inbound para los tres casos: tiene que haber un **router** delante. Si son tres URLs, tres `WAH_MESSAGE_WEBHOOK_URL` no entran en un solo env: o un webhook router, o tres cuentas/números. Para **empezar**, apuntá el env al **Caso 1** y probá 2/3 con “Execute workflow” / webhook de test.

---

## 7) Qué probar hoy (guion)

### Caso 1

1. Publish + `TALLER_ID` + secret.
2. Mensaje: “quiero un turno”.
3. Esperado: pide/usa cliente, lista servicios **de la API**, ofrece slots **de disponibilidad**, reserva, responde horario.
4. Panel `/agenda`: el turno está. Cancelalo por el bot o el panel.

No uses un published viejo con tools de más.

### Caso 2

1. FAQ pegada, CRM vacío (stub), secret real, published.
2. “Quiero un plan de ahorro” → preguntas de calificación, **no** turnos.
3. “¿Cuánto es la cuota?” → con la FAQ de UAT: deriva, no inventa un número.

### Caso 3

1. Checklist pegado, CRM vacío, secret real, **publish**.
2. “Compro financiado, qué papeles?” → lista del checklist, no agenda.
3. “Ya tengo todo” → stub CRM + copy de vendedor.

---

## 8) No hace falta para arrancar

| Hueco | ¿Bloquea UAT? |
|---|---|
| CRM / cola real | No (stub) |
| FAQ legal firmada | No (FAQ UAT + no inventar) |
| Sesiones multi-worker | No para una prueba local |
| Predictivo Caso 4 | No (otro día) |
| `META_WHATSAPP_ACCESS_TOKEN` | Solo si el send-text pega a Graph; si el send falla por Meta, igual podés probar Agents con curl |

---

## Si algo falla

| Síntoma | Causa típica |
|---|---|
| 401 Agents | `AGENT_API_KEY` distinta |
| 401 send-text | `CIMA_FORWARD_SECRET` distinta o fallback `secret` |
| 404 Empresa | `x-empresa` ≠ `montironi` o DB sin seed |
| 404 taller / RecursoNoEncontrado | `TALLER_ID` de otro ambiente |
| WhatsApp no llega a n8n | `WAH_MESSAGE_WEBHOOK_URL` vacío, o Test URL, o published viejo |
| Caso 2 crea turnos | tools prohibidas en el published |
| Caso 3 “se olvida” el checklist | static data + restart; usá Data Table para el 2º día de prueba |
