import { Prisma, EstadoTurno, CanalTurno } from "@prisma/client";
import prisma from "@/lib/db";
import { assertWithinSchedule, calcularDuracionTotal } from "@/lib/modules/availability/service";
import { DomainError } from "@/lib/modules/appointments/errors";
import { registrarMovimiento } from "@/lib/modules/audit/movimiento.service";
import { insertOcupacionTurno } from "@/lib/modules/appointments/application/internal/occupation";
import { resolveBahiaAssignment } from "@/lib/modules/appointments/application/resolve-bahia";
import type { CreateTurnoInput } from "@/lib/modules/appointments/application/types";

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

/** CrearTurnoPendiente: reserva capacidad con ocupacion_bahia activa (tipo=turno). */
export async function crearTurnoPendiente(input: Omit<CreateTurnoInput, "confirmar">) {
  return createTurno({ ...input, confirmar: false });
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
