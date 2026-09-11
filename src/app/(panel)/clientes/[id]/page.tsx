import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { getAuthSession } from "@/lib/auth/session";
import { getCliente } from "@/lib/modules/customers/service";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();

  const { id } = await params;
  const cliente = await getCliente(id, session.empresaId);
  if (!cliente) notFound();

  return (
    <div className="p-6 lg:p-8">
      <Link href="/clientes" className="text-sm text-slate-600 hover:text-slate-900">
        ← Clientes
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">
          {cliente.nombre} {cliente.apellido ?? ""}
        </h1>
        <Link
          href={`/clientes/${cliente.id}/editar`}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
        >
          Editar
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Contacto</h2>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-slate-500">Teléfono</dt><dd>{cliente.telefono ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Email</dt><dd>{cliente.email ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Documento</dt><dd>{cliente.documento ?? "—"}</dd></div>
          </dl>
        </section>

        <section className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Vehículos</h2>
          <ul className="space-y-2 text-sm">
            {cliente.vehiculos.map((cv) => (
              <li key={cv.id} className="rounded-lg bg-slate-50 px-3 py-2">
                {cv.vehiculo.patente} · {cv.vehiculo.marca} {cv.vehiculo.modelo}
              </li>
            ))}
          </ul>
          <Link
            href={`/clientes/${cliente.id}/vehiculo/nuevo`}
            className="mt-3 inline-block text-sm text-indigo-700 hover:underline"
          >
            + Agregar vehículo
          </Link>
        </section>

        <section className="rounded-xl border bg-white p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Turnos recientes</h2>
          <ul className="space-y-2 text-sm">
            {cliente.turnos.map((t) => (
              <li key={t.id}>
                <Link href={`/turnos/${t.id}`} className="text-indigo-700 hover:underline">
                  {format(t.inicio, "dd/MM/yyyy HH:mm")} · {t.estado} · {t.detalles[0]?.nombreSnapshot}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
