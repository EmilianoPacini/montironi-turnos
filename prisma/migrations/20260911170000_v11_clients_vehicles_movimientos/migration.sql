-- V1.1: clientes E.164, vehículos extendidos, intervalos km, turno km, movimiento audit

CREATE TYPE "tipo_vehiculo" AS ENUM ('auto', 'camioneta');
CREATE TYPE "condicion_vehiculo" AS ENUM ('nuevo', 'normal', 'viejo');

-- Cliente: teléfono y apellido obligatorios
UPDATE "cliente" SET "apellido" = '' WHERE "apellido" IS NULL;
UPDATE "cliente" SET "telefono" = '+5490000000000' WHERE "telefono" IS NULL OR "telefono" = '';

ALTER TABLE "cliente" ALTER COLUMN "apellido" SET NOT NULL;
ALTER TABLE "cliente" ALTER COLUMN "telefono" SET NOT NULL;

CREATE INDEX "cliente_empresa_id_telefono_idx" ON "cliente"("empresa_id", "telefono");

-- Vehículo extendido
ALTER TABLE "vehiculo" ADD COLUMN "tipo_vehiculo" "tipo_vehiculo" NOT NULL DEFAULT 'auto';
ALTER TABLE "vehiculo" ADD COLUMN "condicion" "condicion_vehiculo" NOT NULL DEFAULT 'normal';
ALTER TABLE "vehiculo" ADD COLUMN "kilometraje_actual" INTEGER;

-- Turno kilometraje
ALTER TABLE "turno" ADD COLUMN "kilometraje" INTEGER;

-- Intervalos de servicio por tipo/condición
CREATE TABLE "servicio_intervalo_km" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "servicio_id" UUID NOT NULL,
    "tipo_vehiculo" "tipo_vehiculo" NOT NULL,
    "condicion" "condicion_vehiculo" NOT NULL,
    "intervalo_km" INTEGER NOT NULL,

    CONSTRAINT "servicio_intervalo_km_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "servicio_intervalo_km_servicio_id_tipo_vehiculo_condicion_key"
  ON "servicio_intervalo_km"("servicio_id", "tipo_vehiculo", "condicion");

ALTER TABLE "servicio_intervalo_km" ADD CONSTRAINT "servicio_intervalo_km_servicio_id_fkey"
  FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Audit movimientos
CREATE TABLE "movimiento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" UUID NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" JSONB,
    "usuario_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "movimiento_empresa_id_created_at_idx" ON "movimiento"("empresa_id", "created_at" DESC);
CREATE INDEX "movimiento_entidad_entidad_id_idx" ON "movimiento"("entidad", "entidad_id");

ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
