import { redirect } from "next/navigation";
import { format } from "date-fns";
import { getAuthSession } from "@/lib/auth/session";
import { canAccessPanelRoute } from "@/lib/auth/guards";
import { listMovimientosForDisplay } from "@/lib/modules/audit/movimiento.service";
import { AdminOnlyBanner } from "@/components/layout/AdminOnlyBanner";

export default async function MovimientosPage() {
  const session = await getAuthSession();
  if (!canAccessPanelRoute(session.rol, "/movimientos")) redirect("/agenda");

  const movimientos = await listMovimientosForDisplay(session.empresaId, 100);

  return (
    <div className="panel-page">
      <AdminOnlyBanner />
      <h1 className="panel-title">Movimientos</h1>
      <p className="panel-subtitle">Registro append-only de mutaciones clave.</p>

      <div className="panel-card mt-6">
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-slate-600">
                  {format(m.createdAt, "dd/MM/yyyy HH:mm")}
                </td>
                <td className="font-medium text-slate-900">{m.descripcion}</td>
                <td className="text-slate-600">{m.usuario?.nombre ?? "—"}</td>
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
