import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { canAccessPanelRoute } from "@/lib/auth/guards";
import { AdminOnlyBanner } from "@/components/layout/AdminOnlyBanner";
import { ProximamentePlaceholder } from "@/components/layout/ProximamentePlaceholder";

export default async function ConfigPage() {
  const session = await getAuthSession();

  if (!canAccessPanelRoute(session.rol, "/configuracion")) redirect("/agenda");

  return (
    <div className="p-6 lg:p-8">
      <AdminOnlyBanner />
      <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
      <p className="mt-1 text-sm text-slate-600">
        Margen entre turnos, talleres, bahías y horarios.
      </p>
      <div className="mt-6">
        <ProximamentePlaceholder
          title="Configuración"
          description="La edición de configuración del taller estará disponible en una próxima versión."
        />
      </div>
    </div>
  );
}
