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
    <div className="panel-page">
      <AdminOnlyBanner />
      <h1 className="panel-title">Bahías por taller</h1>
      <p className="panel-subtitle">
        CRUD de bahías y bloqueos vía{" "}
        <Link href="/agenda/bloquear" className="text-blue-700 underline hover:text-blue-800">
          bloquear bahía
        </Link>
        .
      </p>

      <div className="panel-card mt-6">
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Orden</th>
              <th>Activa</th>
              <th>Bloqueos activos</th>
            </tr>
          </thead>
          <tbody>
            {bahias.map((b) => (
              <tr key={b.id}>
                <td className="font-medium">{b.nombre}</td>
                <td>{b.orden}</td>
                <td>{b.activa ? "Sí" : "No"}</td>
                <td>{b.ocupaciones.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tallerId ? (
        <form action={saveBahiaAction} className="mt-8 max-w-lg space-y-3 rounded-xl border border-slate-200 bg-sky-50/50 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Agregar bahía</h2>
          <input type="hidden" name="tallerId" value={tallerId} />
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nombre</span>
            <input name="nombre" required className="input-field" />
          </label>
          <button type="submit" className="btn-primary">
            Crear bahía
          </button>
        </form>
      ) : null}
    </div>
  );
}
