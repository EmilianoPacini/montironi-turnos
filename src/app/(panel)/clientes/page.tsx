import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { listClientes } from "@/lib/modules/customers/service";

export default async function ClientesPage() {
  const session = await getAuthSession();
  

  const clientes = await listClientes(session.empresaId);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
        <Link
          href="/clientes/nuevo"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          + Nuevo cliente
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Vehículos</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/clientes/${c.id}`} className="font-medium text-slate-900 hover:underline">
                    {c.nombre} {c.apellido ?? ""}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.telefono ?? "—"}</td>
                <td className="px-4 py-3">{c.email ?? "—"}</td>
                <td className="px-4 py-3">
                  {c.vehiculos.map((v) => v.vehiculo.patente).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
