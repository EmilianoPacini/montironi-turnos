import prisma from "@/lib/db";
import { CondicionVehiculo, TipoVehiculo } from "@prisma/client";

export async function listIntervalosServicio(servicioId: string, empresaId: string) {
  return prisma.servicioIntervaloKm.findMany({
    where: { servicioId, servicio: { empresaId } },
    orderBy: [{ tipoVehiculo: "asc" }, { condicion: "asc" }],
  });
}

export async function upsertIntervaloKm(params: {
  servicioId: string;
  empresaId: string;
  tipoVehiculo: TipoVehiculo;
  condicion: CondicionVehiculo;
  intervaloKm: number;
}) {
  const servicio = await prisma.servicio.findFirst({
    where: { id: params.servicioId, empresaId: params.empresaId },
  });
  if (!servicio) throw new Error("NOT_FOUND");

  return prisma.servicioIntervaloKm.upsert({
    where: {
      servicioId_tipoVehiculo_condicion: {
        servicioId: params.servicioId,
        tipoVehiculo: params.tipoVehiculo,
        condicion: params.condicion,
      },
    },
    create: {
      servicioId: params.servicioId,
      tipoVehiculo: params.tipoVehiculo,
      condicion: params.condicion,
      intervaloKm: params.intervaloKm,
    },
    update: { intervaloKm: params.intervaloKm },
  });
}

export async function calcularProximoServicioKm(params: {
  servicioId: string;
  tipoVehiculo: TipoVehiculo;
  condicion: CondicionVehiculo;
  kilometrajeActual: number;
}): Promise<number | null> {
  const intervalo = await prisma.servicioIntervaloKm.findUnique({
    where: {
      servicioId_tipoVehiculo_condicion: {
        servicioId: params.servicioId,
        tipoVehiculo: params.tipoVehiculo,
        condicion: params.condicion,
      },
    },
  });
  if (!intervalo) return null;
  return params.kilometrajeActual + intervalo.intervaloKm;
}
