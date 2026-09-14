# QA WAH release smoke — main `2a385c0`

**Fecha:** 2026-09-11  
**SHA:** `2a385c0` (`Merge comunicaciones-wah-6f3f: WAH schema 005 oficial (md5 6f528869) + seed`)  
**Ancestro Datos:** `d6d5fa9` ✓  
**005 md5:** `6f528869649dbbb4a4ef1782e6ee18b5` PASS  
**Veredicto:** **PASS → release GO**

## Checklist Emi Work

1. checkout tip + `migrate deploy` + seed — PASS  
2. SQL: `whatsapp_accounts.user_id` · `wah_media.message_id` CASCADE · sin `media_id` en `wah_messages` — PASS  
3. Migraciones únicas `152→170→182` — PASS  
4. UI `/comunicaciones` + APIs + bot pause/resume + integration secret — PASS (**24/24**)

Log: `/tmp/qa-wah-2a385c0-smoke2.log`  
App: `http://localhost:43123`
