import { Prisma, EstadoTurno } from "@prisma/client";
import prisma from "@/lib/db";
import { liberateOcupacionTurno } from "@/lib/modules/appointments/application/internal/occupation";

/** Misma regla que VencerPendientes / expirePendingTurnos. */
export function isPendingExpired(
  turno: { estado: EstadoTurno; inicio: Date },
  now: Date = new Date()
): boolean {
  return turno.estado === EstadoTurno.pendiente && turno.inicio < now;
}

export async function vencePendienteEnTx(
  tx: Prisma.TransactionClient,
  turno: { id: string; estado: EstadoTurno },
  detalle = "Vencido automáticamente — hora de inicio superada sin confirmación"
) {
  if (turno.estado !== EstadoTurno.pendiente) return;

  await liberateOcupacionTurno(tx, turno.id);
  await tx.turno.update({
    where: { id: turno.id },
    data: {
      estado: EstadoTurno.vencido,
      version: { increment: 1 },
      eventos: {
        create: {
          estadoPrev: EstadoTurno.pendiente,
          estadoNuevo: EstadoTurno.vencido,
          detalle,
        },
      },
    },
  });
}

/** Only automatic transition: pendiente → vencido when start time passes unconfirmed. */
export async function expirePendingTurnos(empresaId: string): Promise<number> {
  const now = new Date();
  const expired = await prisma.turno.findMany({
    where: {
      empresaId,
      estado: EstadoTurno.pendiente,
      inicio: { lt: now },
    },
  });

  for (const turno of expired) {
    await prisma.$transaction(async (tx) => {
      await vencePendienteEnTx(tx, turno);
    });
  }

  return expired.length;
}
