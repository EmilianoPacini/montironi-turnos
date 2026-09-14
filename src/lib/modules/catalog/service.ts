import prisma from "@/lib/db";
import { DomainError } from "@/lib/modules/appointments/errors";

export async function listServicios(empresaId: string) {
  return prisma.servicio.findMany({
    where: { empresaId, activo: true },
    include: { tipoServicio: true },
    orderBy: [{ tipoServicio: { nombre: "asc" } }, { nombre: "asc" }],
  });
}

export async function listTiposServicio(empresaId: string) {
  return prisma.tipoServicio.findMany({
    where: { empresaId, activo: true },
    include: { servicios: { where: { activo: true } } },
  });
}

export async function getServicio(id: string, empresaId: string) {
  return prisma.servicio.findFirst({
    where: { id, empresaId },
    include: { tipoServicio: true },
  });
}

export async function listTalleres(empresaId: string) {
  return prisma.taller.findMany({
    where: { empresaId, activo: true },
    include: {
      bahias: { where: { activa: true }, orderBy: { orden: "asc" } },
      configuracion: true,
    },
    orderBy: { nombre: "asc" },
  });
}

export async function getTaller(id: string, empresaId: string) {
  return prisma.taller.findFirst({
    where: { id, empresaId },
    include: {
      bahias: { orderBy: { orden: "asc" } },
      patronesHorario: { include: { franjas: true } },
      excepciones: { orderBy: { fecha: "desc" }, take: 30 },
      configuracion: true,
    },
  });
}

export async function getConfiguracionTaller(tallerId: string, empresaId: string) {
  const taller = await prisma.taller.findFirst({
    where: { id: tallerId, empresaId },
    select: { id: true },
  });
  if (!taller) {
    throw new DomainError("Taller no encontrado", "RecursoNoEncontrado");
  }
  return prisma.configuracionTurnos.findUnique({ where: { tallerId } });
}

export async function updateConfiguracionTaller(params: {
  tallerId: string;
  empresaId: string;
  margenMinutos: number;
}) {
  const taller = await prisma.taller.findFirst({
    where: { id: params.tallerId, empresaId: params.empresaId },
  });
  if (!taller) {
    throw new DomainError("Taller no encontrado", "RecursoNoEncontrado");
  }

  return prisma.configuracionTurnos.upsert({
    where: { tallerId: params.tallerId },
    create: { tallerId: params.tallerId, margenMinutos: params.margenMinutos },
    update: { margenMinutos: params.margenMinutos },
  });
}

export async function createServicio(params: {
  empresaId: string;
  tipoServicioId: string;
  nombre: string;
  descripcion?: string;
  duracionMin: number;
  precio: number;
  modoPrecio?: "fijo" | "desde" | "a_presupuestar";
}) {
  const tipoServicio = await prisma.tipoServicio.findFirst({
    where: { id: params.tipoServicioId, empresaId: params.empresaId },
  });
  if (!tipoServicio) {
    throw new DomainError("Tipo de servicio no encontrado", "RecursoNoEncontrado");
  }

  return prisma.servicio.create({
    data: {
      empresaId: params.empresaId,
      tipoServicioId: params.tipoServicioId,
      nombre: params.nombre,
      descripcion: params.descripcion,
      duracionMin: params.duracionMin,
      precio: params.precio,
      modoPrecio: params.modoPrecio ?? "fijo",
    },
  });
}

export async function updateServicio(
  id: string,
  empresaId: string,
  data: {
    nombre?: string;
    descripcion?: string;
    duracionMin?: number;
    precio?: number;
    modoPrecio?: "fijo" | "desde" | "a_presupuestar";
    activo?: boolean;
  }
) {
  return prisma.servicio.updateMany({
    where: { id, empresaId },
    data,
  });
}

export async function serviciosForTaller(tallerId: string, empresaId: string) {
  return prisma.servicio.findMany({
    where: {
      empresaId,
      activo: true,
      tallerServicios: { some: { tallerId, activo: true } },
    },
    include: { tipoServicio: true },
    orderBy: { nombre: "asc" },
  });
}
