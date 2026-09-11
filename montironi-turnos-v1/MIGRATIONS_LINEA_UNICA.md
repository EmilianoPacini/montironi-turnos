# Línea única de migraciones WAH

## Cadena limpia (branch `cursor/comunicaciones-wah-6f3f`)

| Orden | Migración | Contenido |
|-------|-----------|-----------|
| 1 | `20260911152000_authoritative_init` | Init base Montironi |
| 2 | `20260911170000_v11_clients_vehicles_movimientos` | Clientes, vehículos, movimientos |
| 3 | `20260911182000_wah_comunicaciones_005` | WAH — alineado Datos `005_comunicaciones_wah.sql` |

**No usar** la cadena divergente de `main` @ `d8592c8` (PR #4):

- `20260911180000_wah_comunicaciones` — enums PG, sin `whatsapp_accounts.user_id`, `wah_messages.media_id → wah_media SET NULL`
- `20260911181000_wah_replace_simplified_demo` — reemplazo demo

Merge de `cursor/comunicaciones-wah-6f3f` → `main` debe **eliminar** `80000`/`81000` y dejar solo `182000`.

## Validación Datos 005

```bash
bash scripts/validate-datos-005.sh
```

Esperado: md5 `6f528869649dbbb4a4ef1782e6ee18b5` + header `★ FUENTE OFICIAL`.

## Validación estructural (schema shape)

Requisitos PASS:

1. `whatsapp_accounts.user_id` + índice parcial UNIQUE `whatsapp_accounts_user_id_uidx`
2. `wah_conversations` **sin** `user_id`
3. `wah_media.message_id` NOT NULL ON DELETE CASCADE
4. `wah_messages` **sin** `media_id`

## DBs sucias (columna condicion)

Si una DB legacy tiene `condicion_vehiculo` en lugar de `condicion`, aplicar `006_fix_intervalo_condicion.sql` desde el shared box (md5 `a06011fe8277a55c99f95c4ff8231799`).
