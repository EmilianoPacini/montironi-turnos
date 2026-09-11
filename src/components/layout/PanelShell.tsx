"use client";

import { usePathname } from "next/navigation";
import { RolUsuario } from "@prisma/client";
import { Sidebar } from "@/components/layout/Sidebar";

export function PanelShell({
  rol,
  nombre,
  children,
}: {
  rol: RolUsuario;
  nombre: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar rol={rol} nombre={nombre} currentPath={pathname} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
