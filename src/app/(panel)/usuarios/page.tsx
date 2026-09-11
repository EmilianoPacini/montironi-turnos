import { getAuthSession } from "@/lib/auth/session";
import { AdminOnlyBanner } from "@/components/layout/AdminOnlyBanner";
import { ProximamentePlaceholder } from "@/components/layout/ProximamentePlaceholder";

export default async function UsuariosPage() {
  await getAuthSession();

  return (
    <div className="p-6 lg:p-8">
      <AdminOnlyBanner />
      <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
      <p className="mt-1 text-sm text-slate-600">
        Alta, edición y asignación de roles del equipo.
      </p>
      <div className="mt-6">
        <ProximamentePlaceholder
          title="Usuarios"
          description="El ABM de usuarios y permisos estará disponible en una próxima versión."
        />
      </div>
    </div>
  );
}
