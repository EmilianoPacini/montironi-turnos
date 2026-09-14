import { Prisma, EstadoTurno } from "@prisma/client";
import prisma from "@/lib/db";
import { DomainError } from "@/lib/modules/appointments/errors";
import { registrarMovimiento } from "@/lib/modules/audit/movimiento.service";

export async function transitionTurno(params: {
  turno: {
    id: string;
    estado: EstadoTurno;
    version: number;
    vehiculoId?: string;
    kilometraje?: number | null;
  };
  nuevoEstado: EstadoTurno;
  usuarioId?: string;
  detalle?: string;
  empresaId?: string;
  tx?: Prisma.TransactionClient;
}) {
  const db = params.tx ?? prisma;

  const updated = await db.turno.updateMany({
    where: { id: params.turno.id, version: params.turno.version },
    data: {
      estado: params.nuevoEstado,
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new DomainError("El turno fue modificado", "VersionConflicto");
  }

  await db.eventoTurno.create({
    data: {
      turnoId: params.turno.id,
      estadoPrev: params.turno.estado,
      estadoNuevo: params.nuevoEstado,
      usuarioId: params.usuarioId,
      detalle: params.detalle,
    },
  });

  if (params.empresaId) {
    await registrarMovimiento(
      {
        empresaId: params.empresaId,
        entidad: "turno",
        entidadId: params.turno.id,
        accion: "transicion",
        detalle: {
          estadoPrev: params.turno.estado,
          estadoNuevo: params.nuevoEstado,
          detalle: params.detalle,
        },
        usuarioId: params.usuarioId,
      },
      params.tx
    );
  }

  return db.turno.findFirstOrThrow({
    where: { id: params.turno.id },
    include: {
      cliente: true,
      vehiculo: true,
      detalles: true,
      bahia: true,
      eventos: { orderBy: { createdAt: "desc" } },
    },
  });
}
