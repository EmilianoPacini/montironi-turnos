import { Prisma, EstadoTurno, CanalTurno, TipoOcupacion } from "@prisma/client";
import prisma from "@/lib/db";
import {
  calcularDuracionTotal,
  checkSlotAvailable,
  getCompatibleBahias,
  getMargenMin,
} from "@/lib/modules/availability/service";
import { canTransition, isActiveEstado } from "@/lib/modules/appointments/constants";

export class AppointmentError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "AppointmentError";
  }
}

export interface CreateTurnoInput {
  empresaId: string;
  tallerId: string;
  bahiaId?: string;
  clienteId: string;
  vehiculoId: string;
  servicioIds: string[];
  inicio: Date;
  canal?: CanalTurno;
  notas?: string;
  creadorId?: string;
  confirmar?: boolean;
}

export async function resolveBahiaAssignment(params: {
  tallerId: string;
  servicioIds: string[];
  inicio: Date;
  fin: Date;
  bahiaId?: string;
  excludeTurnoId?: string;
}): Promise<{ bahiaId: string; autoAssigned: boolean }> {
  const compatible = await getCompatibleBahias(params.tallerId, params.servicioIds);

  if (compatible.length === 0) {
    throw new AppointmentError("Ninguna bahía compatible con los servicios", "INCOMPATIBLE_BAY");
  }

  if (params.bahiaId) {
    // Manual override always wins when compatible and available.
    if (!compatible.some((b) => b.id === params.bahiaId)) {
      throw new AppointmentError("Bahía incompatible con los servicios", "INCOMPATIBLE_BAY");
    }
    const available = await checkSlotAvailable(
      params.bahiaId,
      params.inicio,
      params.fin,
      params.excludeTurnoId
    );
    if (!available) {
      throw new AppointmentError("Horario no disponible", "SLOT_UNAVAILABLE");
    }
    return { bahiaId: params.bahiaId, autoAssigned: false };
  }

  const availableBahias = [];
  for (const bahia of compatible) {
    if (
      await checkSlotAvailable(bahia.id, params.inicio, params.fin, params.excludeTurnoId)
    ) {
      availableBahias.push(bahia);
    }
  }

  if (availableBahias.length === 0) {
    throw new AppointmentError("Horario no disponible", "SLOT_UNAVAILABLE");
  }

  if (availableBahias.length === 1) {
    return { bahiaId: availableBahias[0].id, autoAssigned: true };
  }

  throw new AppointmentError(
    "Seleccioná una bahía — hay varias compatibles disponibles",
    "BAY_REQUIRED"
  );
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
      await tx.ocupacionBahia.updateMany({
        where: { turnoId: turno.id },
        data: { activo: false },
      });
      await tx.turno.update({
        where: { id: turno.id },
        data: {
          estado: EstadoTurno.vencido,
          version: { increment: 1 },
          eventos: {
            create: {
              estadoPrev: EstadoTurno.pendiente,
              estadoNuevo: EstadoTurno.vencido,
              detalle: "Vencido automáticamente — hora de inicio superada sin confirmación",
            },
          },
        },
      });
    });
  }

  return expired.length;
}

export async function createTurno(input: CreateTurnoInput) {
  const { duracionMin, servicios } = await calcularDuracionTotal({
    empresaId: input.empresaId,
    tallerId: input.tallerId,
    servicioIds: input.servicioIds,
  });

  if (servicios.length !== input.servicioIds.length) {
    throw new AppointmentError("Servicios inválidos", "INVALID_SERVICES");
  }

  const finalizaEn = new Date(input.inicio.getTime() + duracionMin * 60_000);

  const { bahiaId } = await resolveBahiaAssignment({
    tallerId: input.tallerId,
    servicioIds: input.servicioIds,
    inicio: input.inicio,
    fin: finalizaEn,
    bahiaId: input.bahiaId,
  });

  const estado = input.confirmar ? EstadoTurno.confirmado : EstadoTurno.pendiente;

  try {
    return await prisma.$transaction(async (tx) => {
      const turno = await tx.turno.create({
        data: {
          empresaId: input.empresaId,
          tallerId: input.tallerId,
          bahiaId,
          clienteId: input.clienteId,
          vehiculoId: input.vehiculoId,
          creadorId: input.creadorId,
          canal: input.canal ?? CanalTurno.interno,
          estado,
          inicio: input.inicio,
          finalizaEn,
          notas: input.notas,
          detalles: {
            create: servicios.map((s, i) => ({
              servicioId: s.id,
              nombreSnapshot: s.nombre,
              duracionMin: s.duracionMin,
              precioSnapshot: s.precio,
              modoPrecioSnapshot: s.modoPrecio,
              orden: i,
            })),
          },
          eventos: {
            create: {
              estadoNuevo: estado,
              usuarioId: input.creadorId,
              detalle: "Turno creado",
            },
          },
        },
        include: {
          cliente: true,
          vehiculo: true,
          detalles: true,
          bahia: true,
        },
      });

      await tx.ocupacionBahia.create({
        data: {
          bahiaId,
          turnoId: turno.id,
          tipo: TipoOcupacion.turno,
          inicio: input.inicio,
          fin: finalizaEn,
          activo: true,
        },
      });

      return turno;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      throw new AppointmentError("Conflicto de reserva", "CONFLICT");
    }
    if (
      e instanceof Error &&
      e.message.includes("ocupacion_bahia_no_overlap")
    ) {
      throw new AppointmentError("Conflicto de reserva", "CONFLICT");
    }
    throw e;
  }
}

export async function confirmTurno(params: {
  turnoId: string;
  empresaId: string;
  usuarioId?: string;
  version?: number;
}) {
  const turno = await prisma.turno.findFirst({
    where: { id: params.turnoId, empresaId: params.empresaId },
  });

  if (!turno) throw new AppointmentError("Turno no encontrado", "NOT_FOUND");
  if (params.version !== undefined && turno.version !== params.version) {
    throw new AppointmentError("El turno fue modificado", "VERSION_CONFLICT");
  }
  if (!canTransition(turno.estado, EstadoTurno.confirmado)) {
    throw new AppointmentError("Transición inválida", "INVALID_TRANSITION");
  }

  const available = await checkSlotAvailable(
    turno.bahiaId,
    turno.inicio,
    turno.finalizaEn,
    turno.id
  );
  if (!available) {
    throw new AppointmentError("Horario ya no disponible", "SLOT_UNAVAILABLE");
  }

  return transitionTurno({
    turno,
    nuevoEstado: EstadoTurno.confirmado,
    usuarioId: params.usuarioId,
    detalle: "Turno confirmado",
  });
}

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

  if (!turno) throw new AppointmentError("Turno no encontrado", "NOT_FOUND");
  if (turno.version !== params.version) {
    throw new AppointmentError("El turno fue modificado", "VERSION_CONFLICT");
  }
  if (!isActiveEstado(turno.estado)) {
    throw new AppointmentError("Turno no modificable", "INVALID_STATE");
  }

  const margen = await getMargenMin(turno.tallerId);
  const servicioIds = turno.detalles.map((d) => d.servicioId);
  const duracionMin = turno.detalles.reduce((a, d) => a + d.duracionMin, 0) + margen;
  const finalizaEn = new Date(params.inicio.getTime() + duracionMin * 60_000);

  let resolvedBahiaId: string;
  try {
    ({ bahiaId: resolvedBahiaId } = await resolveBahiaAssignment({
      tallerId: turno.tallerId,
      servicioIds,
      inicio: params.inicio,
      fin: finalizaEn,
      bahiaId: params.bahiaId,
      excludeTurnoId: turno.id,
    }));
  } catch (e) {
    if (e instanceof AppointmentError) {
      throw new AppointmentError(
        "Conflicto al reprogramar — se mantiene el horario anterior",
        "RESCHEDULE_CONFLICT"
      );
    }
    throw e;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.ocupacionBahia.updateMany({
        where: { turnoId: turno.id },
        data: { activo: false },
      });

      await tx.ocupacionBahia.create({
        data: {
          bahiaId: resolvedBahiaId,
          turnoId: turno.id,
          tipo: TipoOcupacion.turno,
          inicio: params.inicio,
          fin: finalizaEn,
          activo: true,
        },
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
    if (
      e instanceof Error &&
      (e.message.includes("ocupacion_bahia_no_overlap") ||
        (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034"))
    ) {
      throw new AppointmentError(
        "Conflicto al reprogramar — se mantiene el horario anterior",
        "RESCHEDULE_CONFLICT"
      );
    }
    throw e;
  }
}

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

  if (!turno) throw new AppointmentError("Turno no encontrado", "NOT_FOUND");
  if (params.version !== undefined && turno.version !== params.version) {
    throw new AppointmentError("El turno fue modificado", "VERSION_CONFLICT");
  }
  if (!canTransition(turno.estado, EstadoTurno.cancelado)) {
    throw new AppointmentError("No se puede cancelar", "INVALID_TRANSITION");
  }

  return prisma.$transaction(async (tx) => {
    await tx.ocupacionBahia.updateMany({
      where: { turnoId: turno.id },
      data: { activo: false },
    });

    return transitionTurno({
      turno,
      nuevoEstado: EstadoTurno.cancelado,
      usuarioId: params.usuarioId,
      detalle: params.motivo ?? "Turno cancelado",
      tx,
    });
  });
}

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

  if (!turno) throw new AppointmentError("Turno no encontrado", "NOT_FOUND");
  if (turno.version !== params.version) {
    throw new AppointmentError("El turno fue modificado", "VERSION_CONFLICT");
  }
  if (params.nuevoEstado === EstadoTurno.vencido) {
    throw new AppointmentError("Vencido solo se aplica automáticamente", "INVALID_TRANSITION");
  }
  if (!canTransition(turno.estado, params.nuevoEstado)) {
    throw new AppointmentError("Transición inválida", "INVALID_TRANSITION");
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

  return transitionTurno({
    turno,
    nuevoEstado: params.nuevoEstado,
    usuarioId: params.usuarioId,
    detalle: params.detalle,
  });
}

async function transitionTurno(params: {
  turno: { id: string; estado: EstadoTurno; version: number };
  nuevoEstado: EstadoTurno;
  usuarioId?: string;
  detalle?: string;
  tx?: Prisma.TransactionClient;
}) {
  const db = params.tx ?? prisma;

  return db.turno.update({
    where: { id: params.turno.id },
    data: {
      estado: params.nuevoEstado,
      version: { increment: 1 },
      eventos: {
        create: {
          estadoPrev: params.turno.estado,
          estadoNuevo: params.nuevoEstado,
          usuarioId: params.usuarioId,
          detalle: params.detalle,
        },
      },
    },
    include: {
      cliente: true,
      vehiculo: true,
      detalles: true,
      bahia: true,
      eventos: { orderBy: { createdAt: "desc" } },
    },
  });
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
    throw new AppointmentError("El motivo es obligatorio para bloqueos", "MOTIVO_REQUIRED");
  }

  const bahia = await prisma.bahia.findFirst({
    where: { id: params.bahiaId, taller: { empresaId: params.empresaId } },
  });

  if (!bahia) throw new AppointmentError("Bahía no encontrada", "NOT_FOUND");

  const available = await checkSlotAvailable(params.bahiaId, params.inicio, params.fin);
  if (!available) {
    throw new AppointmentError("Horario ocupado", "SLOT_UNAVAILABLE");
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
    if (
      e instanceof Error &&
      e.message.includes("ocupacion_bahia_no_overlap")
    ) {
      throw new AppointmentError("Conflicto al bloquear", "CONFLICT");
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

  if (!block) throw new AppointmentError("Bloqueo no encontrado", "NOT_FOUND");

  return prisma.ocupacionBahia.update({
    where: { id: blockId },
    data: { activo: false },
  });
}
