-- Evolución desde demo simplificado (conversacion_wah / mensaje_wah) hacia esquema cima-ai.
-- Idempotente: seguro si 20260911180000 ya creó las tablas cima o si quedó el demo viejo.

DROP TABLE IF EXISTS "mensaje_wah";
DROP TABLE IF EXISTS "conversacion_wah";
DROP TYPE IF EXISTS "direccion_mensaje_wah";

DO $$ BEGIN
  CREATE TYPE "wah_message_direction" AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "wah_sender_type" AS ENUM ('contact', 'human', 'bot', 'integration');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "wah_message_type" AS ENUM ('text', 'audio', 'file', 'image', 'document', 'video', 'sticker', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "whatsapp_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "display_phone_number" TEXT,
    "waba_id" TEXT,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_accounts_empresa_id_phone_number_id_key"
  ON "whatsapp_accounts"("empresa_id", "phone_number_id");
CREATE INDEX IF NOT EXISTS "whatsapp_accounts_empresa_id_active_idx"
  ON "whatsapp_accounts"("empresa_id", "active");

DO $$ BEGIN
  ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "wah_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "cliente_id" UUID,
    "wa_contact_id" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT NOT NULL,
    "last_message_at" TIMESTAMPTZ(6),
    "last_message_preview" TEXT,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "bot_paused" BOOLEAN NOT NULL DEFAULT false,
    "pending_human" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wah_conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wah_conversations_account_id_wa_contact_id_key"
  ON "wah_conversations"("account_id", "wa_contact_id");
CREATE INDEX IF NOT EXISTS "wah_conversations_empresa_id_last_message_at_idx"
  ON "wah_conversations"("empresa_id", "last_message_at" DESC);
CREATE INDEX IF NOT EXISTS "wah_conversations_empresa_id_pending_human_idx"
  ON "wah_conversations"("empresa_id", "pending_human");
CREATE INDEX IF NOT EXISTS "wah_conversations_empresa_id_unread_count_idx"
  ON "wah_conversations"("empresa_id", "unread_count");

DO $$ BEGIN
  ALTER TABLE "wah_conversations" ADD CONSTRAINT "wah_conversations_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "wah_conversations" ADD CONSTRAINT "wah_conversations_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "wah_conversations" ADD CONSTRAINT "wah_conversations_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "wah_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_size" INTEGER,
    "sha256" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wah_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "wah_media_empresa_id_created_at_idx"
  ON "wah_media"("empresa_id", "created_at" DESC);

DO $$ BEGIN
  ALTER TABLE "wah_media" ADD CONSTRAINT "wah_media_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "wah_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "direction" "wah_message_direction" NOT NULL,
    "sender_type" "wah_sender_type" NOT NULL,
    "message_type" "wah_message_type" NOT NULL,
    "body" TEXT,
    "wa_message_id" TEXT,
    "media_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wah_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "wah_messages_conversation_id_created_at_idx"
  ON "wah_messages"("conversation_id", "created_at" ASC);
CREATE INDEX IF NOT EXISTS "wah_messages_empresa_id_created_at_idx"
  ON "wah_messages"("empresa_id", "created_at" DESC);

DO $$ BEGIN
  ALTER TABLE "wah_messages" ADD CONSTRAINT "wah_messages_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "wah_messages" ADD CONSTRAINT "wah_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "wah_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "wah_messages" ADD CONSTRAINT "wah_messages_media_id_fkey"
    FOREIGN KEY ("media_id") REFERENCES "wah_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
