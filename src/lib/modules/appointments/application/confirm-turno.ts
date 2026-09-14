import { EstadoTurno } from "@prisma/client";
import prisma from "@/lib/db";
import { assertWithinSchedule, checkSlotAvailable } from "@/lib/modules/availability/service";
import { canTransition } from "@/lib/modules/appointments/constants";
import { turnoRepository } from "@/lib/modules/agenda/infrastructure/turno.repository";
import { DomainError } from "@/lib/modules/appointments/errors";
import { refreshOcupacionTurno } from "@/lib/modules/appointments/application/internal/occupation";
import { transitionTurno } from "@/lib/modules/appointments/application/internal/transition-turno";
import { isPendingExpired, vencePendienteEnTx } from "@/lib/modules/appointments/application/expire-pending";

export async function confirmTurno(params: {
  turnoId: string;
  empresaId: string;
  usuarioId?: string;
  version?: number;
}) {
  const turno = await prisma.turno.findFirst({
    where: { id: params.turnoId, empresaId: params.empresaId },
  });

  if (!turno) throw new DomainError("Turno no encontrado", "RecursoNoEncontrado");
  if (params.version !== undefined && turno.version !== params.version) {
    throw new DomainError("El turno fue modificado", "VersionConflicto");
  }
  if (!canTransition(turno.estado, EstadoTurno.confirmado)) {
    throw new DomainError("Transición inválida", "TransicionInvalida");
  }

  if (isPendingExpired(turno)) {
    await prisma.$transaction(async (tx) => {
      await vencePendienteEnTx(
        tx,
        turno,
        "Vencido al intentar confirmar — hora de inicio superada"
      );
    });
    throw new DomainError(
      "Turno vencido — no se puede confirmar",
      "TransicionInvalida"
    );
  }

  await assertWithinSchedule(turno.tallerId, turno.inicio, turno.finalizaEn);

  const available = await checkSlotAvailable(
    turno.bahiaId,
    turno.inicio,
    turno.finalizaEn,
    turno.id
  );
  if (!available) {
    throw new DomainError("Horario ya no disponible", "CapacidadConflicto");
  }

  return prisma.$transaction(async (tx) => {
    await refreshOcupacionTurno(tx, turno);
    if (turno.estado === EstadoTurno.pendiente) {
      await turnoRepository.freezeSnapshots(tx, turno.id, params.empresaId);
    }
    return transitionTurno({
      turno,
      nuevoEstado: EstadoTurno.confirmado,
      usuarioId: params.usuarioId,
      detalle: "Turno confirmado",
      tx,
      empresaId: params.empresaId,
    });
  });
}
