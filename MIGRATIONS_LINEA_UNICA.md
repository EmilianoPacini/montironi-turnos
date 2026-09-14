# Línea de migraciones única — Comunicaciones + V1.1

## Bloqueo QA (246f38c)

1. `_prisma_migrations` con linajes WAH superpuestos (80000 + 81000 / restos 71000)
2. `servicio_intervalo_km.condicion_vehiculo` en DB vs Prisma `condicion`
3. Falta merge `f46837b` (wamid, sender_user_id, clone cima 005)

## Hotfix inmediato (DB QA)

```bash
psql ... -f montironi-turnos-v1/006_fix_intervalo_condicion.sql
```

Renombra `condicion_vehiculo` → `condicion` (idempotente).

## Línea objetivo (única)

```
152000 authoritative_init
170000 v11_clients_vehicles_movimientos   # columna condicion (no condicion_vehiculo)
18xxxx wah_comunicaciones_cima_005        # UNA sola migración WAH = box 005 ★ FUENTE OFICIAL
         - whatsapp_accounts.user_id + unique parcial
         - wah_media.message_id CASCADE
         - wamid + sender_user_id
         - SIN 81000 paralelo / SIN demo simplificado residual
```

**Acción cloud agent:** en `cursor/comunicaciones-wah-6f3f` (o branch que mergee a main/PR#4):
1. Restaurar box `005_comunicaciones_wah.sql`
2. Squash/reemplazar `180000`+`181000` por una migración única alineada a 005
3. Merge commits de `f46837b` (wamid/sender_user_id)
4. Seed verde + `prisma migrate` limpio en DB fresca

## Naming cerrado V1.1

| Tabla | Columna | Tipo |
|-------|---------|------|
| vehiculo | `condicion` | enum `condicion_vehiculo` |
| servicio_intervalo_km | `condicion` | enum `condicion_vehiculo` |
| servicio_intervalo_km | `empresa_id` | recomendado Datos; Prisma hoy no lo tiene — opcional follow-up |
