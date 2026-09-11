BEGIN;
CREATE TABLE IF NOT EXISTS historial_servicio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL REFERENCES cliente (id) ON DELETE RESTRICT,
  vehiculo_id uuid NOT NULL REFERENCES vehiculo (id) ON DELETE RESTRICT,
  turno_id uuid NOT NULL REFERENCES turno (id) ON DELETE RESTRICT,
  detalle_turno_id uuid NOT NULL REFERENCES detalle_turno (id) ON DELETE RESTRICT,
  taller_id uuid NOT NULL REFERENCES taller (id) ON DELETE RESTRICT,
  servicio_id uuid NOT NULL REFERENCES servicio (id) ON DELETE RESTRICT,
  tipo_servicio_id uuid REFERENCES tipo_servicio (id) ON DELETE SET NULL,
  servicio_nombre text NOT NULL,
  tipo_servicio_nombre text,
  taller_nombre text,
  realizado_en timestamptz NOT NULL,
  kilometraje_km integer CHECK (kilometraje_km IS NULL OR kilometraje_km >= 0),
  duracion_minutos integer CHECK (duracion_minutos IS NULL OR duracion_minutos > 0),
  precio numeric(12, 2),
  moneda text NOT NULL DEFAULT 'ARS',
  resultado text NOT NULL DEFAULT 'realizado' CHECK (resultado IN ('realizado', 'parcial', 'garantia', 'retrabajo')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_historial_servicio_detalle UNIQUE (detalle_turno_id)
);
CREATE INDEX IF NOT EXISTS ix_historial_servicio_cliente_realizado ON historial_servicio (empresa_id, cliente_id, realizado_en DESC);
CREATE INDEX IF NOT EXISTS ix_historial_servicio_vehiculo_realizado ON historial_servicio (empresa_id, vehiculo_id, realizado_en DESC);
CREATE INDEX IF NOT EXISTS ix_historial_servicio_turno ON historial_servicio (turno_id);
CREATE INDEX IF NOT EXISTS ix_historial_servicio_servicio ON historial_servicio (empresa_id, servicio_id, realizado_en DESC);
-- Montironi: cliente usa activo (no deleted_at)
CREATE INDEX IF NOT EXISTS ix_cliente_empresa_telefono ON cliente (empresa_id, telefono) WHERE activo IS TRUE;
CREATE TABLE IF NOT EXISTS cliente_perfil_buyer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL REFERENCES cliente (id) ON DELETE CASCADE,
  tags text[] NOT NULL DEFAULT '{}',
  intencion_predominante text,
  score_reclamos integer NOT NULL DEFAULT 0 CHECK (score_reclamos >= 0),
  ultima_clasificacion text,
  ultima_clasificacion_en timestamptz,
  wah_conversation_id uuid REFERENCES wah_conversations (id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cliente_perfil_buyer_cliente UNIQUE (cliente_id)
);
CREATE INDEX IF NOT EXISTS ix_cliente_perfil_buyer_empresa ON cliente_perfil_buyer (empresa_id);
CREATE INDEX IF NOT EXISTS ix_cliente_perfil_buyer_intencion ON cliente_perfil_buyer (empresa_id, intencion_predominante) WHERE intencion_predominante IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_cliente_perfil_buyer_wah ON cliente_perfil_buyer (wah_conversation_id) WHERE wah_conversation_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS cliente_clasificacion_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL REFERENCES cliente (id) ON DELETE CASCADE,
  perfil_id uuid REFERENCES cliente_perfil_buyer (id) ON DELETE SET NULL,
  wah_conversation_id uuid REFERENCES wah_conversations (id) ON DELETE SET NULL,
  wah_message_id uuid REFERENCES wah_messages (id) ON DELETE SET NULL,
  fuente text NOT NULL DEFAULT 'bot' CHECK (fuente IN ('bot', 'humano', 'sistema', 'integracion')),
  clasificacion text NOT NULL,
  intencion text,
  tags_delta text[],
  score_reclamos_delta integer NOT NULL DEFAULT 0,
  payload jsonb,
  actor_usuario_id uuid REFERENCES usuario (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_cliente_clasificacion_evento_cliente ON cliente_clasificacion_evento (empresa_id, cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_cliente_clasificacion_evento_conv ON cliente_clasificacion_evento (wah_conversation_id, created_at DESC) WHERE wah_conversation_id IS NOT NULL;
COMMIT;
