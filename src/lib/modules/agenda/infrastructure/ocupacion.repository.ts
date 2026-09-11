import prisma from "@/lib/db";
import { Prisma, TipoOcupacion } from "@prisma/client";

export class OcupacionRepository {
  async insertTurnoHold(
    tx: Prisma.TransactionClient,
    params: { bahiaId: string; turnoId: string; inicio: Date; fin: Date }
  ) {
    return tx.ocupacionBahia.create({
      data: {
        bahiaId: params.bahiaId,
        turnoId: params.turnoId,
        tipo: TipoOcupacion.turno,
        inicio: params.inicio,
        fin: params.fin,
        activo: true,
      },
    });
  }

  async liberateByTurno(tx: Prisma.TransactionClient, turnoId: string) {
    return tx.ocupacionBahia.updateMany({
      where: { turnoId, activo: true },
      data: { activo: false },
    });
  }

  async liberateBloqueo(id: string, empresaId: string) {
    const block = await prisma.ocupacionBahia.findFirst({
      where: {
        id,
        tipo: TipoOcupacion.bloqueo,
        bahia: { taller: { empresaId } },
      },
    });
    if (!block) return null;
    return prisma.ocupacionBahia.update({
      where: { id },
      data: { activo: false },
    });
  }

  async countActiveByBahia(bahiaId: string) {
    return prisma.ocupacionBahia.count({
      where: { bahiaId, activo: true },
    });
  }
}

export const ocupacionRepository = new OcupacionRepository();
