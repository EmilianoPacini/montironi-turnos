import { Prisma, TipoOcupacion } from "@prisma/client";

export async function insertOcupacionTurno(
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

export async function liberateOcupacionTurno(tx: Prisma.TransactionClient, turnoId: string) {
  await tx.ocupacionBahia.updateMany({
    where: { turnoId, activo: true },
    data: { activo: false },
  });
}

export async function refreshOcupacionTurno(
  tx: Prisma.TransactionClient,
  turno: { id: string; bahiaId: string; inicio: Date; finalizaEn: Date }
) {
  const active = await tx.ocupacionBahia.findFirst({
    where: { turnoId: turno.id, activo: true, tipo: TipoOcupacion.turno },
  });

  if (active) {
    if (
      active.inicio.getTime() !== turno.inicio.getTime() ||
      active.fin.getTime() !== turno.finalizaEn.getTime() ||
      active.bahiaId !== turno.bahiaId
    ) {
      await tx.ocupacionBahia.update({
        where: { id: active.id },
        data: {
          bahiaId: turno.bahiaId,
          inicio: turno.inicio,
          fin: turno.finalizaEn,
        },
      });
    }
    return;
  }

  await insertOcupacionTurno(tx, {
    bahiaId: turno.bahiaId,
    turnoId: turno.id,
    inicio: turno.inicio,
    fin: turno.finalizaEn,
  });
}
