import prisma from "@/lib/db";
import { getWahConfig } from "@/lib/modules/wah/config";
import {
  findOrCreateConversation,
  findWhatsappAccountByPhoneNumberId,
  persistInboundMessage,
} from "@/lib/modules/wah/conversation.service";
import { downloadWhatsAppMedia } from "@/lib/modules/wah/meta-client";
import { normalizeContactPhone } from "@/lib/modules/wah/phone";
import {
  WAH_MESSAGE_TYPE,
  type WahMessageType,
} from "@/lib/modules/wah/types";

export class WahAccountNotFoundError extends Error {
  phoneNumberId: string;
  status = 404;

  constructor(phoneNumberId: string) {
    super(`WhatsApp account not found for phone_number_id=${phoneNumberId}`);
    this.name = "WahAccountNotFoundError";
    this.phoneNumberId = phoneNumberId;
  }
}

type MetaWebhookPayload = {
  object?: string;
  entry?: MetaWebhookEntry[];
};

type MetaWebhookEntry = {
  changes?: MetaWebhookChange[];
};

type MetaWebhookChange = {
  field?: string;
  value?: MetaWebhookValue;
};

type MetaWebhookValue = {
  messaging_product?: string;
  metadata?: {
    phone_number_id?: string;
    display_phone_number?: string;
  };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: MetaInboundMessage[];
  statuses?: MetaMessageStatus[];
};

type MetaInboundMessage = {
  from: string;
  id: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  image?: MetaMediaRef;
  audio?: MetaMediaRef & { voice?: boolean };
  document?: MetaMediaRef & { filename?: string };
  video?: MetaMediaRef;
  sticker?: MetaMediaRef;
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { title?: string; id?: string };
    list_reply?: { title?: string; id?: string; description?: string };
  };
};

type MetaMediaRef = {
  id: string;
  mime_type?: string;
  caption?: string;
  sha256?: string;
};

type MetaMessageStatus = {
  id: string;
  status: string;
  timestamp?: string;
  recipient_id?: string;
};

export type ProcessWebhookResult = {
  messages: Array<{ wamid: string; messageId?: string; skipped?: boolean }>;
  statuses: Array<{ wamid: string; status: string; updated: number }>;
};

export async function processWhatsAppWebhook(payload: MetaWebhookPayload): Promise<ProcessWebhookResult> {
  const result: ProcessWebhookResult = { messages: [], statuses: [] };

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) continue;

      const phoneNumberId = change.value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const account = await findWhatsappAccountByPhoneNumberId(phoneNumberId);
      if (!account) {
        throw new WahAccountNotFoundError(phoneNumberId);
      }

      const contactName = change.value.contacts?.[0]?.profile?.name;

      for (const message of change.value.messages ?? []) {
        const processed = await processInboundWebhookMessage({
          account: { id: account.id, empresaId: account.empresaId, phoneNumberId: account.phoneNumberId },
          contactName,
          message,
        });
        result.messages.push(processed);
      }

      for (const status of change.value.statuses ?? []) {
        const processed = await processMessageStatusUpdate(status);
        result.statuses.push(processed);
      }
    }
  }

  return result;
}

async function processInboundWebhookMessage(params: {
  account: { id: string; empresaId: string; phoneNumberId: string };
  contactName?: string;
  message: MetaInboundMessage;
}) {
  const { message } = params;
  const wamid = message.id;

  const existing = await prisma.wahMessage.findFirst({ where: { wamid } });
  if (existing) {
    return { wamid, messageId: existing.id, skipped: true };
  }

  const contactPhone = normalizeContactPhone(message.from);
  const conversation = await findOrCreateConversation({
    empresaId: params.account.empresaId,
    accountId: params.account.id,
    contactPhone,
    contactName: params.contactName,
  });

  const parsed = parseInboundMessage(message);
  let mediaPayload: Parameters<typeof persistInboundMessage>[0]["media"];

  if (parsed.metaMediaId) {
    const downloaded = await downloadWhatsAppMedia(parsed.metaMediaId);
    mediaPayload = {
      buffer: downloaded.buffer,
      mimeType: parsed.mimeType ?? downloaded.mimeType,
      fileName: parsed.fileName ?? `${parsed.messageType}-${parsed.metaMediaId}`,
      metaMediaId: parsed.metaMediaId,
      caption: parsed.caption,
      voice: parsed.voice,
    };
  }

  const persisted = await persistInboundMessage({
    empresaId: params.account.empresaId,
    conversationId: conversation.id,
    body: parsed.body,
    messageType: parsed.messageType,
    wamid,
    pendingHuman: true,
    media: mediaPayload,
  });

  const freshConversation = await prisma.wahConversation.findUniqueOrThrow({
    where: { id: conversation.id },
  });

  if (!freshConversation.botPaused) {
    await forwardInboundToN8n({
      empresaId: params.account.empresaId,
      accountId: params.account.id,
      phoneNumberId: params.account.phoneNumberId,
      conversationId: conversation.id,
      messageId: persisted.id,
      wamid,
      contactPhone,
      contactName: params.contactName ?? conversation.contactName,
      body: parsed.body,
      messageType: parsed.messageType,
    });
  }

  return { wamid, messageId: persisted.id };
}

async function processMessageStatusUpdate(status: MetaMessageStatus) {
  const updated = await prisma.wahMessage.updateMany({
    where: { wamid: status.id },
    data: { status: status.status },
  });

  return { wamid: status.id, status: status.status, updated: updated.count };
}

function parseInboundMessage(message: MetaInboundMessage): {
  messageType: WahMessageType;
  body: string;
  metaMediaId?: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
  voice?: boolean;
} {
  switch (message.type) {
    case "text":
      return {
        messageType: WAH_MESSAGE_TYPE.text,
        body: message.text?.body?.trim() || "",
      };
    case "image":
      return {
        messageType: WAH_MESSAGE_TYPE.image,
        body: message.image?.caption || "[image]",
        metaMediaId: message.image?.id,
        mimeType: message.image?.mime_type,
        fileName: "image",
        caption: message.image?.caption,
      };
    case "audio":
      return {
        messageType: WAH_MESSAGE_TYPE.audio,
        body: "[audio]",
        metaMediaId: message.audio?.id,
        mimeType: message.audio?.mime_type,
        fileName: "audio",
        voice: message.audio?.voice,
      };
    case "document":
      return {
        messageType: WAH_MESSAGE_TYPE.document,
        body: message.document?.caption || `[document: ${message.document?.filename ?? "file"}]`,
        metaMediaId: message.document?.id,
        mimeType: message.document?.mime_type,
        fileName: message.document?.filename ?? "document",
        caption: message.document?.caption,
      };
    case "video":
      return {
        messageType: WAH_MESSAGE_TYPE.video,
        body: message.video?.caption || "[video]",
        metaMediaId: message.video?.id,
        mimeType: message.video?.mime_type,
        fileName: "video",
        caption: message.video?.caption,
      };
    case "sticker":
      return {
        messageType: WAH_MESSAGE_TYPE.sticker,
        body: "[sticker]",
        metaMediaId: message.sticker?.id,
        mimeType: message.sticker?.mime_type,
        fileName: "sticker",
      };
    case "button":
      return {
        messageType: WAH_MESSAGE_TYPE.text,
        body: message.button?.text || message.button?.payload || "[button]",
      };
    case "interactive": {
      const title =
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        "[interactive]";
      return { messageType: WAH_MESSAGE_TYPE.text, body: title };
    }
    default:
      return {
        messageType: WAH_MESSAGE_TYPE.system,
        body: `[${message.type}]`,
      };
  }
}

async function forwardInboundToN8n(payload: Record<string, unknown>) {
  const { messageWebhookUrl } = getWahConfig();
  if (!messageWebhookUrl) return;

  try {
    await fetch(messageWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "inbound_message", ...payload }),
    });
  } catch {
    // non-blocking
  }
}
