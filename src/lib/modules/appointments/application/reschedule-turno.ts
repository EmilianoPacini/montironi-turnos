import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import {
  assertAnticipacion,
  assertWithinSchedule,
  getMargenMin,
} from "@/lib/modules/availability/service";
import { isActiveEstado } from "@/lib/modules/appointments/constants";
import { DomainError } from "@/lib/modules/appointments/errors";
import {
  insertOcupacionTurno,
  liberateOcupacionTurno,
} from "@/lib/modules/appointments/application/internal/occupation";
import { assignBahiaInTransaction } from "@/lib/modules/appointments/application/resolve-bahia";
import { assertNotPastInicio } from "@/lib/modules/appointments/application/validation";

export async function rescheduleTurno(params: {
  turnoId: string;
  empresaId: string;
  bahiaId?: string;
  inicio: Date;
  version: number;
  usuarioId?: string;
}) {
  const turno = await prisma.turno.findFirst({
    where: { id: params.turnoId, empresaId: params.empresaId },
    include: { detalles: true },
  });

  if (!turno) throw new DomainError("Turno no encontrado", "RecursoNoEncontrado");
  if (turno.version !== params.version) {
    throw new DomainError("El turno fue modificado", "VersionConflicto");
  }
  if (!isActiveEstado(turno.estado)) {
    throw new DomainError("Turno no modificable", "TurnoNoReprogramable");
  }

  const margen = await getMargenMin(turno.tallerId);
  const servicioIds = turno.detalles.map((d) => d.servicioId);
  const duracionMin = turno.detalles.reduce((a, d) => a + d.duracionMin, 0) + margen;
  const finalizaEn = new Date(params.inicio.getTime() + duracionMin * 60_000);

  try {
    await assertWithinSchedule(turno.tallerId, params.inicio, finalizaEn);
    await assertAnticipacion(turno.tallerId, params.inicio);
    assertNotPastInicio(params.inicio);
  } catch (e) {
    if (e instanceof DomainError) {
      throw new DomainError(
        "Conflicto al reprogramar — se mantiene el horario anterior",
        "CapacidadConflicto"
      );
    }
    throw e;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const { bahiaId: resolvedBahiaId } = await assignBahiaInTransaction(tx, {
        tallerId: turno.tallerId,
        servicioIds,
        inicio: params.inicio,
        fin: finalizaEn,
        bahiaId: params.bahiaId,
        excludeTurnoId: turno.id,
      });

      await liberateOcupacionTurno(tx, turno.id);

      await insertOcupacionTurno(tx, {
        bahiaId: resolvedBahiaId,
        turnoId: turno.id,
        inicio: params.inicio,
        fin: finalizaEn,
      });

      return tx.turno.update({
        where: { id: turno.id },
        data: {
          bahiaId: resolvedBahiaId,
          inicio: params.inicio,
          finalizaEn,
          version: { increment: 1 },
          eventos: {
            create: {
              estadoPrev: turno.estado,
              estadoNuevo: turno.estado,
              usuarioId: params.usuarioId,
              detalle: "Turno reprogramado",
            },
          },
        },
        include: {
          cliente: true,
          vehiculo: true,
          detalles: true,
          bahia: true,
          eventos: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      });
    });
  } catch (e) {
    if (e instanceof DomainError) {
      if (e.code === "VersionConflicto" || e.code === "RecursoNoEncontrado") throw e;
      throw new DomainError(
        "Conflicto al reprogramar — se mantiene el horario anterior",
        "CapacidadConflicto"
      );
    }
    if (
      e instanceof Error &&
      (e.message.includes("ocupacion_bahia_no_overlap") ||
        (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034"))
    ) {
      throw new DomainError(
        "Conflicto al reprogramar — se mantiene el horario anterior",
        "CapacidadConflicto"
      );
    }
    throw e;
  }
}
