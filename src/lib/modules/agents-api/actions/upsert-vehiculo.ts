import { CondicionVehiculo, TipoVehiculo } from "@prisma/client";
import { upsertVehiculo } from "@/lib/modules/customers/service";

export async function handleUpsertVehiculo(empresaId: string, body: Record<string, unknown>) {
  const vehiculo = await upsertVehiculo({
    empresaId,
    patente: String(body.patente),
    marca: body.marca ? String(body.marca) : undefined,
    modelo: body.modelo ? String(body.modelo) : undefined,
    anio: body.anio ? Number(body.anio) : undefined,
    color: body.color ? String(body.color) : undefined,
    tipoVehiculo: body.tipoVehiculo as TipoVehiculo | undefined,
    condicion: body.condicion as CondicionVehiculo | undefined,
    kilometrajeActual: body.kilometrajeActual ? Number(body.kilometrajeActual) : undefined,
    clienteId: String(body.clienteId),
  });
  return { vehiculo };
}
