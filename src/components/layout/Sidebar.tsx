import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { logoutAction } from "@/lib/modules/auth/actions";

const adminLinks = [
  { href: "/agenda", label: "Agenda" },
  { href: "/clientes", label: "Clientes" },
  { href: "/servicios", label: "Servicios" },
  { href: "/configuracion", label: "Configuración" },
];

const empleadoLinks = [
  { href: "/agenda", label: "Agenda" },
  { href: "/clientes", label: "Clientes" },
];

export function Sidebar({
  rol,
  nombre,
  currentPath,
}: {
  rol: RolUsuario;
  nombre: string;
  currentPath: string;
}) {
  const links = rol === RolUsuario.ADMIN ? adminLinks : empleadoLinks;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Montironi
        </p>
        <h1 className="text-lg font-bold text-slate-900">Turnos postventa</h1>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {links.map((link) => {
          const active = currentPath.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-900">{nombre}</p>
        <p className="text-xs text-slate-500">
          {rol === RolUsuario.ADMIN ? "Administrador" : "Empleado"}
        </p>
        <form action={logoutAction} className="mt-3">
          <button
            type="submit"
            className="text-sm text-slate-600 underline hover:text-slate-900"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
