# Packs Montironi — dos audiencias

Hay **dos tipos** de agente. No les mandes el mismo prompt.

| Audiencia | Qué hace | Qué le das |
|---|---|---|
| **Dev / n8n** (este era el objetivo) | Crea el workflow | `DEV_CORE.md` + `DEV_PROMPT_CASO_N.md` + pack `CASO_N` + (opcional) guía |
| **Bot runtime** (LLM dentro de n8n) | Habla con el cliente | `PROMPT_CASO_N.md` + `CORE.md` + `CASO_N_*.md` |

Los `PROMPT_CASO_*` y `CORE.md` **no** son para el chat del desarrollador: el dev los **incrusta** en el nodo AI del workflow.

## Cómo briefing al experto de n8n (chat **nuevo**, uno por Caso)

1. Pegá el bloque \`\`\` de `DEV_PROMPT_CASO_N.md`.
2. Adjuntá `DEV_CORE.md` y el `CASO_N_*.md` de ese Caso.
3. Adjuntá `PROMPT_CASO_N.md` + `CORE.md` y decí: “esto va en el system del LLM del workflow, no lo ejecutes vos”.
4. Si el Caso toca HTTP fino: `docs/AGENT_CONSUMER_GUIDE.md`.
5. **No** adjuntar `SUPER_PROMPT_AGENTES.md`.
6. Chats viejos de n8n: solo para copiar node IDs / payloads reales, no como system.

| Caso | Prompt al dev |
|---|---|
| 1 Turnos postventa | `DEV_PROMPT_CASO_1.md` |
| 2 Plan de ahorro | `DEV_PROMPT_CASO_2.md` |
| 3 Venta tradicional | `DEV_PROMPT_CASO_3.md` |
| 4 Mantenimiento proactivo | `DEV_PROMPT_CASO_4.md` (+ `CASO_1` para la reserva) |

## Variables (n8n credentials, no en el prompt)

`MONTIRONI_BASE_URL`, `AGENT_API_KEY`, `CIMA_FORWARD_SECRET`, `EMPRESA_SLUG`, `TALLER_ID`, `EMPRESA_ID`, `ACCOUNT_ID`.

Dev: `http://localhost:43123`.

## API por Caso (este repo)

| Caso | Agents | Hueco |
|---|---|---|
| 1 | context, servicios, disponibilidad, turno, crear/cancelar/reprogramar, upsert | FAQ extra-catálogo |
| 2 | context, upsert_cliente, clasificar | CRM / asignación / planes |
| 3 | context, upsert_*, clasificar | Expediente / docs / vendedor |
| 4 | igual que 1 + outbound | Predictivo / cron de campaña (n8n) |

Fuente HTTP: `docs/AGENT_CONSUMER_GUIDE.md`.
