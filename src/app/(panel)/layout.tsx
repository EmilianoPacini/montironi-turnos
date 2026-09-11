import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { assertPanelAccess } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/session";
import { PanelShell } from "@/components/layout/PanelShell";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  const pathname = (await headers()).get("x-pathname") ?? "";

  try {
    assertPanelAccess({ rol: session.rol, pathname });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      redirect("/agenda");
    }
    throw e;
  }

  return (
    <PanelShell rol={session.rol} nombre={session.nombre}>
      {children}
    </PanelShell>
  );
}
