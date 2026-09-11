import { Prisma, EstadoTurno, CanalTurno, TipoOcupacion } from "@prisma/client";
import prisma from "@/lib/db";
import {
  assertWithinSchedule,
  calcularDuracionTotal,
  checkSlotAvailable,
  getCompatibleBahias,
  getMargenMin,
} from "@/lib/modules/availability/service";
import { canTransition, isActiveEstado } from "@/lib/modules/appointments/constants";
import { shouldLiberateOcupacion } from "@/lib/modules/agenda/domain/policies";
import { turnoRepository } from "@/lib/modules/agenda/infrastructure/turno.repository";
import { AppointmentError, DomainError } from "@/lib/modules/appointments/errors";
import { registrarMovimiento } from "@/lib/modules/audit/movimiento.service";

export const PAST_SLOT_MESSAGE = "No se permiten asignar turnos para horarios vencidos";

export function assertNotPastInicio(inicio: Date, now: Date = new Date()) {
  if (inicio < now) {
    throw new DomainError(PAST_SLOT_MESSAGE, "HorarioVencido");
  }
}

export { AppointmentError, DomainError, isDomainError, httpStatusForDomainError } from "@/lib/modules/appointments/errors";

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
  kilometraje?: number;
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
    throw new DomainError("Ninguna bahía compatible con los servicios", "BahiaIncompatible");
  }

  if (params.bahiaId) {
    if (!compatible.some((b) => b.id === params.bahiaId)) {
      throw new DomainError("Bahía incompatible con los servicios", "BahiaIncompatible");
    }
    const available = await checkSlotAvailable(
      params.bahiaId,
      params.inicio,
      params.fin,
      params.excludeTurnoId
    );
    if (!available) {
      throw new DomainError("Horario no disponible", "CapacidadConflicto");
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
    throw new DomainError("Horario no disponible", "CapacidadConflicto");
  }

  if (availableBahias.length === 1) {
    return { bahiaId: availableBahias[0].id, autoAssigned: true };
  }

  throw new DomainError(
    "Seleccioná una bahía — hay varias compatibles disponibles",
    "BahiaIncompatible"
  );
}

async function insertOcupacionTurno(
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

async function liberateOcupacionTurno(tx: Prisma.TransactionClient, turnoId: string) {
  await tx.ocupacionBahia.updateMany({
    where: { turnoId, activo: true },
    data: { activo: false },
  });
}

async function refreshOcupacionTurno(
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

/** CrearTurnoPendiente: reserva capacidad con ocupacion_bahia activa (tipo=turno). */
export async function crearTurnoPendiente(input: Omit<CreateTurnoInput, "confirmar">) {
  return createTurno({ ...input, confirmar: false });
}

async function assertCreateTurnoTenantScope(input: CreateTurnoInput) {
  const [cliente, vehiculo, taller, link] = await Promise.all([
    prisma.cliente.findFirst({
      where: { id: input.clienteId, empresaId: input.empresaId },
    }),
    prisma.vehiculo.findFirst({
      where: { id: input.vehiculoId, empresaId: input.empresaId },
    }),
    prisma.taller.findFirst({
      where: { id: input.tallerId, empresaId: input.empresaId },
    }),
    prisma.clienteVehiculo.findFirst({
      where: {
        clienteId: input.clienteId,
        vehiculoId: input.vehiculoId,
        cliente: { empresaId: input.empresaId },
        vehiculo: { empresaId: input.empresaId },
      },
    }),
  ]);

  if (!cliente || !vehiculo || !taller || !link) {
    throw new DomainError("Recurso no encontrado", "RecursoNoEncontrado");
  }
}

export async function createTurno(input: CreateTurnoInput) {
  await assertCreateTurnoTenantScope(input);

  const { duracionMin, servicios } = await calcularDuracionTotal({
    empresaId: input.empresaId,
    tallerId: input.tallerId,
    servicioIds: input.servicioIds,
  });

  if (servicios.length !== input.servicioIds.length) {
    throw new DomainError("Servicios inválidos", "RecursoNoEncontrado");
  }

  const finalizaEn = new Date(input.inicio.getTime() + duracionMin * 60_000);

  await assertWithinSchedule(input.tallerId, input.inicio, finalizaEn);

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
          kilometraje: input.kilometraje,
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
              detalle: input.confirmar ? "Turno creado y confirmado" : "Turno pendiente creado",
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

      await insertOcupacionTurno(tx, {
        bahiaId,
        turnoId: turno.id,
        inicio: input.inicio,
        fin: finalizaEn,
      });

      await registrarMovimiento(
        {
          empresaId: input.empresaId,
          entidad: "turno",
          entidadId: turno.id,
          accion: input.confirmar ? "crear_confirmado" : "crear_pendiente",
          detalle: { inicio: input.inicio.toISOString(), bahiaId, estado },
          usuarioId: input.creadorId,
        },
        tx
      );

      return turno;
    });
  } catch (e) {
    if (e instanceof DomainError) throw e;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      throw new DomainError("Conflicto de reserva", "CapacidadConflicto");
    }
    if (e instanceof Error && e.message.includes("ocupacion_bahia_no_overlap")) {
      throw new DomainError("Conflicto de reserva", "CapacidadConflicto");
    }
    throw e;
  }
}

/** Misma regla que VencerPendientes / expirePendingTurnos. */
export function isPendingExpired(
  turno: { estado: EstadoTurno; inicio: Date },
  now: Date = new Date()
): boolean {
  return turno.estado === EstadoTurno.pendiente && turno.inicio < now;
}

async function vencePendienteEnTx(
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

  let resolvedBahiaId: string;
  try {
    ({ bahiaId: resolvedBahiaId } = await resolveBahiaAssignment({
      tallerId: turno.tallerId,
      servicioIds,
      inicio: params.inicio,
      fin: finalizaEn,
      bahiaId: params.bahiaId ?? turno.bahiaId,
      excludeTurnoId: turno.id,
    }));
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
      if (params.nuevoEstado === EstadoTurno.finalizado && turno.kilometraje != null) {
        await tx.vehiculo.update({
          where: { id: turno.vehiculoId },
          data: { kilometrajeActual: turno.kilometraje },
        });
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

async function transitionTurno(params: {
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
