import prisma from "@/lib/db";
import {
  WahMessageDirection,
  WahMessageType,
  WahSenderType,
} from "@prisma/client";
import { getWahConfig } from "@/lib/modules/wah/config";
import { sendWhatsAppMedia, sendWhatsAppText } from "@/lib/modules/wah/meta-client";
import { previewText } from "@/lib/modules/wah/phone";
import {
  findOrCreateConversation,
  getWhatsappAccountForEmpresa,
  touchConversationAfterMessage,
} from "@/lib/modules/wah/conversation.service";

export async function sendHumanMessage(params: {
  empresaId: string;
  conversationId: string;
  body: string;
  userId: string;
  generatedByAi?: boolean;
}) {
  const conversation = await prisma.wahConversation.findFirst({
    where: { id: params.conversationId, empresaId: params.empresaId },
    include: { account: true },
  });
  if (!conversation) throw new Error("Conversación no encontrada");

  const { waMessageId } = await sendWhatsAppText({
    phoneNumberId: conversation.account.phoneNumberId,
    to: conversation.contactPhone,
    text: params.body,
  });

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.wahMessage.create({
      data: {
        empresaId: params.empresaId,
        conversationId: params.conversationId,
        direction: WahMessageDirection.outbound,
        senderType: params.generatedByAi ? WahSenderType.bot : WahSenderType.human,
        messageType: WahMessageType.text,
        body: params.body,
        waMessageId,
        status: "sent",
        metadata: {
          sentByUserId: params.userId,
          ...(params.generatedByAi ? { generatedByAi: true } : {}),
        },
      },
    });

    await tx.wahConversation.update({
      where: { id: params.conversationId },
      data: {
        botPaused: true,
        pendingHuman: false,
        lastMessageAt: new Date(),
        lastMessagePreview: previewText(params.body),
      },
    });

    return created;
  });

  await notifyMessageWebhook({
    event: "human_message_sent",
    conversationId: params.conversationId,
    messageId: message.id,
  });

  return message;
}

export async function sendIntegrationText(params: {
  empresaId: string;
  accountId: string;
  to: string;
  text: string;
  contactName?: string;
  conversationId?: string;
  externalId?: string;
}) {
  const account = await getWhatsappAccountForEmpresa(params.accountId, params.empresaId);
  if (!account) throw new Error("Cuenta WhatsApp no encontrada");

  const conversation = params.conversationId
    ? await prisma.wahConversation.findFirst({
        where: { id: params.conversationId, empresaId: params.empresaId, accountId: params.accountId },
      })
    : await findOrCreateConversation({
        empresaId: params.empresaId,
        accountId: params.accountId,
        contactPhone: params.to,
        contactName: params.contactName,
      });

  if (!conversation) throw new Error("Conversación no encontrada");

  const { waMessageId } = await sendWhatsAppText({
    phoneNumberId: account.phoneNumberId,
    to: params.to,
    text: params.text,
  });

  const message = await prisma.wahMessage.create({
    data: {
      empresaId: params.empresaId,
      conversationId: conversation.id,
      direction: WahMessageDirection.outbound,
      senderType: WahSenderType.integration,
      messageType: WahMessageType.text,
      body: params.text,
      waMessageId,
      status: "sent",
      metadata: params.externalId ? { externalId: params.externalId } : undefined,
    },
  });

  await touchConversationAfterMessage({
    conversationId: conversation.id,
    direction: WahMessageDirection.outbound,
    preview: params.text,
  });

  return { message, conversationId: conversation.id };
}

export async function sendIntegrationAudio(params: {
  empresaId: string;
  accountId: string;
  to: string;
  audioUrl: string;
  contactName?: string;
  conversationId?: string;
  filename?: string;
}) {
  return sendIntegrationMedia({
    ...params,
    messageType: WahMessageType.audio,
    mediaType: "audio" as const,
    mediaUrl: params.audioUrl,
    body: params.filename ? `[audio: ${params.filename}]` : "[audio]",
  });
}

export async function sendIntegrationFile(params: {
  empresaId: string;
  accountId: string;
  to: string;
  fileUrl: string;
  filename: string;
  caption?: string;
  contactName?: string;
  conversationId?: string;
}) {
  return sendIntegrationMedia({
    empresaId: params.empresaId,
    accountId: params.accountId,
    to: params.to,
    contactName: params.contactName,
    conversationId: params.conversationId,
    messageType: WahMessageType.file,
    mediaType: "document" as const,
    mediaUrl: params.fileUrl,
    filename: params.filename,
    caption: params.caption,
    body: params.caption || `[file: ${params.filename}]`,
  });
}

async function sendIntegrationMedia(params: {
  empresaId: string;
  accountId: string;
  to: string;
  contactName?: string;
  conversationId?: string;
  messageType: WahMessageType;
  mediaType: "audio" | "document" | "image" | "video";
  mediaUrl: string;
  filename?: string;
  caption?: string;
  body: string;
}) {
  const account = await getWhatsappAccountForEmpresa(params.accountId, params.empresaId);
  if (!account) throw new Error("Cuenta WhatsApp no encontrada");

  const conversation = params.conversationId
    ? await prisma.wahConversation.findFirst({
        where: { id: params.conversationId, empresaId: params.empresaId, accountId: params.accountId },
      })
    : await findOrCreateConversation({
        empresaId: params.empresaId,
        accountId: params.accountId,
        contactPhone: params.to,
        contactName: params.contactName,
      });

  if (!conversation) throw new Error("Conversación no encontrada");

  const { waMessageId } = await sendWhatsAppMedia({
    phoneNumberId: account.phoneNumberId,
    to: params.to,
    text: params.body,
    mediaType: params.mediaType,
    mediaUrl: params.mediaUrl,
    filename: params.filename,
    caption: params.caption,
  });

  const message = await prisma.wahMessage.create({
    data: {
      empresaId: params.empresaId,
      conversationId: conversation.id,
      direction: WahMessageDirection.outbound,
      senderType: WahSenderType.integration,
      messageType: params.messageType,
      body: params.body,
      waMessageId,
      status: "sent",
      metadata: {
        mediaUrl: params.mediaUrl,
        filename: params.filename,
        caption: params.caption,
      },
    },
  });

  await touchConversationAfterMessage({
    conversationId: conversation.id,
    direction: WahMessageDirection.outbound,
    preview: params.body,
  });

  return { message, conversationId: conversation.id };
}

async function notifyMessageWebhook(payload: Record<string, unknown>) {
  const { messageWebhookUrl } = getWahConfig();
  if (!messageWebhookUrl) return;
  try {
    await fetch(messageWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // non-blocking
  }
}

export function serializeConversation(c: {
  id: string;
  accountId: string;
  clienteId: string | null;
  contactName: string | null;
  contactPhone: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  botPaused: boolean;
  pendingHuman: boolean;
  cliente?: { id: string; nombre: string; apellido: string } | null;
}) {
  return {
    id: c.id,
    accountId: c.accountId,
    clienteId: c.clienteId,
    contactName: c.contactName,
    contactPhone: c.contactPhone,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    lastMessagePreview: c.lastMessagePreview,
    unreadCount: c.unreadCount,
    botPaused: c.botPaused,
    pendingHuman: c.pendingHuman,
    cliente: c.cliente
      ? { id: c.cliente.id, nombre: `${c.cliente.nombre} ${c.cliente.apellido}`.trim() }
      : null,
  };
}

export function serializeMessage(m: {
  id: string;
  direction: string;
  senderType: string;
  messageType: string;
  body: string | null;
  status: string;
  createdAt: Date;
  media?: { id: string; mimeType: string; fileName: string } | null;
}) {
  return {
    id: m.id,
    direction: m.direction,
    senderType: m.senderType,
    messageType: m.messageType,
    body: m.body,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    media: m.media
      ? { id: m.media.id, mimeType: m.media.mimeType, fileName: m.media.fileName }
      : null,
  };
}
