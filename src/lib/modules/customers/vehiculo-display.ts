import prisma from "@/lib/db";
import { TipoVehiculo, Vehiculo } from "@prisma/client";
import { calcularProximoServicioKm } from "@/lib/modules/catalog/intervalo.service";

export const TIPO_VEHICULO_LABELS: Record<TipoVehiculo, string> = {
  auto: "Auto",
  camioneta: "Camioneta",
};

export type VehiculoEnriquecido = {
  clienteVehiculoId: string;
  id: string;
  patente: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  color: string | null;
  tipoVehiculo: TipoVehiculo;
  kilometrajeActual: number | null;
  proximoServicio: string | null;
};

export async function enrichVehiculosForCliente(
  empresaId: string,
  clienteVehiculos: { id: string; vehiculo: Vehiculo }[]
): Promise<VehiculoEnriquecido[]> {
  return Promise.all(
    clienteVehiculos.map(async (cv) => {
      const v = cv.vehiculo;
      let proximoServicio: string | null = null;

      if (v.kilometrajeActual != null) {
        const ultimoTurno = await prisma.turno.findFirst({
          where: { vehiculoId: v.id, empresaId },
          orderBy: { inicio: "desc" },
          include: { detalles: true },
        });

        if (ultimoTurno) {
          const candidatos: { servicio: string; proximoKm: number }[] = [];
          for (const d of ultimoTurno.detalles) {
            const proximoKm = await calcularProximoServicioKm({
              servicioId: d.servicioId,
              tipoVehiculo: v.tipoVehiculo,
              condicion: v.condicion,
              kilometrajeActual: v.kilometrajeActual,
            });
            if (proximoKm != null) {
              candidatos.push({ servicio: d.nombreSnapshot, proximoKm });
            }
          }
          if (candidatos.length > 0) {
            const nearest = candidatos.sort((a, b) => a.proximoKm - b.proximoKm)[0];
            proximoServicio = `${nearest.servicio}: ${nearest.proximoKm.toLocaleString("es-AR")} km`;
          }
        }
      }

      return {
        clienteVehiculoId: cv.id,
        id: v.id,
        patente: v.patente,
        marca: v.marca,
        modelo: v.modelo,
        anio: v.anio,
        color: v.color,
        tipoVehiculo: v.tipoVehiculo,
        kilometrajeActual: v.kilometrajeActual,
        proximoServicio,
      };
    })
  );
}
