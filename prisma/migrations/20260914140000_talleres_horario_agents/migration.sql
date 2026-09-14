-- Dirección estructurada, reglas de agenda, franjas de excepción,
-- cambios de horario versionados, snapshot de bahía en historial.

CREATE TYPE "estado_cambio_horario" AS ENUM ('borrador', 'confirmado', 'cancelado');

ALTER TABLE "taller"
  ADD COLUMN "calle" TEXT,
  ADD COLUMN "numero" TEXT,
  ADD COLUMN "localidad" TEXT,
  ADD COLUMN "provincia" TEXT,
  ADD COLUMN "codigo_postal" TEXT;

ALTER TABLE "configuracion_turnos"
  ADD COLUMN "intervalo_inicio_minutos" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "anticipacion_minima_horas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "anticipacion_maxima_dias" INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN "permite_cancelacion" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "horas_limite_cancelacion" INTEGER NOT NULL DEFAULT 24;

ALTER TABLE "excepcion_horario"
  ADD COLUMN "franjas" JSONB;

CREATE TABLE "cambio_horario" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "taller_id" UUID NOT NULL,
  "aplica_desde" DATE NOT NULL,
  "franjas" JSONB NOT NULL,
  "preview_hash" TEXT NOT NULL,
  "estado" "estado_cambio_horario" NOT NULL DEFAULT 'borrador',
  "confirmado_en" TIMESTAMPTZ(6),
  "confirmado_por_usuario_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "cambio_horario_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cambio_horario"
  ADD CONSTRAINT "cambio_horario_taller_id_fkey"
  FOREIGN KEY ("taller_id") REFERENCES "taller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cambio_horario"
  ADD CONSTRAINT "cambio_horario_confirmado_por_usuario_id_fkey"
  FOREIGN KEY ("confirmado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ix_cambio_horario_taller_aplica" ON "cambio_horario" ("taller_id", "aplica_desde");

CREATE UNIQUE INDEX "cambio_horario_taller_aplica_desde_confirmado_uidx"
  ON "cambio_horario" ("taller_id", "aplica_desde")
  WHERE "estado" = 'confirmado';

ALTER TABLE "historial_servicio"
  ADD COLUMN "bahia_id" UUID,
  ADD COLUMN "bahia_nombre" TEXT;

ALTER TABLE "historial_servicio"
  ADD CONSTRAINT "historial_servicio_bahia_id_fkey"
  FOREIGN KEY ("bahia_id") REFERENCES "bahia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
