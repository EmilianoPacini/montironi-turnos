import prisma from "@/lib/db";

export type ServicioAgentsDto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  duracion_minutos: number;
  precio: number;
  moneda: "ARS";
  modo_precio: "fijo" | "desde" | "a_presupuestar";
};

function mapServicio(row: {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracionMin: number;
  precio: { toString(): string } | number;
  modoPrecio: "fijo" | "desde" | "a_presupuestar";
  tipoServicio: { nombre: string };
}): ServicioAgentsDto {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    tipo: row.tipoServicio.nombre,
    duracion_minutos: row.duracionMin,
    precio: Number(row.precio),
    moneda: "ARS",
    modo_precio: row.modoPrecio,
  };
}

export async function listServiciosForAgents(empresaId: string): Promise<ServicioAgentsDto[]> {
  const servicios = await prisma.servicio.findMany({
    where: { empresaId, activo: true },
    include: { tipoServicio: { select: { nombre: true } } },
    orderBy: [{ tipoServicio: { nombre: "asc" } }, { nombre: "asc" }],
  });
  return servicios.map(mapServicio);
}

export async function getServicioForAgents(params: {
  empresaId: string;
  id: string;
}): Promise<ServicioAgentsDto | null> {
  const servicio = await prisma.servicio.findFirst({
    where: { id: params.id, empresaId: params.empresaId, activo: true },
    include: { tipoServicio: { select: { nombre: true } } },
  });
  if (!servicio) return null;
  return mapServicio(servicio);
}
