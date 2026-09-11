import { describe, it, expect } from "vitest";
import { RolUsuario } from "@prisma/client";
import {
  ADMIN_ONLY_PATH_PREFIXES,
  assertPanelAccess,
  canAccessPanelRoute,
  isPublicPath,
  isKnownPanelRole,
  requiresSessionCookie,
} from "@/lib/auth/access";

describe("access.ts · role matrix V1", () => {
  it("denies unknown roles (operador, asesor)", () => {
    expect(isKnownPanelRole(RolUsuario.operador)).toBe(false);
    expect(isKnownPanelRole(RolUsuario.asesor)).toBe(false);
    expect(canAccessPanelRoute(RolUsuario.operador, "/agenda")).toBe(false);
    expect(canAccessPanelRoute(RolUsuario.asesor, "/servicios")).toBe(false);
    expect(() =>
      assertPanelAccess({ rol: RolUsuario.operador, pathname: "/agenda" })
    ).toThrow("FORBIDDEN");
  });

  it("empleado reaches empleado routes but not admin routes", () => {
    expect(canAccessPanelRoute(RolUsuario.empleado, "/agenda")).toBe(true);
    expect(canAccessPanelRoute(RolUsuario.empleado, "/comunicaciones")).toBe(true);
    for (const path of ADMIN_ONLY_PATH_PREFIXES) {
      expect(canAccessPanelRoute(RolUsuario.empleado, path)).toBe(false);
    }
  });

  it("admin reaches all panel routes", () => {
    expect(canAccessPanelRoute(RolUsuario.admin, "/agenda")).toBe(true);
    for (const path of ADMIN_ONLY_PATH_PREFIXES) {
      expect(canAccessPanelRoute(RolUsuario.admin, path)).toBe(true);
    }
  });

  it("assertPanelAccess with roles allow-list", () => {
    expect(() =>
      assertPanelAccess({ rol: RolUsuario.empleado, roles: [RolUsuario.admin] })
    ).toThrow("FORBIDDEN");
    expect(() =>
      assertPanelAccess({ rol: RolUsuario.admin, roles: [RolUsuario.admin] })
    ).not.toThrow();
  });
});

describe("access.ts · fail-closed path classifier", () => {
  it("public paths skip cookie gate", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/api/agents")).toBe(true);
    expect(isPublicPath("/api/agents/context")).toBe(true);
    expect(isPublicPath("/api/wah/integration/send-text")).toBe(true);
    expect(isPublicPath("/api/webhooks/whatsapp/received-data")).toBe(true);
    expect(isPublicPath("/api/v1/jobs/vencer-pendientes")).toBe(true);
    expect(requiresSessionCookie("/login")).toBe(false);
    expect(requiresSessionCookie("/api/agents")).toBe(false);
    expect(requiresSessionCookie("/api/v1/jobs/run")).toBe(false);
  });

  it("protected paths require cookie (including unlisted new panel paths)", () => {
    expect(requiresSessionCookie("/agenda")).toBe(true);
    expect(requiresSessionCookie("/api/v1/clientes/context")).toBe(true);
    expect(requiresSessionCookie("/api/v1/turnos")).toBe(true);
    expect(requiresSessionCookie("/api/wah/dashboard")).toBe(true);
    expect(requiresSessionCookie("/nuevo-modulo-panel")).toBe(true);
  });

  it("only /api/v1/jobs/* is machine-exempt — other /api/v1/* require cookie at Edge", () => {
    expect(isPublicPath("/api/v1/jobs/vencer-pendientes")).toBe(true);
    expect(isPublicPath("/api/v1/jobs/future-job")).toBe(true);
    expect(isPublicPath("/api/v1/clientes/context")).toBe(false);
    expect(isPublicPath("/api/v1/turnos")).toBe(false);
    expect(requiresSessionCookie("/api/v1/jobs/vencer-pendientes")).toBe(false);
    expect(requiresSessionCookie("/api/v1/turnos")).toBe(true);
  });

  it("static assets skip cookie gate", () => {
    expect(requiresSessionCookie("/_next/static/chunk.js")).toBe(false);
    expect(requiresSessionCookie("/logo.png")).toBe(false);
  });
});
