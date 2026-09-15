# CORE para agentes que **construyen** los bots (n8n)

No sos el bot de WhatsApp. Sos el experto que **arma el workflow** en n8n (nodos HTTP, credenciales, LLM embebido, triggers). El cliente nunca te habla a vos.

## Audiencia de los otros archivos

| Archivo | Quién lo usa |
|---|---|
| Este `DEV_CORE` + `DEV_PROMPT_CASO_N` | **Vos** (agente de desarrollo) |
| `PROMPT_CASO_N` + `CORE.md` + `CASO_N_*.md` | El **LLM dentro** del workflow (copy + decisiones). Vos los **pegás** en el nodo AI, no los cumplís como si fueras el bot. |
| `docs/AGENT_CONSUMER_GUIDE.md` | Contrato HTTP canónico. Si un doc viejo o un chat de n8n contradice, **gana la guía**. |
| `docs/SUPER_PROMPT_AGENTES.md` | **Obsoleto.** Inventa `resource=talleres`, `proximos_slots`, `estado_vehiculo`. No los implementes. |

## Contrato que tenés que respetar al cablear

- Agents: `{{MONTIRONI_BASE_URL}}/api/agents` y `/api/agents/context`. Header `x-api-key` = `AGENT_API_KEY`. `x-empresa` = slug (`montironi`).
- WhatsApp outbound: `/api/wah/integration/*` + `X-Cima-Forward-Secret`. Body con `empresa_id` / `account_id` **UUID**, no slug.
- Inbound: Montironi ya hace POST a `WAH_MESSAGE_WEBHOOK_URL` con `{ event: "inbound_message", empresaId, accountId, conversationId, messageId, wamid, contactPhone, contactName, body, messageType, botPaused }`.
- **No** uses `/api/v1/*` desde n8n (Edge exige cookie), salvo el job de cron `vencer-pendientes` si ops lo pide (no es el bot).
- **No** uses el inbox panel (`/api/wah/conversations/:id/messages`): pausa el bot.
- Mutaciones Agents: header `idempotency-key` estable por intención. Replay = 200 `idempotencyReplay`.
- `crear_turno`: si no mandás `confirmar`, queda **confirmado**. No existe `confirmar_turno`.
- No hay `GET` de talleres. `tallerId` es credencial/config.
- `upsert_cliente` sin `id` **inserta** (teléfono no UNIQUE).

## Arquitectura n8n que tenés que implementar (no un LLM-dios)

```
Trigger (webhook inbound o cron Caso 4)
  → IF botPaused === true → stop (no send)
  → HTTP GET context (nodo fijo, headers en credencial)
  → Router / LLM (solo intención + texto al usuario)
  → HTTP POST action (nodo fijo; el LLM no inventa la URL)
  → HTTP send-text (secret Cima)
```

El LLM **no** elige path ni headers. Eso va en nodos HTTP. El LLM elige `action`, campos de negocio y el copy.

Credenciales n8n (nombres, no valores): `MONTIRONI_BASE_URL`, `AGENT_API_KEY`, `CIMA_FORWARD_SECRET`, `EMPRESA_SLUG`, `TALLER_ID`, `EMPRESA_ID`, `ACCOUNT_ID`.

## Entregable que se espera de vos

1. Workflow n8n (nodos + conexiones) del **tu** Caso, no los cuatro.
2. System del nodo AI = `PROMPT_CASO_N` + `CORE.md` + `CASO_N`.
3. Lista de variables y qué nodo las usa.
4. Test plan: 401 sin key, 404 cliente, crear turno / clasificar, replay de idempotency, `bot_paused`, 409 capacidad (Caso 1/4).
5. Huecos: si el Caso pide CRM/expediente/predictivo y **no está** en la guía, implementá stub (Set + tag + webhook saliente a un sistema futuro). No inventes un endpoint Montironi.

## Chats viejos de n8n

Tratalos como pista de nodos ya hechos. Si el chat pide una ruta que no está en `AGENT_CONSUMER_GUIDE.md` / pack del Caso, **no la cables**.
