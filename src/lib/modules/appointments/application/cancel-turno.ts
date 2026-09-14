import { EstadoTurno } from "@prisma/client";
import prisma from "@/lib/db";
import { canTransition } from "@/lib/modules/appointments/constants";
import { DomainError } from "@/lib/modules/appointments/errors";
import { registrarMovimiento } from "@/lib/modules/audit/movimiento.service";
import { liberateOcupacionTurno } from "@/lib/modules/appointments/application/internal/occupation";
import { transitionTurno } from "@/lib/modules/appointments/application/internal/transition-turno";
import { getAgendaConfig } from "@/lib/modules/availability/service";

export async function cancelTurno(params: {
  turnoId: string;
  empresaId: string;
  version?: number;
  usuarioId?: string;
  motivo?: string;
}) {
  const turno = await prisma.turno.findFirst({
    where: { id: params.turnoId, empresaId: params.empresaId },
  });

  if (!turno) throw new DomainError("Turno no encontrado", "RecursoNoEncontrado");
  if (params.version !== undefined && turno.version !== params.version) {
    throw new DomainError("El turno fue modificado", "VersionConflicto");
  }
  if (!canTransition(turno.estado, EstadoTurno.cancelado)) {
    throw new DomainError("No se puede cancelar", "TransicionInvalida");
  }

  const config = await getAgendaConfig(turno.tallerId);
  if (!config.permiteCancelacion) {
    throw new DomainError("Este taller no permite cancelar turnos", "TransicionInvalida");
  }
  const now = new Date();
  if (turno.inicio > now) {
    const hoursLeft = (turno.inicio.getTime() - now.getTime()) / 3_600_000;
    if (hoursLeft < config.horasLimiteCancelacion) {
      throw new DomainError(
        `Solo se puede cancelar hasta ${config.horasLimiteCancelacion} h antes`,
        "TransicionInvalida"
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    await liberateOcupacionTurno(tx, turno.id);

    const result = await transitionTurno({
      turno,
      nuevoEstado: EstadoTurno.cancelado,
      usuarioId: params.usuarioId,
      detalle: params.motivo ?? "Turno cancelado",
      tx,
    });

    await registrarMovimiento(
      {
        empresaId: params.empresaId,
        entidad: "turno",
        entidadId: turno.id,
        accion: "cancelar",
        detalle: { motivo: params.motivo, estadoPrev: turno.estado },
        usuarioId: params.usuarioId,
      },
      tx
    );

    return result;
  });
}
