-- Comunicaciones WAH: conversaciones y mensajes WhatsApp

CREATE TYPE "direccion_mensaje_wah" AS ENUM ('entrante', 'saliente');

CREATE TABLE "conversacion_wah" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "cliente_id" UUID,
    "telefono" TEXT NOT NULL,
    "nombre_contacto" TEXT,
    "ultimo_mensaje" TEXT,
    "ultimo_mensaje_at" TIMESTAMPTZ(6),
    "no_leidos" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversacion_wah_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mensaje_wah" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversacion_id" UUID NOT NULL,
    "direccion" "direccion_mensaje_wah" NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "enviado_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensaje_wah_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversacion_wah_empresa_id_telefono_key" ON "conversacion_wah"("empresa_id", "telefono");
CREATE INDEX "conversacion_wah_empresa_id_ultimo_mensaje_at_idx" ON "conversacion_wah"("empresa_id", "ultimo_mensaje_at" DESC);
CREATE INDEX "mensaje_wah_conversacion_id_enviado_at_idx" ON "mensaje_wah"("conversacion_id", "enviado_at");

ALTER TABLE "conversacion_wah" ADD CONSTRAINT "conversacion_wah_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversacion_wah" ADD CONSTRAINT "conversacion_wah_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mensaje_wah" ADD CONSTRAINT "mensaje_wah_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion_wah"("id") ON DELETE CASCADE ON UPDATE CASCADE;
