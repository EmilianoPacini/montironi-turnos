import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { DomainError } from "@/lib/modules/appointments/errors";

function toInputJson(
  value: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

export type ClasificacionFuente = "bot" | "humano" | "sistema" | "integracion";

export type ClasificarClienteInput = {
  empresaId: string;
  clienteId: string;
  clasificacion: string;
  intencion?: string;
  tagsDelta?: string[];
  scoreReclamosDelta?: number;
  wahConversationId?: string;
  wahMessageId?: string;
  fuente?: ClasificacionFuente;
  actorUsuarioId?: string;
  payload?: Record<string, unknown>;
};

function mergeTags(existing: string[], delta: string[]): string[] {
  const set = new Set(existing.map((t) => t.trim()).filter(Boolean));
  for (const tag of delta) {
    const t = tag.trim();
    if (t) set.add(t);
  }
  return [...set];
}

export function serializePerfilBuyer(perfil: {
  id: string;
  clienteId: string;
  tags: string[];
  intencionPredominante: string | null;
  scoreReclamos: number;
  ultimaClasificacion: string | null;
  ultimaClasificacionEn: Date | null;
  wahConversationId: string | null;
  metadata: unknown;
  updatedAt: Date;
}) {
  return {
    id: perfil.id,
    clienteId: perfil.clienteId,
    tags: perfil.tags,
    intencionPredominante: perfil.intencionPredominante,
    perfilBuyer: perfil.intencionPredominante,
    scoreReclamos: perfil.scoreReclamos,
    ultimaClasificacion: perfil.ultimaClasificacion,
    ultimaClasificacionEn: perfil.ultimaClasificacionEn?.toISOString() ?? null,
    wahConversationId: perfil.wahConversationId,
    metadata: perfil.metadata,
    updatedAt: perfil.updatedAt.toISOString(),
  };
}

export async function clasificarCliente(input: ClasificarClienteInput) {
  const cliente = await prisma.cliente.findFirst({
    where: { id: input.clienteId, empresaId: input.empresaId },
  });
  if (!cliente) {
    throw new DomainError("Cliente no encontrado", "RecursoNoEncontrado");
  }

  const fuente = input.fuente ?? "bot";
  const tagsDelta = input.tagsDelta ?? [];
  const scoreDelta = input.scoreReclamosDelta ?? 0;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.clientePerfilBuyer.findUnique({
      where: { clienteId: input.clienteId },
    });

    const jsonPayload = toInputJson(input.payload);

    const evento = await tx.clienteClasificacionEvento.create({
      data: {
        empresaId: input.empresaId,
        clienteId: input.clienteId,
        perfilId: existing?.id,
        wahConversationId: input.wahConversationId,
        wahMessageId: input.wahMessageId,
        fuente,
        clasificacion: input.clasificacion,
        intencion: input.intencion,
        tagsDelta,
        scoreReclamosDelta: scoreDelta,
        payload: jsonPayload,
        actorUsuarioId: input.actorUsuarioId,
      },
    });

    const mergedTags = mergeTags(existing?.tags ?? [], tagsDelta);
    const scoreReclamos = Math.max(0, (existing?.scoreReclamos ?? 0) + scoreDelta);

    const update: Prisma.ClientePerfilBuyerUncheckedUpdateInput = {
      tags: mergedTags,
      scoreReclamos,
      ultimaClasificacion: input.clasificacion,
      ultimaClasificacionEn: now,
    };
    if (input.intencion !== undefined) {
      update.intencionPredominante = input.intencion;
    }
    if (input.wahConversationId !== undefined) {
      update.wahConversationId = input.wahConversationId;
    }
    if (jsonPayload !== undefined) {
      update.metadata = jsonPayload;
    }

    const perfil = await tx.clientePerfilBuyer.upsert({
      where: { clienteId: input.clienteId },
      create: {
        empresaId: input.empresaId,
        clienteId: input.clienteId,
        tags: mergedTags,
        intencionPredominante: input.intencion ?? null,
        scoreReclamos,
        ultimaClasificacion: input.clasificacion,
        ultimaClasificacionEn: now,
        wahConversationId: input.wahConversationId,
        metadata: jsonPayload,
      },
      update,
    });

    await tx.clienteClasificacionEvento.update({
      where: { id: evento.id },
      data: { perfilId: perfil.id },
    });

    return { perfil, evento };
  });
}

export async function getPerfilBuyerForCliente(empresaId: string, clienteId: string) {
  return prisma.clientePerfilBuyer.findFirst({
    where: { empresaId, clienteId },
  });
}
