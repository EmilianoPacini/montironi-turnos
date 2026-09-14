import prisma from "@/lib/db";
import { CondicionVehiculo, TipoVehiculo } from "@prisma/client";
import { DomainError } from "@/lib/modules/appointments/errors";

export async function listIntervalosServicio(servicioId: string, empresaId: string) {
  return prisma.servicioIntervaloKm.findMany({
    where: { servicioId, servicio: { empresaId } },
    orderBy: [{ tipoVehiculo: "asc" }, { condicion: "asc" }],
  });
}

export async function listIntervalosKm(empresaId: string) {
  return prisma.servicioIntervaloKm.findMany({
    where: { servicio: { empresaId } },
    include: { servicio: { select: { id: true, nombre: true } } },
    orderBy: [
      { servicio: { nombre: "asc" } },
      { tipoVehiculo: "asc" },
      { condicion: "asc" },
    ],
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
  if (!servicio) {
    throw new DomainError("Servicio no encontrado", "RecursoNoEncontrado");
  }

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
      empresaId: params.empresaId,
      tipoVehiculo: params.tipoVehiculo,
      condicion: params.condicion,
      intervaloKm: params.intervaloKm,
    },
    update: {
      intervaloKm: params.intervaloKm,
      empresaId: params.empresaId,
    },
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

export interface ProximoKmEntry {
  servicio: string;
  proximoKm: number;
}

export async function getProximosKmForTurno(params: {
  detalles: { servicioId: string; nombreSnapshot: string }[];
  vehiculo: {
    tipoVehiculo: TipoVehiculo;
    condicion: CondicionVehiculo;
    kilometrajeActual?: number | null;
  };
  turnoKilometraje?: number | null;
}): Promise<ProximoKmEntry[]> {
  const km = params.vehiculo.kilometrajeActual ?? params.turnoKilometraje;
  if (km == null) return [];

  const entries = await Promise.all(
    params.detalles.map(async (d) => {
      const proximo = await calcularProximoServicioKm({
        servicioId: d.servicioId,
        tipoVehiculo: params.vehiculo.tipoVehiculo,
        condicion: params.vehiculo.condicion,
        kilometrajeActual: km,
      });
      return proximo != null ? { servicio: d.nombreSnapshot, proximoKm: proximo } : null;
    })
  );

  return entries.filter((entry): entry is ProximoKmEntry => entry != null);
}
