import { redirect } from "next/navigation";
import { format } from "date-fns";
import { getAuthSession } from "@/lib/auth/session";
import { canAccessPanelRoute } from "@/lib/auth/guards";
import { listMovimientos } from "@/lib/modules/audit/movimiento.service";
import { AdminOnlyBanner } from "@/components/layout/AdminOnlyBanner";

export default async function MovimientosPage() {
  const session = await getAuthSession();
  if (!canAccessPanelRoute(session.rol, "/movimientos")) redirect("/agenda");

  const movimientos = await listMovimientos(session.empresaId, 100);

  return (
    <div className="p-6 lg:p-8">
      <AdminOnlyBanner />
      <h1 className="text-2xl font-bold">Movimientos (auditoría)</h1>
      <p className="mt-1 text-sm text-slate-600">Registro append-only de mutaciones clave.</p>

      <div className="mt-6 overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Entidad</th>
              <th className="px-4 py-3">Acción</th>
              <th className="px-4 py-3">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-3 whitespace-nowrap">
                  {format(m.createdAt, "dd/MM/yyyy HH:mm")}
                </td>
                <td className="px-4 py-3">
                  {m.entidad} · {m.entidadId.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 font-medium">{m.accion}</td>
                <td className="px-4 py-3">{m.usuario?.nombre ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {movimientos.length === 0 ? (
          <p className="p-6 text-center text-slate-500">Sin movimientos registrados aún.</p>
        ) : null}
      </div>
    </div>
  );
}
