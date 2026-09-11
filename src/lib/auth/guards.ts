import { RolUsuario } from "@prisma/client";

/** Routes restricted to admin in V1 (empleado: Agenda + Clientes only in nav). */
export const ADMIN_ONLY_PATH_PREFIXES = ["/servicios", "/configuracion", "/usuarios", "/bahias", "/movimientos"] as const;

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function canAccessPanelRoute(rol: RolUsuario, pathname: string): boolean {
  if (isAdminOnlyPath(pathname)) {
    return rol === RolUsuario.admin;
  }
  return true;
}

export function assertAdminRole(rol: RolUsuario): void {
  if (rol !== RolUsuario.admin) {
    throw new Error("FORBIDDEN");
  }
}
