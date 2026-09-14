import { RolUsuario } from "@prisma/client";
import { getAuthSession } from "@/lib/auth/session";
import { WahInbox } from "@/components/wah/WahInbox";

export default async function ComunicacionesPage() {
  const session = await getAuthSession();

  return (
    <div className="panel-page flex h-full flex-col">
      <div className="mb-2">
        <h1 className="panel-title">Comunicaciones</h1>
        <p className="panel-subtitle">Bandeja WhatsApp · respuestas humanas e integración bot</p>
      </div>
      <WahInbox canManageAccounts={session.rol === RolUsuario.admin} />
    </div>
  );
}
