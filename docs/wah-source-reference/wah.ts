/**
 * Reference — cima-ai wah.ts (Drizzle) adapted for Montironi.
 * Authoritative DDL: montironi-turnos-v1/005_comunicaciones_wah.sql
 */

export type WahDirection = "inbound" | "outbound";
export type WahSenderType = "contact" | "human" | "bot" | "integration";
export type WahMessageType =
  | "text"
  | "audio"
  | "file"
  | "image"
  | "document"
  | "video"
  | "sticker"
  | "system";

export interface WhatsappAccountRow {
  id: string;
  empresa_id: string;
  user_id: string | null;
  phone_number_id: string;
  display_phone_number: string | null;
  waba_id: string | null;
  label: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WahConversationRow {
  id: string;
  empresa_id: string;
  account_id: string;
  cliente_id: string | null;
  wa_contact_id: string;
  contact_name: string | null;
  contact_phone: string;
  last_message_at: Date | null;
  last_message_preview: string | null;
  unread_count: number;
  bot_paused: boolean;
  pending_human: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WahMessageRow {
  id: string;
  empresa_id: string;
  conversation_id: string;
  direction: WahDirection;
  sender_type: WahSenderType;
  message_type: WahMessageType;
  body: string | null;
  wamid: string | null;
  sender_user_id: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface WahMediaRow {
  id: string;
  empresa_id: string;
  message_id: string;
  meta_media_id: string | null;
  mime_type: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  sha256: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  voice: boolean;
  created_at: Date;
}
