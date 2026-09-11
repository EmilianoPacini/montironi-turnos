import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { getCliente } from "@/lib/modules/customers/service";
import { VehiculoForm } from "@/components/clientes/VehiculoForm";

export default async function NuevoVehiculoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  const { id } = await params;
  const cliente = await getCliente(id, session.empresaId);
  if (!cliente) notFound();

  return (
    <div className="panel-page">
      <Link
        href={`/clientes/${id}#vehiculos`}
        className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
      >
        ← {cliente.nombre} {cliente.apellido ?? ""}
      </Link>
      <h1 className="panel-title mt-4">Nuevo vehículo</h1>
      <p className="panel-subtitle">
        Mismos campos que al crear un vehículo desde un turno nuevo.
      </p>
      <div className="mt-6">
        <VehiculoForm
          clienteId={id}
          submitLabel="Guardar vehículo"
          cancelHref={`/clientes/${id}#vehiculos`}
        />
      </div>
    </div>
  );
}
