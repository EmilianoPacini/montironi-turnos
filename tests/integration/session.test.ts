import { NextRequest } from "next/server";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { RolUsuario } from "@prisma/client";
import { subMinutes } from "date-fns";
import { GET as getClienteContext } from "@/app/api/v1/clientes/context/route";
import { POST as vencerPendientesJob } from "@/app/api/v1/jobs/vencer-pendientes/route";
import { validateServerSession } from "@/lib/auth/session/validate-session.use-case";
import { revokeServerSession } from "@/lib/auth/session/revoke-session.use-case";
import { SESSION_IDLE_TIMEOUT_MS } from "@/lib/auth/session/constants";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";
import {
  bindSessionCookie,
  clearSessionCookie,
  createTestServerSession,
  createTestUsuario,
  seedAuthenticatedCookie,
} from "../helpers/session";

function protectedApiRequest() {
  return new NextRequest("http://localhost/api/v1/clientes/context?telefono=+5491100000000");
}

describe("Server-side sessions (B1+B2)", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET ?? "test-session-secret-at-least-32-chars-long";
    fx = await createTestFixture(`session-${Date.now()}`);
  });

  afterAll(async () => {
    clearSessionCookie();
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  beforeEach(() => {
    clearSessionCookie();
  });

  it("deactivate mid-session → 401 on protected API", async () => {
    const usuario = await createTestUsuario(fx.empresaId, `deact-${Date.now()}`);
    const sessionId = await seedAuthenticatedCookie(usuario.id, fx.empresaId);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { activo: false },
    });

    await expect(validateServerSession(sessionId)).rejects.toThrow("UNAUTHORIZED");

    const response = await getClienteContext(protectedApiRequest());
    expect(response.status).toBe(401);
  });

  it("demote admin→empleado → 403 on admin API (rol from DB)", async () => {
    const admin = await createTestUsuario(
      fx.empresaId,
      `demote-${Date.now()}`,
      RolUsuario.admin
    );
    await seedAuthenticatedCookie(admin.id, fx.empresaId);

    await prisma.usuario.update({
      where: { id: admin.id },
      data: { rol: RolUsuario.empleado },
    });

    const response = await vencerPendientesJob(
      new NextRequest("http://localhost/api/v1/jobs/vencer-pendientes", { method: "POST" })
    );
    expect(response.status).toBe(403);
  });

  it("logout replay → 401 after revoke", async () => {
    const usuario = await createTestUsuario(fx.empresaId, `logout-${Date.now()}`);
    const { sessionId } = await createTestServerSession(usuario.id, fx.empresaId);
    await bindSessionCookie(sessionId);

    await revokeServerSession(sessionId);

    await expect(validateServerSession(sessionId)).rejects.toThrow("UNAUTHORIZED");

    const response = await getClienteContext(protectedApiRequest());
    expect(response.status).toBe(401);
  });

  it("idle timeout → 401", async () => {
    const usuario = await createTestUsuario(fx.empresaId, `idle-${Date.now()}`);
    const { sessionId } = await createTestServerSession(usuario.id, fx.empresaId);

    const idleCutoff = subMinutes(
      new Date(),
      Math.ceil(SESSION_IDLE_TIMEOUT_MS / 60_000) + 1
    );
    await prisma.sesion.update({
      where: { id: sessionId },
      data: { lastSeenAt: idleCutoff },
    });

    await bindSessionCookie(sessionId);

    await expect(validateServerSession(sessionId)).rejects.toThrow("UNAUTHORIZED");

    const response = await getClienteContext(protectedApiRequest());
    expect(response.status).toBe(401);

    const row = await prisma.sesion.findUnique({ where: { id: sessionId } });
    expect(row?.revokedAt).not.toBeNull();
  });

  it("absolute TTL → 401", async () => {
    const usuario = await createTestUsuario(fx.empresaId, `ttl-${Date.now()}`);
    const { sessionId } = await createTestServerSession(usuario.id, fx.empresaId);

    await prisma.sesion.update({
      where: { id: sessionId },
      data: { expiresAt: subMinutes(new Date(), 1) },
    });

    await bindSessionCookie(sessionId);

    await expect(validateServerSession(sessionId)).rejects.toThrow("UNAUTHORIZED");

    const response = await getClienteContext(protectedApiRequest());
    expect(response.status).toBe(401);
  });

  it("login anti-fixation: always new sessionId, prior session revoked", async () => {
    const usuario = await createTestUsuario(fx.empresaId, `fixation-${Date.now()}`);

    const first = await createTestServerSession(usuario.id, fx.empresaId);
    await bindSessionCookie(first.sessionId);

    const priorSessionId = first.sessionId;
    await revokeServerSession(priorSessionId);
    clearSessionCookie();

    const second = await createTestServerSession(usuario.id, fx.empresaId);
    await bindSessionCookie(second.sessionId);

    expect(second.sessionId).not.toBe(priorSessionId);

    const priorRow = await prisma.sesion.findUnique({ where: { id: priorSessionId } });
    expect(priorRow?.revokedAt).not.toBeNull();

    const session = await validateServerSession(second.sessionId);
    expect(session.userId).toBe(usuario.id);
  });

  it("tenancy mismatch (stale sesion.empresaId) → 401 and revoke", async () => {
    const usuario = await createTestUsuario(fx.empresaId, `tenancy-${Date.now()}`);
    const { sessionId } = await createTestServerSession(usuario.id, fx.empresaId);

    const otherEmpresa = await prisma.empresa.create({
      data: { nombre: "Other Co", slug: `other-${Date.now()}` },
    });

    await prisma.sesion.update({
      where: { id: sessionId },
      data: { empresaId: otherEmpresa.id },
    });

    await expect(validateServerSession(sessionId)).rejects.toThrow("UNAUTHORIZED");

    const row = await prisma.sesion.findUnique({ where: { id: sessionId } });
    expect(row?.revokedAt).not.toBeNull();

    await prisma.sesion.deleteMany({ where: { empresaId: otherEmpresa.id } });
    await prisma.empresa.delete({ where: { id: otherEmpresa.id } });
  });

  it("resolved empresaId comes from usuario, not stale sesion row", async () => {
    const usuario = await createTestUsuario(fx.empresaId, `empresa-src-${Date.now()}`);
    const { sessionId } = await createTestServerSession(usuario.id, fx.empresaId);

    const session = await validateServerSession(sessionId);
    expect(session.empresaId).toBe(usuario.empresaId);
    expect(session.empresaId).toBe(fx.empresaId);
  });

  it("AGENT_API_KEY flow remains independent of cookie session", async () => {
    const apiKey = process.env.AGENT_API_KEY ?? "montironi-agent-api-key-dev";
    process.env.AGENT_API_KEY = apiKey;

    const response = await vencerPendientesJob(
      new NextRequest("http://localhost/api/v1/jobs/vencer-pendientes", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "x-empresa": fx.empresaSlug,
        },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ vencidos: expect.any(Number) });
  });
});
