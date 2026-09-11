# ERD — Comunicaciones (WAH) ★ clone cima

**Fuente oficial DDL:** `005_comunicaciones_wah.sql`  
**Referencia:** `docs/wah-source-reference/wah.ts` (cima-ai)

## Shape cerrado (PO: clone literal cima)

| Regla | Constraint exacto |
|-------|-------------------|
| Titular de línea | `whatsapp_accounts.user_id` → `usuario(id)` ON DELETE SET NULL |
| Unique titular | `CREATE UNIQUE INDEX whatsapp_accounts_user_id_uidx ON whatsapp_accounts (user_id) WHERE user_id IS NOT NULL` |
| **NO** assignee en conversación | `wah_conversations` **sin** `user_id` |
| Media cuelga del mensaje | `wah_media.message_id uuid NOT NULL REFERENCES wah_messages(id) ON DELETE CASCADE` |
| **NO** media_id en mensaje | `wah_messages` **sin** `media_id` |

## Cardinalidades

```
empresa 1 ─── N whatsapp_accounts
usuario 0..1 ── N whatsapp_accounts     (user_id; unique parcial)
whatsapp_accounts 1 ─── N wah_conversations
cliente 0..1 ── N wah_conversations     (cliente_id — único extra Montironi)
wah_conversations 1 ─── N wah_messages
wah_messages 1 ─── N wah_media          (message_id CASCADE)
usuario 0..1 ── N wah_messages          (sender_user_id)
```

## Diff vs 005 forjado en repo (invalidado)

| Forjado (cloud agent) | Oficial (este ERD / 005) |
|------------------------|---------------------------|
| `wah_conversations.user_id` | `whatsapp_accounts.user_id` |
| `wah_messages.media_id` SET NULL | `wah_media.message_id` CASCADE |
| sin `accounts.user_id` | con `accounts.user_id` |

PASS = Prisma + migración coinciden con `005_comunicaciones_wah.sql` del box (header ★ FUENTE OFICIAL).
