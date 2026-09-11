import { EstadoTurno, CanalTurno, TipoOcupacion } from "@prisma/client";
import prisma from "@/lib/db";
import { assertWithinSchedule, checkSlotAvailable } from "@/lib/modules/availability/service";
import { DomainError } from "@/lib/modules/appointments/errors";

export { AppointmentError, DomainError, isDomainError, httpStatusForDomainError } from "@/lib/modules/appointments/errors";

export type { CreateTurnoInput } from "@/lib/modules/appointments/application/types";
export { PAST_SLOT_MESSAGE, assertNotPastInicio } from "@/lib/modules/appointments/application/validation";
export { resolveBahiaAssignment } from "@/lib/modules/appointments/application/resolve-bahia";
export { createTurno, crearTurnoPendiente } from "@/lib/modules/appointments/application/create-turno";
export { isPendingExpired, expirePendingTurnos } from "@/lib/modules/appointments/application/expire-pending";
export { confirmTurno } from "@/lib/modules/appointments/application/confirm-turno";
export { rescheduleTurno } from "@/lib/modules/appointments/application/reschedule-turno";
export { cancelTurno } from "@/lib/modules/appointments/application/cancel-turno";
export { transitionTurnoState } from "@/lib/modules/appointments/application/transition-turno-state";

/** CrearBloqueoBahia: tipo=bloqueo, turno_id NULL, motivo obligatorio, mismo EXCLUDE GiST. */
export async function crearBloqueoBahia(params: {
  empresaId: string;
  bahiaId: string;
  inicio: Date;
  fin: Date;
  motivo: string;
  usuarioId?: string;
}) {
  return blockBahia(params);
}

export async function blockBahia(params: {
  empresaId: string;
  bahiaId: string;
  inicio: Date;
  fin: Date;
  motivo: string;
  usuarioId?: string;
}) {
  const motivo = params.motivo.trim();
  if (!motivo) {
    throw new DomainError("El motivo es obligatorio para bloqueos", "BloqueoInvalido");
  }

  const bahia = await prisma.bahia.findFirst({
    where: { id: params.bahiaId, taller: { empresaId: params.empresaId } },
  });

  if (!bahia) throw new DomainError("Bahía no encontrada", "RecursoNoEncontrado");

  await assertWithinSchedule(bahia.tallerId, params.inicio, params.fin);

  const available = await checkSlotAvailable(params.bahiaId, params.inicio, params.fin);
  if (!available) {
    throw new DomainError("Horario ocupado", "CapacidadConflicto");
  }

  try {
    return await prisma.ocupacionBahia.create({
      data: {
        bahiaId: params.bahiaId,
        tipo: TipoOcupacion.bloqueo,
        inicio: params.inicio,
        fin: params.fin,
        motivo,
        creadoPorUsuarioId: params.usuarioId,
        activo: true,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("ocupacion_bahia_no_overlap")) {
      throw new DomainError("Conflicto al bloquear", "CapacidadConflicto");
    }
    throw e;
  }
}

export async function getTurnoById(turnoId: string, empresaId: string) {
  return prisma.turno.findFirst({
    where: { id: turnoId, empresaId },
    include: {
      cliente: true,
      vehiculo: true,
      detalles: { include: { servicio: true } },
      bahia: true,
      taller: true,
      creador: true,
      eventos: {
        orderBy: { createdAt: "desc" },
        include: { usuario: true },
      },
    },
  });
}

export async function listTurnos(params: {
  empresaId: string;
  tallerId?: string;
  estados?: EstadoTurno[];
  canal?: CanalTurno;
  pendientesOnly?: boolean;
  from?: Date;
  to?: Date;
}) {
  return prisma.turno.findMany({
    where: {
      empresaId: params.empresaId,
      ...(params.tallerId ? { tallerId: params.tallerId } : {}),
      ...(params.estados?.length ? { estado: { in: params.estados } } : {}),
      ...(params.pendientesOnly ? { estado: EstadoTurno.pendiente } : {}),
      ...(params.canal ? { canal: params.canal } : {}),
      ...(params.from || params.to
        ? {
            inicio: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lt: params.to } : {}),
            },
          }
        : {}),
    },
    include: {
      cliente: true,
      vehiculo: true,
      bahia: true,
      detalles: true,
      creador: true,
    },
    orderBy: { inicio: "asc" },
  });
}

export async function removeBlock(blockId: string, empresaId: string) {
  const block = await prisma.ocupacionBahia.findFirst({
    where: {
      id: blockId,
      tipo: TipoOcupacion.bloqueo,
      bahia: { taller: { empresaId } },
    },
  });

  if (!block) throw new DomainError("Bloqueo no encontrado", "RecursoNoEncontrado");

  return prisma.ocupacionBahia.update({
    where: { id: blockId },
    data: { activo: false },
  });
}
