-- ModoPrecio enum and service/detail columns
CREATE TYPE "ModoPrecio" AS ENUM ('fijo', 'desde', 'a_presupuestar');

ALTER TABLE "servicio" ADD COLUMN "modo_precio" "ModoPrecio" NOT NULL DEFAULT 'fijo';
ALTER TABLE "detalle_turno" ADD COLUMN "modo_precio_snapshot" "ModoPrecio" NOT NULL DEFAULT 'fijo';

-- Move configuracion_turnos from empresa to taller
ALTER TABLE "configuracion_turnos" ADD COLUMN "taller_id" TEXT;

CREATE TEMP TABLE "_cfg_backup" AS
SELECT COALESCE(MAX("margen_min"), 15) AS margen_min FROM "configuracion_turnos";

DELETE FROM "configuracion_turnos";

ALTER TABLE "configuracion_turnos" DROP CONSTRAINT IF EXISTS "configuracion_turnos_empresa_id_fkey";
ALTER TABLE "configuracion_turnos" DROP CONSTRAINT IF EXISTS "configuracion_turnos_empresa_id_key";
ALTER TABLE "configuracion_turnos" DROP COLUMN "empresa_id";

INSERT INTO "configuracion_turnos" ("id", "taller_id", "margen_min")
SELECT
  md5(random()::text || t.id)::text,
  t.id,
  (SELECT margen_min FROM "_cfg_backup")
FROM "taller" t;

ALTER TABLE "configuracion_turnos" ALTER COLUMN "taller_id" SET NOT NULL;
CREATE UNIQUE INDEX "configuracion_turnos_taller_id_key" ON "configuracion_turnos"("taller_id");
ALTER TABLE "configuracion_turnos" ADD CONSTRAINT "configuracion_turnos_taller_id_fkey"
  FOREIGN KEY ("taller_id") REFERENCES "taller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "_cfg_backup";
