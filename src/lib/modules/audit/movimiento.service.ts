import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  formatMovimientoDescripcion,
  type MovimientoContext,
} from "@/lib/modules/audit/format-movimiento";

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

export type MovimientoDisplay = Awaited<ReturnType<typeof listMovimientos>>[number] & {
  descripcion: string;
};

export async function listMovimientosForDisplay(
  empresaId: string,
  limit = 50
): Promise<MovimientoDisplay[]> {
  const movimientos = await listMovimientos(empresaId, limit);

  const turnoIds = movimientos
    .filter((m) => m.entidad === "turno")
    .map((m) => m.entidadId);
  const bahiaIds = movimientos
    .filter((m) => m.entidad === "bahia")
    .map((m) => m.entidadId);

  const tallerIdsFromDetalle = movimientos
    .map((m) => {
      const detalle = m.detalle as Record<string, unknown> | null;
      return detalle && typeof detalle.tallerId === "string" ? detalle.tallerId : null;
    })
    .filter((id): id is string => Boolean(id));

  const [turnos, bahias, talleres] = await Promise.all([
    turnoIds.length
      ? prisma.turno.findMany({
          where: { id: { in: turnoIds }, empresaId },
          include: {
            cliente: { select: { nombre: true, apellido: true } },
            vehiculo: { select: { patente: true } },
            bahia: {
              select: {
                nombre: true,
                taller: { select: { nombre: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    bahiaIds.length
      ? prisma.bahia.findMany({
          where: { id: { in: bahiaIds }, taller: { empresaId } },
          include: { taller: { select: { nombre: true } } },
        })
      : Promise.resolve([]),
    tallerIdsFromDetalle.length
      ? prisma.taller.findMany({
          where: { id: { in: tallerIdsFromDetalle }, empresaId },
          select: { id: true, nombre: true },
        })
      : Promise.resolve([]),
  ]);

  const turnoMap = new Map(turnos.map((t) => [t.id, t]));
  const bahiaMap = new Map(bahias.map((b) => [b.id, b]));
  const tallerMap = new Map(talleres.map((t) => [t.id, t]));

  return movimientos.map((m) => {
    const detalle = m.detalle as Record<string, unknown> | null;
    const context: MovimientoContext = {};

    if (m.entidad === "turno") {
      const turno = turnoMap.get(m.entidadId);
      if (turno) context.turno = turno;
    }

    if (m.entidad === "bahia") {
      const bahia = bahiaMap.get(m.entidadId);
      if (bahia) {
        context.bahia = bahia;
      } else if (detalle && typeof detalle.nombre === "string") {
        context.bahia = { nombre: detalle.nombre };
      }
      const tallerId =
        detalle && typeof detalle.tallerId === "string" ? detalle.tallerId : undefined;
      if (tallerId) {
        const taller = tallerMap.get(tallerId);
        if (taller) context.taller = taller;
      }
    }

    return {
      ...m,
      descripcion: formatMovimientoDescripcion(
        {
          entidad: m.entidad,
          entidadId: m.entidadId,
          accion: m.accion,
          detalle: m.detalle as Record<string, unknown> | null,
        },
        context
      ),
    };
  });
}
