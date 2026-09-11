import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

export type SesionWithUsuario = Prisma.SesionGetPayload<{
  include: { usuario: true };
}>;

export async function findSesionById(id: string): Promise<SesionWithUsuario | null> {
  return prisma.sesion.findUnique({
    where: { id },
    include: { usuario: true },
  });
}

export async function insertSesion(data: {
  usuarioId: string;
  empresaId: string;
  expiresAt: Date;
  userAgent?: string | null;
  ip?: string | null;
}) {
  return prisma.sesion.create({ data });
}

export async function touchSesionLastSeen(id: string, at: Date) {
  return prisma.sesion.update({
    where: { id },
    data: { lastSeenAt: at },
  });
}

export async function revokeSesionById(id: string, at: Date) {
  return prisma.sesion.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: at },
  });
}

export async function revokeAllSesionesForUsuario(usuarioId: string, at: Date) {
  return prisma.sesion.updateMany({
    where: { usuarioId, revokedAt: null },
    data: { revokedAt: at },
  });
}

export async function deleteExpiredSesiones(before: Date) {
  return prisma.sesion.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: before } },
        { revokedAt: { lt: before } },
      ],
    },
  });
}
