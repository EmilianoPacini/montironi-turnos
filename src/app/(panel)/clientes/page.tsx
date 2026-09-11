import Link from "next/link";
import { getAuthSession } from "@/lib/auth/session";
import { listClientes } from "@/lib/modules/customers/service";
import { ClienteSearchForm } from "@/components/clientes/ClienteSearchForm";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim() : undefined;

  const clientes = await listClientes(session.empresaId, search);

  return (
    <div className="panel-page">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="panel-title">Clientes</h1>
        <Link href="/clientes/nuevo" className="btn-primary">
          + Nuevo cliente
        </Link>
      </div>

      <ClienteSearchForm search={search} />

      <div className="panel-card">
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Documento</th>
              <th>Email</th>
              <th>Vehículos</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  {search ? "Sin resultados para la búsqueda" : "No hay clientes registrados"}
                </td>
              </tr>
            ) : (
              clientes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/clientes/${c.id}`}
                      className="font-medium text-blue-700 hover:text-blue-800 hover:underline"
                    >
                      {c.nombre} {c.apellido ?? ""}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{c.telefono ?? "—"}</td>
                  <td className="px-4 py-3">{c.documento ?? "—"}</td>
                  <td className="px-4 py-3">{c.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.vehiculos.map((v) => v.vehiculo.patente).join(", ") || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
