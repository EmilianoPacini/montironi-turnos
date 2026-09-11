import prisma from "@/lib/db";
import { normalizeContactPhone, previewText, toWaContactId } from "@/lib/modules/wah/phone";
import {
  WAH_DIRECTION,
  WAH_MESSAGE_TYPE,
  WAH_SENDER_TYPE,
  type WahDirection,
  type WahMessageType,
} from "@/lib/modules/wah/types";

export type ConversationFilter = "all" | "pending" | "unread";

export async function listWhatsappAccounts(empresaId: string) {
  return prisma.whatsappAccount.findMany({
    where: { empresaId, active: true },
    orderBy: { label: "asc" },
  });
}

export async function getWhatsappAccountForEmpresa(accountId: string, empresaId: string) {
  return prisma.whatsappAccount.findFirst({
    where: { id: accountId, empresaId, active: true },
  });
}

export async function getWahDashboard(empresaId: string, accountId?: string) {
  const where = {
    empresaId,
    ...(accountId ? { accountId } : {}),
  };

  const [total, unread, pending, botPaused] = await Promise.all([
    prisma.wahConversation.count({ where }),
    prisma.wahConversation.count({ where: { ...where, unreadCount: { gt: 0 } } }),
    prisma.wahConversation.count({ where: { ...where, pendingHuman: true } }),
    prisma.wahConversation.count({ where: { ...where, botPaused: true } }),
  ]);

  return { total, unread, pending, botPaused };
}

export async function listWahConversations(params: {
  empresaId: string;
  accountId?: string;
  filter?: ConversationFilter;
  limit?: number;
}) {
  const filter = params.filter ?? "all";
  const where = {
    empresaId: params.empresaId,
    ...(params.accountId ? { accountId: params.accountId } : {}),
    ...(filter === "pending" ? { pendingHuman: true } : {}),
    ...(filter === "unread" ? { unreadCount: { gt: 0 } } : {}),
  };

  return prisma.wahConversation.findMany({
    where,
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: params.limit ?? 100,
    include: {
      cliente: { select: { id: true, nombre: true, apellido: true } },
    },
  });
}

export async function getWahConversationDetail(conversationId: string, empresaId: string) {
  const conversation = await prisma.wahConversation.findFirst({
    where: { id: conversationId, empresaId },
    include: {
      cliente: { select: { id: true, nombre: true, apellido: true, telefono: true } },
      account: true,
    },
  });
  if (!conversation) return null;

  const messages = await prisma.wahMessage.findMany({
    where: { conversationId, empresaId },
    orderBy: { createdAt: "asc" },
    include: { media: true },
  });

  return { conversation, messages };
}

export async function findOrCreateConversation(params: {
  empresaId: string;
  accountId: string;
  contactPhone: string;
  contactName?: string;
  clienteId?: string;
}) {
  const contactPhone = normalizeContactPhone(params.contactPhone);
  const waContactId = toWaContactId(contactPhone);

  const existing = await prisma.wahConversation.findUnique({
    where: { accountId_waContactId: { accountId: params.accountId, waContactId } },
  });
  if (existing) {
    if (params.contactName && !existing.contactName) {
      return prisma.wahConversation.update({
        where: { id: existing.id },
        data: { contactName: params.contactName },
      });
    }
    return existing;
  }

  let clienteId = params.clienteId;
  if (!clienteId) {
    const cliente = await prisma.cliente.findFirst({
      where: { empresaId: params.empresaId, telefono: contactPhone, activo: true },
      select: { id: true, nombre: true, apellido: true },
    });
    if (cliente) {
      clienteId = cliente.id;
      if (!params.contactName) {
        params.contactName = [cliente.nombre, cliente.apellido].filter(Boolean).join(" ");
      }
    }
  }

  return prisma.wahConversation.create({
    data: {
      empresaId: params.empresaId,
      accountId: params.accountId,
      clienteId,
      waContactId,
      contactPhone,
      contactName: params.contactName,
    },
  });
}

export async function touchConversationAfterMessage(params: {
  conversationId: string;
  direction: WahDirection;
  preview: string;
  incrementUnread?: boolean;
  pendingHuman?: boolean;
}) {
  const conv = await prisma.wahConversation.findUniqueOrThrow({
    where: { id: params.conversationId },
  });

  return prisma.wahConversation.update({
    where: { id: params.conversationId },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: previewText(params.preview),
      unreadCount:
        params.incrementUnread && params.direction === WAH_DIRECTION.inbound
          ? conv.unreadCount + 1
          : undefined,
      pendingHuman: params.pendingHuman,
    },
  });
}

export async function markConversationRead(conversationId: string, empresaId: string) {
  const conv = await prisma.wahConversation.findFirst({
    where: { id: conversationId, empresaId },
  });
  if (!conv) throw new Error("Conversación no encontrada");

  return prisma.wahConversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0, pendingHuman: false },
  });
}

export async function resumeBot(conversationId: string, empresaId: string) {
  const conv = await prisma.wahConversation.findFirst({
    where: { id: conversationId, empresaId },
  });
  if (!conv) throw new Error("Conversación no encontrada");

  return prisma.wahConversation.update({
    where: { id: conversationId },
    data: { botPaused: false, pendingHuman: false },
  });
}

export async function persistInboundMessage(params: {
  empresaId: string;
  conversationId: string;
  body: string;
  messageType?: WahMessageType;
  wamid?: string;
  pendingHuman?: boolean;
  media?: {
    buffer: Buffer;
    mimeType: string;
    fileName: string;
    metaMediaId?: string;
    caption?: string;
    width?: number;
    height?: number;
    durationMs?: number;
    voice?: boolean;
  };
}) {
  const message = await prisma.wahMessage.create({
    data: {
      empresaId: params.empresaId,
      conversationId: params.conversationId,
      direction: WAH_DIRECTION.inbound,
      senderType: WAH_SENDER_TYPE.contact,
      messageType: params.messageType ?? WAH_MESSAGE_TYPE.text,
      body: params.body,
      wamid: params.wamid,
      status: "received",
    },
  });

  if (params.media) {
    const { storeWahMedia } = await import("@/lib/modules/wah/media.service");
    await storeWahMedia({
      empresaId: params.empresaId,
      messageId: message.id,
      buffer: params.media.buffer,
      mimeType: params.media.mimeType,
      fileName: params.media.fileName,
      metaMediaId: params.media.metaMediaId,
      caption: params.media.caption,
      width: params.media.width,
      height: params.media.height,
      durationMs: params.media.durationMs,
      voice: params.media.voice,
    });
  }

  await touchConversationAfterMessage({
    conversationId: params.conversationId,
    direction: WAH_DIRECTION.inbound,
    preview: params.body || `[${params.messageType ?? "text"}]`,
    incrementUnread: true,
    pendingHuman: params.pendingHuman ?? true,
  });

  return message;
}
