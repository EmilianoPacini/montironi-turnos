import prisma from "@/lib/db";
import { DomainError } from "@/lib/modules/appointments/errors";
import { registrarMovimiento } from "@/lib/modules/audit/movimiento.service";

export async function listBahiasTaller(tallerId: string, empresaId: string) {
  return prisma.bahia.findMany({
    where: { tallerId, taller: { empresaId } },
    orderBy: { orden: "asc" },
    include: {
      bahiaServicios: { include: { servicio: true } },
      ocupaciones: {
        where: { activo: true, tipo: "bloqueo" },
        orderBy: { inicio: "desc" },
        take: 5,
      },
    },
  });
}

export async function createBahia(params: {
  tallerId: string;
  empresaId: string;
  nombre: string;
  orden?: number;
  servicioIds?: string[];
  usuarioId?: string;
}) {
  const taller = await prisma.taller.findFirst({
    where: { id: params.tallerId, empresaId: params.empresaId },
  });
  if (!taller) throw new DomainError("Taller no encontrado", "RecursoNoEncontrado");

  const maxOrden = await prisma.bahia.aggregate({
    where: { tallerId: params.tallerId },
    _max: { orden: true },
  });

  const bahia = await prisma.bahia.create({
    data: {
      tallerId: params.tallerId,
      nombre: params.nombre,
      orden: params.orden ?? (maxOrden._max.orden ?? 0) + 1,
      bahiaServicios: params.servicioIds?.length
        ? { create: params.servicioIds.map((servicioId) => ({ servicioId })) }
        : undefined,
    },
  });

  await registrarMovimiento({
    empresaId: params.empresaId,
    entidad: "bahia",
    entidadId: bahia.id,
    accion: "crear_bahia",
    detalle: { nombre: bahia.nombre, tallerId: params.tallerId },
    usuarioId: params.usuarioId,
  });

  return bahia;
}

export async function updateBahia(params: {
  bahiaId: string;
  empresaId: string;
  nombre?: string;
  activa?: boolean;
  servicioIds?: string[];
  usuarioId?: string;
}) {
  const bahia = await prisma.bahia.findFirst({
    where: { id: params.bahiaId, taller: { empresaId: params.empresaId } },
  });
  if (!bahia) throw new DomainError("Bahía no encontrada", "RecursoNoEncontrado");

  if (params.servicioIds) {
    await prisma.bahiaServicio.deleteMany({ where: { bahiaId: params.bahiaId } });
    await prisma.bahiaServicio.createMany({
      data: params.servicioIds.map((servicioId) => ({ bahiaId: params.bahiaId, servicioId })),
    });
  }

  const updated = await prisma.bahia.update({
    where: { id: params.bahiaId },
    data: {
      ...(params.nombre !== undefined ? { nombre: params.nombre } : {}),
      ...(params.activa !== undefined ? { activa: params.activa } : {}),
    },
  });

  await registrarMovimiento({
    empresaId: params.empresaId,
    entidad: "bahia",
    entidadId: bahia.id,
    accion: "actualizar_bahia",
    detalle: { nombre: updated.nombre, activa: updated.activa },
    usuarioId: params.usuarioId,
  });

  return updated;
}
