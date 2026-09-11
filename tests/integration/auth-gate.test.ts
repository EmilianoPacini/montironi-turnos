import { NextRequest } from "next/server";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { RolUsuario } from "@prisma/client";
import { GET as agentsGet } from "@/app/api/agents/route";
import { GET as getClienteContext } from "@/app/api/v1/clientes/context/route";
import { POST as createBahiaPost } from "@/app/api/v1/talleres/[tallerId]/bahias/route";
import { POST as sendTextPost } from "@/app/api/wah/integration/send-text/route";
import { middleware } from "@/middleware";
import { SESSION_COOKIE_NAME } from "@/lib/auth/access";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";
import {
  clearSessionCookie,
  createTestUsuario,
  seedAuthenticatedCookie,
} from "../helpers/session";

const FORWARD_SECRET = "auth-gate-forward-secret";

describe("B5 · central authz gate (integration)", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET ?? "test-session-secret-at-least-32-chars-long";
    process.env.CIMA_FORWARD_SECRET = FORWARD_SECRET;
    process.env.AGENT_API_KEY = process.env.AGENT_API_KEY ?? "montironi-agent-api-key-dev";
    fx = await createTestFixture(`auth-gate-${Date.now()}`);
  });

  afterAll(async () => {
    clearSessionCookie();
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  beforeEach(() => {
    clearSessionCookie();
  });

  it("1 · Edge: no cookie → /agenda redirect /login", () => {
    const request = new NextRequest("http://localhost/agenda");
    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("2 · Edge: no cookie → /api/v1/... → 401", async () => {
    const edge = middleware(new NextRequest("http://localhost/api/v1/clientes/context"));
    expect(edge.status).toBe(401);

    const handler = await getClienteContext(
      new NextRequest("http://localhost/api/v1/clientes/context?telefono=+5491100000000")
    );
    expect(handler.status).toBe(401);
  });

  it("3 · Node: empleado session → admin POST bahía → 403", async () => {
    const empleado = await createTestUsuario(fx.empresaId, `emp-${Date.now()}`);
    await seedAuthenticatedCookie(empleado.id, fx.empresaId);

    const response = await createBahiaPost(
      new NextRequest(`http://localhost/api/v1/talleres/${fx.tallerId}/bahias`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: "QA Bahía" }),
      }),
      { params: Promise.resolve({ tallerId: fx.tallerId }) }
    );

    expect(response.status).toBe(403);
  });

  it("4 · Node: admin session → admin POST bahía → 201", async () => {
    const admin = await createTestUsuario(
      fx.empresaId,
      `adm-${Date.now()}`,
      RolUsuario.admin
    );
    await seedAuthenticatedCookie(admin.id, fx.empresaId);

    const response = await createBahiaPost(
      new NextRequest(`http://localhost/api/v1/talleres/${fx.tallerId}/bahias`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: `Admin Bahía ${Date.now()}` }),
      }),
      { params: Promise.resolve({ tallerId: fx.tallerId }) }
    );

    expect(response.status).toBe(201);
  });

  it("5 · /api/agents without cookie + valid API key still works", async () => {
    clearSessionCookie();
    const response = await agentsGet(
      new NextRequest("http://localhost/api/agents?resource=servicios", {
        headers: {
          "x-api-key": process.env.AGENT_API_KEY!,
          "x-empresa": fx.empresaSlug,
        },
      })
    );
    expect(response.status).toBe(200);
  });

  it("6 · /api/wah/integration without cookie uses forward secret (not 401 from Edge)", async () => {
    clearSessionCookie();
    const edge = middleware(
      new NextRequest("http://localhost/api/wah/integration/send-text")
    );
    expect(edge.status).toBe(200);

    const badSecret = await sendTextPost(
      new NextRequest("http://localhost/api/wah/integration/send-text", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(badSecret.status).toBe(401);

    const withSecret = await sendTextPost(
      new NextRequest("http://localhost/api/wah/integration/send-text", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cima-forward-secret": FORWARD_SECRET,
        },
        body: JSON.stringify({
          empresa_id: fx.empresaId,
          account_id: "missing-account",
          to: "+5491100000001",
          text: "hola",
        }),
      })
    );
    expect(withSecret.status).not.toBe(401);
  });

  it("7 · fail-closed: new panel path blocked at Edge without session cookie", () => {
    const response = middleware(new NextRequest("http://localhost/reportes-nuevo"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("Edge pass + cookie name constant matches iron-session", () => {
    expect(SESSION_COOKIE_NAME).toBe("montironi_session");
  });
});
