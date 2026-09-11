import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getAuthSession } from "@/lib/auth/session";
import { getCliente } from "@/lib/modules/customers/service";
import { enrichVehiculosForCliente } from "@/lib/modules/customers/vehiculo-display";
import { VehiculoListSection } from "@/components/clientes/VehiculoListSection";
import { EstadoChip } from "@/components/turnos/EstadoChip";
import { EstadoTurno } from "@prisma/client";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();

  const { id } = await params;
  const cliente = await getCliente(id, session.empresaId);
  if (!cliente) notFound();

  const vehiculos = await enrichVehiculosForCliente(session.empresaId, cliente.vehiculos);

  return (
    <div className="panel-page">
      <Link
        href="/clientes"
        className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
      >
        ← Clientes
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="panel-title">
          {cliente.nombre} {cliente.apellido ?? ""}
        </h1>
        <Link
          href={`/clientes/${cliente.id}/editar`}
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Editar cliente
        </Link>
      </div>

      <section className="panel-card mt-6 p-5 lg:max-w-md">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Contacto</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Teléfono</dt>
            <dd className="font-medium text-slate-900">{cliente.telefono ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900">{cliente.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Documento</dt>
            <dd className="font-medium text-slate-900">{cliente.documento ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-6">
        <VehiculoListSection clienteId={cliente.id} vehiculos={vehiculos} />
      </div>

      <section className="panel-card mt-6 p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Turnos recientes</h2>
          {cliente.turnos.length === 0 ? (
            <p className="text-sm text-slate-500">Sin turnos registrados.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {cliente.turnos.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <Link
                    href={`/turnos/${t.id}`}
                    className="font-medium text-blue-700 hover:text-blue-800 hover:underline"
                  >
                    {format(t.inicio, "dd/MM/yyyy HH:mm")} · {t.detalles[0]?.nombreSnapshot ?? "Turno"}
                  </Link>
                  <EstadoChip estado={t.estado as EstadoTurno} />
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
