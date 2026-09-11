-- =============================================================================
-- 005_comunicaciones_wah.sql
-- Fuente de verdad Datos (Montironi) — alineado cima-ai WAH inbox
-- Tenancy: empresa_id uuid FK empresa RESTRICT (sin tenant_id cima)
-- Cadena CASCADE: whatsapp_accounts → wah_conversations → wah_messages → wah_media
-- =============================================================================

-- ─── whatsapp_accounts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id           UUID NOT NULL,
    user_id              UUID,
    phone_number_id      TEXT NOT NULL,
    display_phone_number TEXT,
    waba_id              TEXT,
    label                TEXT,
    active               BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT whatsapp_accounts_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT whatsapp_accounts_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES usuario(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT whatsapp_accounts_empresa_phone_key UNIQUE (empresa_id, phone_number_id)
);

CREATE INDEX IF NOT EXISTS ix_whatsapp_accounts_empresa_active
    ON whatsapp_accounts (empresa_id, active);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_user_id_uidx
    ON whatsapp_accounts (user_id) WHERE user_id IS NOT NULL;

-- ─── wah_conversations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wah_conversations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id           UUID NOT NULL,
    account_id           UUID NOT NULL,
    cliente_id           UUID,
    wa_contact_id        TEXT NOT NULL,
    contact_name         TEXT,
    contact_phone        TEXT NOT NULL,
    last_message_at      TIMESTAMPTZ(6),
    last_message_preview TEXT,
    unread_count         INTEGER NOT NULL DEFAULT 0,
    bot_paused           BOOLEAN NOT NULL DEFAULT false,
    pending_human        BOOLEAN NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT wah_conversations_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT wah_conversations_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES whatsapp_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT wah_conversations_cliente_id_fkey
        FOREIGN KEY (cliente_id) REFERENCES cliente(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT wah_conversations_account_contact_key UNIQUE (account_id, wa_contact_id)
);

CREATE INDEX IF NOT EXISTS ix_wah_conversations_empresa_last_message
    ON wah_conversations (empresa_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS ix_wah_conversations_empresa_pending
    ON wah_conversations (empresa_id, pending_human);

CREATE INDEX IF NOT EXISTS ix_wah_conversations_empresa_unread
    ON wah_conversations (empresa_id, unread_count);

-- ─── wah_messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wah_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL,
    conversation_id UUID NOT NULL,
    direction       TEXT NOT NULL,
    sender_type     TEXT NOT NULL,
    message_type    TEXT NOT NULL DEFAULT 'text',
    body            TEXT,
    wamid           TEXT,
    sender_user_id  UUID,
    status          TEXT NOT NULL DEFAULT 'sent',
    metadata        JSONB,
    created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT wah_messages_direction_check
        CHECK (direction IN ('inbound', 'outbound')),
    CONSTRAINT wah_messages_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT wah_messages_conversation_id_fkey
        FOREIGN KEY (conversation_id) REFERENCES wah_conversations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT wah_messages_sender_user_id_fkey
        FOREIGN KEY (sender_user_id) REFERENCES usuario(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_wah_messages_conversation_created
    ON wah_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS ix_wah_messages_empresa_created
    ON wah_messages (empresa_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wah_messages_wamid
    ON wah_messages (wamid) WHERE wamid IS NOT NULL;

-- ─── wah_media ───────────────────────────────────────────────────────────────
-- Media cuelga del mensaje (message_id NOT NULL). Meta Cloud API id en meta_media_id.
CREATE TABLE IF NOT EXISTS wah_media (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id     UUID NOT NULL,
    message_id     UUID NOT NULL,
    meta_media_id  TEXT,
    mime_type      TEXT NOT NULL,
    file_name      TEXT NOT NULL,
    storage_path   TEXT NOT NULL,
    file_size      INTEGER,
    sha256         TEXT,
    caption        TEXT,
    width          INTEGER,
    height         INTEGER,
    duration_ms    INTEGER,
    voice          BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT wah_media_empresa_id_fkey
        FOREIGN KEY (empresa_id) REFERENCES empresa(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT wah_media_message_id_fkey
        FOREIGN KEY (message_id) REFERENCES wah_messages(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_wah_media_empresa_created
    ON wah_media (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wah_media_message_idx
    ON wah_media (message_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wah_media_meta_media_id
    ON wah_media (meta_media_id) WHERE meta_media_id IS NOT NULL;

-- ─── Notas de adaptación Montironi vs cima-ai ────────────────────────────────
-- tenant_id          → empresa_id (RESTRICT en las 4 tablas WAH)
-- wa_message_id      → wamid (+ UNIQUE parcial)
-- user_id            → whatsapp_accounts (no wah_conversations)
-- media_id en msg    → wah_media.message_id (CASCADE al borrar mensaje)
-- enums direction    → TEXT + CHECK inbound|outbound
-- sender_user_id     → wah_messages FK usuario SET NULL
