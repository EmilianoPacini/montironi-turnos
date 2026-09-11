import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { canAccessPanelRoute } from "@/lib/auth/guards";
import { listTalleres } from "@/lib/modules/catalog/service";
import { listBahiasTaller } from "@/lib/modules/catalog/bahia.service";
import { saveBahiaAction } from "@/lib/modules/appointments/actions";
import { AdminOnlyBanner } from "@/components/layout/AdminOnlyBanner";
import Link from "next/link";

export default async function BahiasPage() {
  const session = await getAuthSession();
  if (!canAccessPanelRoute(session.rol, "/bahias")) redirect("/agenda");

  const talleres = await listTalleres(session.empresaId);
  const tallerId = talleres[0]?.id;
  const bahias = tallerId ? await listBahiasTaller(tallerId, session.empresaId) : [];

  return (
    <div className="p-6 lg:p-8">
      <AdminOnlyBanner />
      <h1 className="text-2xl font-bold">Bahías por taller</h1>
      <p className="mt-1 text-sm text-slate-600">
        CRUD de bahías y bloqueos vía{" "}
        <Link href="/agenda/bloquear" className="text-indigo-700 underline">
          bloquear bahía
        </Link>
        .
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Orden</th>
              <th className="px-4 py-3">Activa</th>
              <th className="px-4 py-3">Bloqueos activos</th>
            </tr>
          </thead>
          <tbody>
            {bahias.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="px-4 py-3 font-medium">{b.nombre}</td>
                <td className="px-4 py-3">{b.orden}</td>
                <td className="px-4 py-3">{b.activa ? "Sí" : "No"}</td>
                <td className="px-4 py-3">{b.ocupaciones.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tallerId ? (
        <form action={saveBahiaAction} className="mt-8 max-w-lg space-y-3 rounded-xl border bg-slate-50 p-5">
          <h2 className="font-semibold">Agregar bahía</h2>
          <input type="hidden" name="tallerId" value={tallerId} />
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nombre</span>
            <input name="nombre" required className="w-full rounded-lg border px-3 py-2" />
          </label>
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Crear bahía
          </button>
        </form>
      ) : null}
    </div>
  );
}
