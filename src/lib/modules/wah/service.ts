import {
  DireccionMensajeWah,
  Prisma,
} from "@prisma/client";
import { differenceInMinutes, startOfDay } from "date-fns";
import { prisma } from "@/lib/db";
import type { WahContact, WahKpis, WahMessage } from "./types";

function displayName(
  nombreContacto: string | null,
  cliente: { nombre: string; apellido: string } | null,
  telefono: string
): string {
  if (cliente) return `${cliente.nombre} ${cliente.apellido}`.trim();
  if (nombreContacto) return nombreContacto;
  return telefono;
}

function toContact(
  row: Prisma.ConversacionWahGetPayload<{
    include: { cliente: { select: { nombre: true; apellido: true } } };
  }>
): WahContact {
  return {
    id: row.id,
    telefono: row.telefono,
    nombre: displayName(row.nombreContacto, row.cliente, row.telefono),
    clienteId: row.clienteId,
    ultimoMensaje: row.ultimoMensaje,
    ultimoMensajeAt: row.ultimoMensajeAt?.toISOString() ?? null,
    noLeidos: row.noLeidos,
  };
}

export async function listWahContacts(
  empresaId: string,
  search?: string
): Promise<WahContact[]> {
  const q = search?.trim();
  const rows = await prisma.conversacionWah.findMany({
    where: {
      empresaId,
      ...(q
        ? {
            OR: [
              { telefono: { contains: q, mode: "insensitive" } },
              { nombreContacto: { contains: q, mode: "insensitive" } },
              {
                cliente: {
                  OR: [
                    { nombre: { contains: q, mode: "insensitive" } },
                    { apellido: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    include: {
      cliente: { select: { nombre: true, apellido: true } },
    },
    orderBy: [{ ultimoMensajeAt: "desc" }, { updatedAt: "desc" }],
  });

  return rows.map(toContact);
}

export async function getWahKpis(empresaId: string): Promise<WahKpis> {
  const hoy = startOfDay(new Date());

  const [conversacionesActivas, sinResponder, mensajesHoy, conversaciones] =
    await Promise.all([
      prisma.conversacionWah.count({ where: { empresaId } }),
      prisma.conversacionWah.count({
        where: { empresaId, noLeidos: { gt: 0 } },
      }),
      prisma.mensajeWah.count({
        where: {
          conversacion: { empresaId },
          enviadoAt: { gte: hoy },
        },
      }),
      prisma.conversacionWah.findMany({
        where: { empresaId, ultimoMensajeAt: { not: null } },
        select: { id: true },
      }),
    ]);

  const ids = conversaciones.map((c) => c.id);
  let tiempoMedioRespuestaMin: number | null = null;

  if (ids.length > 0) {
    const mensajes = await prisma.mensajeWah.findMany({
      where: { conversacionId: { in: ids } },
      orderBy: { enviadoAt: "asc" },
      select: {
        conversacionId: true,
        direccion: true,
        enviadoAt: true,
      },
    });

    const deltas: number[] = [];
    const lastInbound = new Map<string, Date>();

    for (const msg of mensajes) {
      if (msg.direccion === DireccionMensajeWah.entrante) {
        lastInbound.set(msg.conversacionId, msg.enviadoAt);
        continue;
      }
      const inboundAt = lastInbound.get(msg.conversacionId);
      if (inboundAt) {
        deltas.push(differenceInMinutes(msg.enviadoAt, inboundAt));
        lastInbound.delete(msg.conversacionId);
      }
    }

    if (deltas.length > 0) {
      tiempoMedioRespuestaMin = Math.round(
        deltas.reduce((a, b) => a + b, 0) / deltas.length
      );
    }
  }

  return {
    conversacionesActivas,
    sinResponder,
    mensajesHoy,
    tiempoMedioRespuestaMin,
  };
}

export async function listWahMessages(
  empresaId: string,
  chatId: string
): Promise<WahMessage[]> {
  const conversacion = await prisma.conversacionWah.findFirst({
    where: { id: chatId, empresaId },
  });
  if (!conversacion) {
    throw new Error("NOT_FOUND");
  }

  const mensajes = await prisma.mensajeWah.findMany({
    where: { conversacionId: chatId },
    orderBy: { enviadoAt: "asc" },
  });

  if (conversacion.noLeidos > 0) {
    await prisma.$transaction([
      prisma.mensajeWah.updateMany({
        where: {
          conversacionId: chatId,
          direccion: DireccionMensajeWah.entrante,
          leido: false,
        },
        data: { leido: true },
      }),
      prisma.conversacionWah.update({
        where: { id: chatId },
        data: { noLeidos: 0 },
      }),
    ]);
  }

  return mensajes.map((m) => ({
    id: m.id,
    direccion: m.direccion,
    cuerpo: m.cuerpo,
    enviadoAt: m.enviadoAt.toISOString(),
    leido: m.leido,
  }));
}

export async function sendWahMessage(
  empresaId: string,
  chatId: string,
  cuerpo: string,
  usuarioId: string
): Promise<WahMessage> {
  const text = cuerpo.trim();
  if (!text) {
    throw new Error("VALIDATION");
  }

  const conversacion = await prisma.conversacionWah.findFirst({
    where: { id: chatId, empresaId },
  });
  if (!conversacion) {
    throw new Error("NOT_FOUND");
  }

  const now = new Date();
  const mensaje = await prisma.$transaction(async (tx) => {
    const created = await tx.mensajeWah.create({
      data: {
        conversacionId: chatId,
        direccion: DireccionMensajeWah.saliente,
        cuerpo: text,
        leido: true,
        enviadoAt: now,
      },
    });

    await tx.conversacionWah.update({
      where: { id: chatId },
      data: {
        ultimoMensaje: text,
        ultimoMensajeAt: now,
      },
    });

    return created;
  });

  // Placeholder para integración WAHA futura; el panel persiste el mensaje saliente.
  void usuarioId;

  return {
    id: mensaje.id,
    direccion: mensaje.direccion,
    cuerpo: mensaje.cuerpo,
    enviadoAt: mensaje.enviadoAt.toISOString(),
    leido: mensaje.leido,
  };
}

export async function getWahConversation(
  empresaId: string,
  chatId: string
): Promise<WahContact | null> {
  const row = await prisma.conversacionWah.findFirst({
    where: { id: chatId, empresaId },
    include: {
      cliente: { select: { nombre: true, apellido: true } },
    },
  });
  return row ? toContact(row) : null;
}
