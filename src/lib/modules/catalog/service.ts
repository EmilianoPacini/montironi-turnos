import prisma from "@/lib/db";

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
    },
  });
}

export async function getConfiguracion(empresaId: string) {
  return prisma.configuracionTurnos.findUnique({ where: { empresaId } });
}

export async function updateConfiguracion(empresaId: string, margenMin: number) {
  return prisma.configuracionTurnos.upsert({
    where: { empresaId },
    create: { empresaId, margenMin },
    update: { margenMin },
  });
}

export async function createServicio(params: {
  empresaId: string;
  tipoServicioId: string;
  nombre: string;
  descripcion?: string;
  duracionMin: number;
  precio: number;
}) {
  return prisma.servicio.create({
    data: {
      empresaId: params.empresaId,
      tipoServicioId: params.tipoServicioId,
      nombre: params.nombre,
      descripcion: params.descripcion,
      duracionMin: params.duracionMin,
      precio: params.precio,
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
