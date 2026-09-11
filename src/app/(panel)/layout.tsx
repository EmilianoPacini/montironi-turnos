import { getAuthSession } from "@/lib/auth/session";
import { PanelShell } from "@/components/layout/PanelShell";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  return (
    <PanelShell rol={session.rol} nombre={session.nombre}>
      {children}
    </PanelShell>
  );
}
