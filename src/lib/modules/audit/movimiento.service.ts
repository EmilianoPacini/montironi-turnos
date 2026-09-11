import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function registrarMovimiento(
  params: {
    empresaId: string;
    entidad: string;
    entidadId: string;
    accion: string;
    detalle?: Record<string, unknown>;
    usuarioId?: string;
  },
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  return db.movimiento.create({
    data: {
      empresaId: params.empresaId,
      entidad: params.entidad,
      entidadId: params.entidadId,
      accion: params.accion,
      detalle: params.detalle as Prisma.InputJsonValue | undefined,
      usuarioId: params.usuarioId,
    },
  });
}

export async function listMovimientos(empresaId: string, limit = 50) {
  return prisma.movimiento.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { usuario: { select: { nombre: true, email: true } } },
  });
}
