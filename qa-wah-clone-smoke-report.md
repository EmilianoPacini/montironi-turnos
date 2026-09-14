# QA Comunicaciones WAH clone — `246f38c`

**Rama:** `cursor/comunicaciones-wah-ui-fb11` @ `246f38c`  
**App:** `:43123` · Postgres `:5433`  
**Anula** el PASS del panel simplificado `39d8787` (HOLD Emi).

## Verdict: **FAIL / NO GO** (bloqueos Datos) — funcional clone **19/21 PASS**

UI + APIs del clone cima-ai OK. No se marca PASS de release por historial de migraciones cruzado y `db:setup` roto.

### Checklist Emi

| Ítem | Resultado |
|------|-----------|
| Tablas `whatsapp_accounts` / `wah_conversations` / `wah_messages` / `wah_media` con `empresa_id` | **PASS** |
| Seed demo placeholder `phone_number_id=100000000000000` label Montironi Postventa | **PASS** (seed mínimo QA; `npm run db:setup` full **FAIL**) |
| UI `/comunicaciones`: Cima AI, contactos `w-[270px]`, chat, KPIs, account switcher | **PASS** |
| APIs accounts / conversations / detail+messages / dashboard | **PASS** |
| Send panel `{body}` → SQL `bot_paused=true` | **PASS** |
| Resume bot → `bot_paused=false` | **PASS** |
| Integration send-text sin `X-Cima-Forward-Secret` → 401 | **PASS** |
| Integration send-text con secret + `empresa_id`/`account_id`/`to`/`text` → 200 | **PASS** |
| Sin hardcode Meta token | **PASS** |
| Historial migraciones limpio | **FAIL Datos** (`71000` + `80000` + `81000`) |
| `db:setup` / seed completo | **FAIL Datos** (`condicion` vs `condicion_vehiculo`) |
| Align Datos 005 `f46837b` (`wamid`/`sender_user_id`) | **PENDIENTE** (no en `246f38c`) |

### SQL evidencia

```sql
SELECT phone_number_id, display_phone_number, label, empresa_id FROM whatsapp_accounts;
-- 100000000000000 | +54 351 555-0100 | Montironi Postventa | 9db43ec7-...

SELECT migration_name FROM _prisma_migrations ORDER BY finished_at;
-- ...80000_wah_comunicaciones
-- ...71000_wah_comunicaciones   << conflicto
-- ...81000_wah_replace_simplified_demo

SELECT column_name FROM information_schema.columns
WHERE table_name='servicio_intervalo_km';
-- condicion_vehiculo (DB) vs Prisma 246 mapea "condicion" → rompe seed
```

### Bugs

1. **Datos [alta]** — migraciones `71000` y `80000/81000` coexisten; `db:setup` no es reproducible. Unificar línea (ideal merge `f46837b` / 005) + runbook de reset.
2. **Datos [alta]** — drift `servicio_intervalo_km.condicion` vs `condicion_vehiculo` (+`empresa_id`).
3. **Backend/Datos [media]** — merge pendiente `f46837b` para `wamid` / `sender_user_id`.

### Nota
Smoke usó seed WAH mínimo porque el seed Prisma oficial aborta a mitad. Unit `wah-integration-auth` 2/2 PASS.
