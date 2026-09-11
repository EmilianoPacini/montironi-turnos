import Link from "next/link";
import type { VehiculoEnriquecido } from "@/lib/modules/customers/vehiculo-display";
import { TIPO_VEHICULO_LABELS } from "@/lib/modules/customers/vehiculo-display";

export function VehiculoListSection({
  clienteId,
  vehiculos,
}: {
  clienteId: string;
  vehiculos: VehiculoEnriquecido[];
}) {
  return (
    <section id="vehiculos" className="panel-card scroll-mt-6 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Vehículos</h2>
        <Link href={`/clientes/${clienteId}/vehiculo/nuevo`} className="btn-primary">
          + Nuevo vehículo
        </Link>
      </div>

      {vehiculos.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Este cliente no tiene vehículos registrados.{" "}
          <Link
            href={`/clientes/${clienteId}/vehiculo/nuevo`}
            className="font-medium text-blue-700 hover:underline"
          >
            Agregar el primero
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th>Patente</th>
                <th>Modelo</th>
                <th>Tipo</th>
                <th>Km actual</th>
                <th>Próximo servicio</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {vehiculos.map((v) => (
                <tr key={v.id}>
                  <td className="font-semibold text-slate-900">{v.patente}</td>
                  <td>
                    {[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}
                    {v.anio ? (
                      <span className="text-slate-500"> · {v.anio}</span>
                    ) : null}
                  </td>
                  <td>{TIPO_VEHICULO_LABELS[v.tipoVehiculo]}</td>
                  <td>
                    {v.kilometrajeActual != null
                      ? `${v.kilometrajeActual.toLocaleString("es-AR")} km`
                      : "—"}
                  </td>
                  <td className="text-slate-600">{v.proximoServicio ?? "—"}</td>
                  <td>
                    <Link
                      href={`/clientes/${clienteId}/vehiculo/${v.id}/editar`}
                      className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
