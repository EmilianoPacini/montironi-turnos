"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RolUsuario } from "@prisma/client";
import { logoutAction } from "@/lib/modules/auth/actions";

const STORAGE_KEY = "cima-ai-sidebar-collapsed";

type NavLink = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function IconAgenda() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconClientes() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconServicios() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconBahias() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function IconMovimientos() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function IconComunicaciones() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function IconConfig() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );
}

function IconUsuarios() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function IconCollapse({ collapsed }: { collapsed: boolean }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      {collapsed ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
      )}
    </svg>
  );
}

const sharedLinks: NavLink[] = [
  { href: "/agenda", label: "Agenda", icon: <IconAgenda /> },
  { href: "/clientes", label: "Clientes", icon: <IconClientes /> },
  { href: "/comunicaciones", label: "Comunicaciones", icon: <IconComunicaciones /> },
];

const adminLinks: NavLink[] = [
  ...sharedLinks,
  { href: "/servicios", label: "Servicios", icon: <IconServicios /> },
  { href: "/bahias", label: "Bahías", icon: <IconBahias /> },
  { href: "/movimientos", label: "Movimientos", icon: <IconMovimientos /> },
  { href: "/configuracion", label: "Configuración", icon: <IconConfig /> },
  { href: "/usuarios", label: "Usuarios", icon: <IconUsuarios /> },
];

const empleadoLinks: NavLink[] = sharedLinks;

export function Sidebar({
  rol,
  nombre,
  currentPath,
}: {
  rol: RolUsuario;
  nombre: string;
  currentPath: string;
}) {
  const links = rol === RolUsuario.admin ? adminLinks : empleadoLinks;
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setHydrated(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  const widthClass = collapsed ? "w-[4.5rem]" : "w-64";

  return (
    <aside
      className={`flex ${widthClass} shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm transition-[width] duration-200 ease-in-out`}
      data-collapsed={collapsed && hydrated ? "true" : "false"}
    >
      <div className={`border-b border-slate-200 ${collapsed ? "px-2 py-3" : "px-5 py-4"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between gap-2"}`}>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                Montironi
              </p>
              <h1 className="truncate text-lg font-bold text-blue-700">Cima AI</h1>
            </div>
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white"
              title="Cima AI"
              aria-label="Cima AI"
            >
              CI
            </span>
          )}
          {!collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label="Colapsar menú lateral"
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <IconCollapse collapsed={collapsed} />
            </button>
          ) : null}
        </div>
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label="Expandir menú lateral"
            className="mt-2 flex w-full items-center justify-center rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <IconCollapse collapsed={collapsed} />
          </button>
        ) : null}
      </div>

      <nav className={`flex-1 space-y-1 ${collapsed ? "p-2" : "p-3"}`} aria-label="Navegación principal">
        {links.map((link) => {
          const active = currentPath.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              aria-label={collapsed ? link.label : undefined}
              className={`flex items-center rounded-lg text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2"
              } ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              <span aria-hidden={!collapsed ? true : undefined}>{link.icon}</span>
              {!collapsed ? <span>{link.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-slate-200 ${collapsed ? "p-2" : "p-4"}`}>
        {!collapsed ? (
          <>
            <p className="truncate text-sm font-medium text-slate-900">{nombre}</p>
            <p className="text-xs text-slate-500">
              {rol === RolUsuario.admin ? "Administrador" : "Empleado"}
            </p>
          </>
        ) : null}
        <form action={logoutAction} className={collapsed ? "mt-0" : "mt-3"}>
          <button
            type="submit"
            title={collapsed ? "Cerrar sesión" : undefined}
            aria-label={collapsed ? "Cerrar sesión" : undefined}
            className={`flex items-center text-sm text-slate-600 transition hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              collapsed ? "w-full justify-center rounded-lg p-2 hover:bg-blue-50" : "gap-2 underline"
            }`}
          >
            <IconLogout />
            {!collapsed ? <span>Cerrar sesión</span> : null}
          </button>
        </form>
      </div>
    </aside>
  );
}
