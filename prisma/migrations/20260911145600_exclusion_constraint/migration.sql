-- Enable btree_gist for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent overlapping active ocupaciones on the same bahia
ALTER TABLE ocupacion_bahia
ADD CONSTRAINT ocupacion_bahia_no_overlap
EXCLUDE USING gist (
  bahia_id WITH =,
  tsrange(inicio, fin, '[)') WITH &&
)
WHERE (activo = true);
