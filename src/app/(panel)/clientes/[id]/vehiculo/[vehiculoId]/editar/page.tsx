import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { getCliente, getVehiculoForCliente } from "@/lib/modules/customers/service";
import { VehiculoForm } from "@/components/clientes/VehiculoForm";

export default async function EditarVehiculoPage({
  params,
}: {
  params: Promise<{ id: string; vehiculoId: string }>;
}) {
  const session = await getAuthSession();
  const { id, vehiculoId } = await params;
  const cliente = await getCliente(id, session.empresaId);
  if (!cliente) notFound();

  const vehiculo = await getVehiculoForCliente(vehiculoId, id, session.empresaId);
  if (!vehiculo) notFound();

  return (
    <div className="panel-page">
      <Link
        href={`/clientes/${id}#vehiculos`}
        className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
      >
        ← {cliente.nombre} {cliente.apellido ?? ""}
      </Link>
      <h1 className="panel-title mt-4">Editar vehículo</h1>
      <p className="panel-subtitle">Patente {vehiculo.patente}</p>
      <div className="mt-6">
        <VehiculoForm
          key={vehiculo.patente}
          clienteId={id}
          vehiculo={vehiculo}
          submitLabel="Guardar cambios"
          cancelHref={`/clientes/${id}#vehiculos`}
        />
      </div>
    </div>
  );
}
