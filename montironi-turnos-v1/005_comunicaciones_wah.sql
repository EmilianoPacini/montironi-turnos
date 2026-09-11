-- =============================================================================
-- 005_comunicaciones_wah.sql — Montironi Turnos / Cima AI  ★ FUENTE OFICIAL
-- Clone literal WAH (cima-ai drizzle 0004–0006 + wah.ts).
-- Este archivo SUPERSEDE cualquier 005 reescrito en repo por el cloud agent.
--
-- Shape cima (obligatorio):
--   • whatsapp_accounts.user_id + UNIQUE parcial (NO en wah_conversations)
--   • wah_media.message_id NOT NULL → wah_messages ON DELETE CASCADE
--   • wah_messages SIN media_id
-- Adaptación Montironi únicamente:
--   • tenant_id → empresa_id uuid FK empresa RESTRICT
--   • user_id/sender_user_id → uuid FK usuario SET NULL
--   • wah_conversations.cliente_id opcional (CRM)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- whatsapp_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
  user_id          uuid REFERENCES usuario (id) ON DELETE SET NULL,
  phone_number_id  text NOT NULL,
  display_number   text,
  label            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE whatsapp_accounts IS
  'Línea WhatsApp Cloud API por tenant. phone_number_id = Meta Phone Number ID.';
COMMENT ON COLUMN whatsapp_accounts.user_id IS
  'Titular / filtro de acceso (member). NULL = línea compartida del tenant.';

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_phone_number_id_uidx
  ON whatsapp_accounts (phone_number_id);

-- Una línea asignada por usuario (múltiples NULL permitidos)
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_user_id_uidx
  ON whatsapp_accounts (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_accounts_empresa_idx
  ON whatsapp_accounts (empresa_id);

-- ---------------------------------------------------------------------------
-- wah_conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wah_conversations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id             uuid NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
  account_id             uuid NOT NULL REFERENCES whatsapp_accounts (id) ON DELETE CASCADE,
  cliente_id             uuid REFERENCES cliente (id) ON DELETE SET NULL,
  contact_number         text NOT NULL,
  contact_name           text,
  last_message_at        timestamptz,
  last_message_preview   text,
  unread_count           integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  pending_reply          boolean NOT NULL DEFAULT false,
  bot_paused             boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE wah_conversations IS
  'Conversación = cuenta WA + contact_number. Humano send → bot_paused=true; resume → false.';
COMMENT ON COLUMN wah_conversations.cliente_id IS
  'Opcional: vínculo al CRM Montironi cuando el teléfono matchea un cliente.';
COMMENT ON COLUMN wah_conversations.contact_number IS
  'Preferir E.164 (ej. +54911…). No enforced en V1 comunicaciones (WA source tampoco).';

CREATE UNIQUE INDEX IF NOT EXISTS wah_conversations_account_contact_uidx
  ON wah_conversations (account_id, contact_number);

CREATE INDEX IF NOT EXISTS wah_conversations_empresa_last_message_idx
  ON wah_conversations (empresa_id, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS wah_conversations_cliente_idx
  ON wah_conversations (cliente_id)
  WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS wah_conversations_pending_idx
  ON wah_conversations (empresa_id, account_id)
  WHERE pending_reply OR bot_paused OR unread_count > 0;

-- ---------------------------------------------------------------------------
-- wah_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wah_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
  conversation_id   uuid NOT NULL REFERENCES wah_conversations (id) ON DELETE CASCADE,
  direction         text NOT NULL,
  type              text NOT NULL DEFAULT 'text',
  body              text,
  wamid             text,
  status            text NOT NULL DEFAULT 'received',
  generated_by_ai   boolean NOT NULL DEFAULT false,
  sender_user_id    uuid REFERENCES usuario (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_wah_messages_direction
    CHECK (direction IN ('inbound', 'outbound')),
  CONSTRAINT ck_wah_messages_type
    CHECK (length(trim(type)) > 0),
  CONSTRAINT ck_wah_messages_status
    CHECK (length(trim(status)) > 0)
);

COMMENT ON TABLE wah_messages IS
  'Mensajes WA. direction inbound|outbound. wamid único global (Meta). status: received|sent|delivered|read|failed|…';
COMMENT ON COLUMN wah_messages.generated_by_ai IS
  'true si el outbound lo generó el bot/agente.';
COMMENT ON COLUMN wah_messages.sender_user_id IS
  'Usuario humano que envió desde el panel (outbound).';

CREATE UNIQUE INDEX IF NOT EXISTS wah_messages_wamid_uidx
  ON wah_messages (wamid)
  WHERE wamid IS NOT NULL;

CREATE INDEX IF NOT EXISTS wah_messages_conversation_created_idx
  ON wah_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS wah_messages_empresa_idx
  ON wah_messages (empresa_id);

CREATE INDEX IF NOT EXISTS wah_messages_empresa_created_idx
  ON wah_messages (empresa_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- wah_media
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wah_media (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
  message_id     uuid NOT NULL REFERENCES wah_messages (id) ON DELETE CASCADE,
  meta_media_id  text,
  mime_type      text,
  filename       text,
  storage_path   text,
  size_bytes     integer CHECK (size_bytes IS NULL OR size_bytes >= 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE wah_media IS
  'Adjuntos. storage_path relativo a WAH_MEDIA_DIR. meta_media_id = id Meta cuando aplica.';

CREATE INDEX IF NOT EXISTS wah_media_message_idx
  ON wah_media (message_id);

CREATE INDEX IF NOT EXISTS wah_media_empresa_idx
  ON wah_media (empresa_id);

COMMIT;

-- =============================================================================
-- Prisma mapping (cloud agent) — sugerido
-- =============================================================================
-- model WhatsappAccount  @@map("whatsapp_accounts")
-- model WahConversation  @@map("wah_conversations")
-- model WahMessage       @@map("wah_messages")
-- model WahMedia         @@map("wah_media")
-- empresaId / userId / senderUserId / clienteId / phoneNumberId / …
--
-- ROLLBACK MANUAL
-- =============================================================================
/*
BEGIN;
DROP TABLE IF EXISTS wah_media CASCADE;
DROP TABLE IF EXISTS wah_messages CASCADE;
DROP TABLE IF EXISTS wah_conversations CASCADE;
DROP TABLE IF EXISTS whatsapp_accounts CASCADE;
COMMIT;
*/
