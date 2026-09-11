-- 007_historial_y_buyer — Datos DDL (montironi-turnos-v1/007_historial_y_buyer.sql)

CREATE TABLE "historial_servicio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "vehiculo_id" UUID NOT NULL,
    "turno_id" UUID NOT NULL,
    "detalle_turno_id" UUID NOT NULL,
    "taller_id" UUID NOT NULL,
    "servicio_id" UUID NOT NULL,
    "tipo_servicio_id" UUID,
    "servicio_nombre" TEXT NOT NULL,
    "tipo_servicio_nombre" TEXT,
    "taller_nombre" TEXT,
    "realizado_en" TIMESTAMPTZ(6) NOT NULL,
    "kilometraje_km" INTEGER,
    "duracion_minutos" INTEGER,
    "precio" DECIMAL(12,2),
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "resultado" TEXT NOT NULL DEFAULT 'realizado',
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_servicio_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "historial_servicio_kilometraje_km_check" CHECK ("kilometraje_km" IS NULL OR "kilometraje_km" >= 0),
    CONSTRAINT "historial_servicio_duracion_minutos_check" CHECK ("duracion_minutos" IS NULL OR "duracion_minutos" > 0),
    CONSTRAINT "historial_servicio_resultado_check" CHECK ("resultado" IN ('realizado', 'parcial', 'garantia', 'retrabajo')),
    CONSTRAINT "uq_historial_servicio_detalle" UNIQUE ("detalle_turno_id")
);

CREATE INDEX "ix_historial_servicio_cliente_realizado"
  ON "historial_servicio"("empresa_id", "cliente_id", "realizado_en" DESC);
CREATE INDEX "ix_historial_servicio_vehiculo_realizado"
  ON "historial_servicio"("empresa_id", "vehiculo_id", "realizado_en" DESC);
CREATE INDEX "ix_historial_servicio_turno"
  ON "historial_servicio"("turno_id");
CREATE INDEX "ix_historial_servicio_servicio"
  ON "historial_servicio"("empresa_id", "servicio_id", "realizado_en" DESC);

CREATE INDEX "ix_cliente_empresa_telefono"
  ON "cliente"("empresa_id", "telefono") WHERE "activo" IS TRUE;

ALTER TABLE "historial_servicio" ADD CONSTRAINT "historial_servicio_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historial_servicio" ADD CONSTRAINT "historial_servicio_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historial_servicio" ADD CONSTRAINT "historial_servicio_vehiculo_id_fkey"
  FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historial_servicio" ADD CONSTRAINT "historial_servicio_turno_id_fkey"
  FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historial_servicio" ADD CONSTRAINT "historial_servicio_detalle_turno_id_fkey"
  FOREIGN KEY ("detalle_turno_id") REFERENCES "detalle_turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historial_servicio" ADD CONSTRAINT "historial_servicio_taller_id_fkey"
  FOREIGN KEY ("taller_id") REFERENCES "taller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historial_servicio" ADD CONSTRAINT "historial_servicio_servicio_id_fkey"
  FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historial_servicio" ADD CONSTRAINT "historial_servicio_tipo_servicio_id_fkey"
  FOREIGN KEY ("tipo_servicio_id") REFERENCES "tipo_servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "cliente_perfil_buyer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "intencion_predominante" TEXT,
    "score_reclamos" INTEGER NOT NULL DEFAULT 0,
    "ultima_clasificacion" TEXT,
    "ultima_clasificacion_en" TIMESTAMPTZ(6),
    "wah_conversation_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_perfil_buyer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cliente_perfil_buyer_score_reclamos_check" CHECK ("score_reclamos" >= 0),
    CONSTRAINT "uq_cliente_perfil_buyer_cliente" UNIQUE ("cliente_id")
);

CREATE INDEX "ix_cliente_perfil_buyer_empresa" ON "cliente_perfil_buyer"("empresa_id");
CREATE INDEX "ix_cliente_perfil_buyer_intencion"
  ON "cliente_perfil_buyer"("empresa_id", "intencion_predominante") WHERE "intencion_predominante" IS NOT NULL;
CREATE INDEX "ix_cliente_perfil_buyer_wah"
  ON "cliente_perfil_buyer"("wah_conversation_id") WHERE "wah_conversation_id" IS NOT NULL;

ALTER TABLE "cliente_perfil_buyer" ADD CONSTRAINT "cliente_perfil_buyer_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cliente_perfil_buyer" ADD CONSTRAINT "cliente_perfil_buyer_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_perfil_buyer" ADD CONSTRAINT "cliente_perfil_buyer_wah_conversation_id_fkey"
  FOREIGN KEY ("wah_conversation_id") REFERENCES "wah_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "cliente_clasificacion_evento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "perfil_id" UUID,
    "wah_conversation_id" UUID,
    "wah_message_id" UUID,
    "fuente" TEXT NOT NULL DEFAULT 'bot',
    "clasificacion" TEXT NOT NULL,
    "intencion" TEXT,
    "tags_delta" TEXT[],
    "score_reclamos_delta" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "actor_usuario_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_clasificacion_evento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cliente_clasificacion_evento_fuente_check" CHECK ("fuente" IN ('bot', 'humano', 'sistema', 'integracion'))
);

CREATE INDEX "ix_cliente_clasificacion_evento_cliente"
  ON "cliente_clasificacion_evento"("empresa_id", "cliente_id", "created_at" DESC);
CREATE INDEX "ix_cliente_clasificacion_evento_conv"
  ON "cliente_clasificacion_evento"("wah_conversation_id", "created_at" DESC) WHERE "wah_conversation_id" IS NOT NULL;

ALTER TABLE "cliente_clasificacion_evento" ADD CONSTRAINT "cliente_clasificacion_evento_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cliente_clasificacion_evento" ADD CONSTRAINT "cliente_clasificacion_evento_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_clasificacion_evento" ADD CONSTRAINT "cliente_clasificacion_evento_perfil_id_fkey"
  FOREIGN KEY ("perfil_id") REFERENCES "cliente_perfil_buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cliente_clasificacion_evento" ADD CONSTRAINT "cliente_clasificacion_evento_wah_conversation_id_fkey"
  FOREIGN KEY ("wah_conversation_id") REFERENCES "wah_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cliente_clasificacion_evento" ADD CONSTRAINT "cliente_clasificacion_evento_wah_message_id_fkey"
  FOREIGN KEY ("wah_message_id") REFERENCES "wah_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cliente_clasificacion_evento" ADD CONSTRAINT "cliente_clasificacion_evento_actor_usuario_id_fkey"
  FOREIGN KEY ("actor_usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
