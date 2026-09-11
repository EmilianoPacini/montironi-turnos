import { describe, it, expect } from "vitest";
import { RolUsuario } from "@prisma/client";
import {
  ADMIN_ONLY_PATH_PREFIXES,
  assertAdminRole,
  canAccessPanelRoute,
  isAdminOnlyPath,
} from "@/lib/auth/guards";

describe("QA-7 · Authz admin vs empleado", () => {
  it("identifica rutas solo admin", () => {
    expect(isAdminOnlyPath("/servicios")).toBe(true);
    expect(isAdminOnlyPath("/configuracion")).toBe(true);
    expect(isAdminOnlyPath("/usuarios")).toBe(true);
    expect(isAdminOnlyPath("/agenda")).toBe(false);
    expect(isAdminOnlyPath("/clientes")).toBe(false);
    expect(isAdminOnlyPath("/turnos/nuevo")).toBe(false);
    expect(ADMIN_ONLY_PATH_PREFIXES).toContain("/servicios");
    expect(ADMIN_ONLY_PATH_PREFIXES).toContain("/usuarios");
  });

  it("admin accede a servicios y configuracion", () => {
    for (const path of ADMIN_ONLY_PATH_PREFIXES) {
      expect(canAccessPanelRoute(RolUsuario.admin, path)).toBe(true);
    }
    expect(canAccessPanelRoute(RolUsuario.admin, "/agenda")).toBe(true);
    expect(canAccessPanelRoute(RolUsuario.admin, "/clientes")).toBe(true);
  });

  it("empleado accede agenda y clientes pero no admin routes", () => {
    expect(canAccessPanelRoute(RolUsuario.empleado, "/agenda")).toBe(true);
    expect(canAccessPanelRoute(RolUsuario.empleado, "/clientes")).toBe(true);
    expect(canAccessPanelRoute(RolUsuario.empleado, "/turnos/nuevo")).toBe(true);
    expect(canAccessPanelRoute(RolUsuario.empleado, "/agenda/bloquear")).toBe(true);

    for (const path of ADMIN_ONLY_PATH_PREFIXES) {
      expect(canAccessPanelRoute(RolUsuario.empleado, path)).toBe(false);
    }
  });

  it("assertAdminRole rechaza empleado", () => {
    expect(() => assertAdminRole(RolUsuario.empleado)).toThrow("FORBIDDEN");
    expect(() => assertAdminRole(RolUsuario.admin)).not.toThrow();
  });
});
