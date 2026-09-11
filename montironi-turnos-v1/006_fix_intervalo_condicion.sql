-- =============================================================================
-- 006_fix_intervalo_condicion.sql
-- Idempotente. Orden crítico (QA): CONSTRAINT → INDEX → ADD UNIQUE → empresa_id.
-- =============================================================================

BEGIN;

-- (1) RENAME columna si hace falta
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'servicio_intervalo_km'
      AND column_name = 'condicion_vehiculo'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'servicio_intervalo_km'
      AND column_name = 'condicion'
  ) THEN
    ALTER TABLE servicio_intervalo_km RENAME COLUMN condicion_vehiculo TO condicion;
  END IF;
END $$;

-- (2) Unique — PRIMERO constraints, DESPUÉS indexes (si dropeas index
--     que respalda un constraint, Postgres aborta).
ALTER TABLE servicio_intervalo_km
  DROP CONSTRAINT IF EXISTS uq_servicio_intervalo_km;
ALTER TABLE servicio_intervalo_km
  DROP CONSTRAINT IF EXISTS servicio_intervalo_km_servicio_id_tipo_vehiculo_condicion_key;
ALTER TABLE servicio_intervalo_km
  DROP CONSTRAINT IF EXISTS servicio_intervalo_km_servicio_id_tipo_vehiculo_condicion_vehiculo_key;

DROP INDEX IF EXISTS uq_servicio_intervalo_km;
DROP INDEX IF EXISTS servicio_intervalo_km_servicio_id_tipo_vehiculo_condicion_key;
DROP INDEX IF EXISTS servicio_intervalo_km_servicio_id_tipo_vehiculo_condicion_vehiculo_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'servicio_intervalo_km'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(servicio_id, tipo_vehiculo, condicion)%'
  ) THEN
    ALTER TABLE servicio_intervalo_km
      ADD CONSTRAINT uq_servicio_intervalo_km
      UNIQUE (servicio_id, tipo_vehiculo, condicion);
  END IF;
END $$;

-- (3) empresa_id nullable temporal (seed Prisma sin empresaId).
--     Target: mapear empresaId en Prisma + seed, luego SET NOT NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'servicio_intervalo_km'
      AND column_name = 'empresa_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE servicio_intervalo_km ALTER COLUMN empresa_id DROP NOT NULL;
  END IF;
END $$;

COMMIT;
