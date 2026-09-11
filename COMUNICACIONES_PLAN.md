# Comunicaciones (WAH)

Ver contrato completo: [`docs/COMUNICACIONES_API.md`](docs/COMUNICACIONES_API.md)

## Fuente de verdad schema (Datos)

- SQL: [`montironi-turnos-v1/005_comunicaciones_wah.sql`](montironi-turnos-v1/005_comunicaciones_wah.sql) (shared box)
- ERD: [`montironi-turnos-v1/ERD_COMUNICACIONES.md`](montironi-turnos-v1/ERD_COMUNICACIONES.md)
- Prisma migration: `prisma/migrations/20260911182000_wah_comunicaciones_005/`

Referencia cima-ai: `docs/wah-source-reference/`

## Tenancy

Montironi usa **`empresa_id`** (UUID) en JSON de integración — no `tenant_id`.

## Tablas

`whatsapp_accounts`, `wah_conversations`, `wah_messages`, `wah_media`
