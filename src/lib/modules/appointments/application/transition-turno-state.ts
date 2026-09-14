import { EstadoTurno } from "@prisma/client";
import prisma from "@/lib/db";
import { canTransition } from "@/lib/modules/appointments/constants";
import { shouldLiberateOcupacion } from "@/lib/modules/agenda/domain/policies";
import { DomainError } from "@/lib/modules/appointments/errors";
import { upsertHistorialDesdeTurnoFinalizado } from "@/lib/modules/historial/service";
import { liberateOcupacionTurno } from "@/lib/modules/appointments/application/internal/occupation";
import { transitionTurno } from "@/lib/modules/appointments/application/internal/transition-turno";
import { cancelTurno } from "@/lib/modules/appointments/application/cancel-turno";

export async function transitionTurnoState(params: {
  turnoId: string;
  empresaId: string;
  nuevoEstado: EstadoTurno;
  version: number;
  usuarioId?: string;
  detalle?: string;
}) {
  const turno = await prisma.turno.findFirst({
    where: { id: params.turnoId, empresaId: params.empresaId },
  });

  if (!turno) throw new DomainError("Turno no encontrado", "RecursoNoEncontrado");
  if (turno.version !== params.version) {
    throw new DomainError("El turno fue modificado", "VersionConflicto");
  }
  if (params.nuevoEstado === EstadoTurno.vencido) {
    throw new DomainError("Vencido solo se aplica automáticamente", "TransicionInvalida");
  }
  if (!canTransition(turno.estado, params.nuevoEstado)) {
    throw new DomainError("Transición inválida", "TransicionInvalida");
  }

  if (params.nuevoEstado === EstadoTurno.cancelado) {
    return cancelTurno({
      turnoId: params.turnoId,
      empresaId: params.empresaId,
      version: params.version,
      usuarioId: params.usuarioId,
      motivo: params.detalle,
    });
  }

  if (shouldLiberateOcupacion(params.nuevoEstado)) {
    return prisma.$transaction(async (tx) => {
      await liberateOcupacionTurno(tx, turno.id);
      const result = await transitionTurno({
        turno,
        nuevoEstado: params.nuevoEstado,
        usuarioId: params.usuarioId,
        detalle: params.detalle,
        tx,
        empresaId: params.empresaId,
      });
      if (params.nuevoEstado === EstadoTurno.finalizado) {
        if (turno.kilometraje != null) {
          await tx.vehiculo.update({
            where: { id: turno.vehiculoId },
            data: { kilometrajeActual: turno.kilometraje },
          });
        }
        await upsertHistorialDesdeTurnoFinalizado(turno.id, tx);
      }
      return result;
    });
  }

  return transitionTurno({
    turno,
    nuevoEstado: params.nuevoEstado,
    usuarioId: params.usuarioId,
    detalle: params.detalle,
    empresaId: params.empresaId,
  });
}
