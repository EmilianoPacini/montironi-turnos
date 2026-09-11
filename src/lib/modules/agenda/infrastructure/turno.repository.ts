import prisma from "@/lib/db";
import { Prisma, EstadoTurno } from "@prisma/client";

export class TurnoRepository {
  findById(turnoId: string, empresaId: string) {
    return prisma.turno.findFirst({
      where: { id: turnoId, empresaId },
      include: { detalles: true },
    });
  }

  async transitionWithVersion(
    db: Prisma.TransactionClient,
    params: {
      turnoId: string;
      expectedVersion: number;
      nuevoEstado: EstadoTurno;
    }
  ) {
    return db.turno.updateMany({
      where: { id: params.turnoId, version: params.expectedVersion },
      data: {
        estado: params.nuevoEstado,
        version: { increment: 1 },
      },
    });
  }

  async freezeSnapshots(tx: Prisma.TransactionClient, turnoId: string, empresaId: string) {
    const detalles = await tx.detalleTurno.findMany({
      where: { turnoId },
    });
    for (const d of detalles) {
      const servicio = await tx.servicio.findFirst({
        where: { id: d.servicioId, empresaId, activo: true },
      });
      if (!servicio) continue;
      await tx.detalleTurno.update({
        where: { id: d.id },
        data: {
          nombreSnapshot: servicio.nombre,
          precioSnapshot: servicio.precio,
          modoPrecioSnapshot: servicio.modoPrecio,
        },
      });
    }
  }
}

export const turnoRepository = new TurnoRepository();
