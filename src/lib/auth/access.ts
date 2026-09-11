import { RolUsuario } from "@prisma/client";
import { sessionOptions } from "@/lib/auth/session/cookie";

/** Cookie checked at Edge (presence only — no DB lookup). */
export const SESSION_COOKIE_NAME = sessionOptions.cookieName;

/** Roles allowed in panel V1. Unknown roles (operador, asesor) are denied. */
export const KNOWN_PANEL_ROLES: readonly RolUsuario[] = [
  RolUsuario.admin,
  RolUsuario.empleado,
];

/** Admin-only panel prefixes (catalog, config, users, bays CRUD, movements). */
export const ADMIN_ONLY_PATH_PREFIXES = [
  "/servicios",
  "/configuracion",
  "/usuarios",
  "/bahias",
  "/movimientos",
] as const;

/** Empleado panel prefixes (agenda, clients, appointments, WAH inbox, bay blocks). */
export const EMPLEADO_PANEL_PATH_PREFIXES = [
  "/agenda",
  "/clientes",
  "/turnos",
  "/comunicaciones",
] as const;

const STATIC_PATH_PREFIXES = ["/_next", "/favicon.ico"] as const;
const STATIC_FILE_EXTENSIONS = /\.(svg|png|jpg|jpeg|gif|webp|ico)$/i;

export function isKnownPanelRole(rol: RolUsuario): boolean {
  return (KNOWN_PANEL_ROLES as readonly RolUsuario[]).includes(rol);
}

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isEmpleadoPanelPath(pathname: string): boolean {
  return EMPLEADO_PANEL_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isPanelPath(pathname: string): boolean {
  return isAdminOnlyPath(pathname) || isEmpleadoPanelPath(pathname);
}

export function isStaticAssetPath(pathname: string): boolean {
  if (STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  return STATIC_FILE_EXTENSIONS.test(pathname);
}

/**
 * Paths that bypass the Edge session cookie gate.
 * Everything else is fail-closed: cookie required.
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login") return true;
  if (pathname.startsWith("/api/wah/integration")) return true;
  if (pathname.startsWith("/api/webhooks")) return true;
  if (pathname === "/api/agents" || pathname.startsWith("/api/agents/")) return true;
  if (pathname.startsWith("/api/v1/jobs")) return true;
  return false;
}

/** True when Edge middleware must see the session cookie (presence only). */
export function requiresSessionCookie(pathname: string): boolean {
  if (isStaticAssetPath(pathname)) return false;
  if (isPublicPath(pathname)) return false;
  return true;
}

export function canAccessPanelRoute(rol: RolUsuario, pathname: string): boolean {
  if (!isKnownPanelRole(rol)) return false;
  if (isAdminOnlyPath(pathname)) return rol === RolUsuario.admin;
  return true;
}

export function assertAdminRole(rol: RolUsuario): void {
  assertPanelAccess({ rol, roles: [RolUsuario.admin] });
}

export type AssertPanelAccessInput = {
  rol: RolUsuario;
  /** Panel pathname for route-matrix check (Node layer). */
  pathname?: string;
  /** Explicit role allow-list (e.g. admin-only API/action). */
  roles?: RolUsuario[];
};

/**
 * Fail-closed panel/API authorization (Node layer).
 * - No session → caller maps to UNAUTHORIZED before this runs.
 * - Unknown role → FORBIDDEN.
 * - Insufficient role or route → FORBIDDEN.
 */
export function assertPanelAccess(input: AssertPanelAccessInput): void {
  const { rol, pathname, roles } = input;

  if (!isKnownPanelRole(rol)) {
    throw new Error("FORBIDDEN");
  }

  if (roles && !roles.includes(rol)) {
    throw new Error("FORBIDDEN");
  }

  if (pathname && !canAccessPanelRoute(rol, pathname)) {
    throw new Error("FORBIDDEN");
  }
}
