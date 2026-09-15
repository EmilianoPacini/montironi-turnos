import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";
import { GET as agentsGet } from "@/app/api/agents/route";
import {
  getServicioForAgents,
  listServiciosForAgents,
} from "@/lib/modules/catalog/servicio-agents";

const apiKey = process.env.AGENT_API_KEY ?? "montironi-agent-api-key-dev";

describe("Agents API · servicios catálogo", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await createTestFixture(`servicio-agents-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  it("GET resource=servicios devuelve precio, duración y modo_precio", async () => {
    const res = await agentsGet(
      new NextRequest("http://localhost/api/agents?resource=servicios", {
        headers: { "x-api-key": apiKey, "x-empresa": fx.empresaSlug },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.servicios)).toBe(true);
    expect(body.servicios.length).toBeGreaterThan(0);

    const s = body.servicios.find((row: { id: string }) => row.id === fx.servicioId);
    expect(s).toBeTruthy();
    expect(s).toMatchObject({
      id: fx.servicioId,
      nombre: expect.any(String),
      tipo: expect.any(String),
      duracion_minutos: expect.any(Number),
      precio: expect.any(Number),
      moneda: "ARS",
      modo_precio: expect.stringMatching(/^(fijo|desde|a_presupuestar)$/),
    });
  });

  it("GET resource=servicio&id= devuelve detalle o 404", async () => {
    const ok = await agentsGet(
      new NextRequest(
        `http://localhost/api/agents?resource=servicio&id=${fx.servicioId}`,
        { headers: { "x-api-key": apiKey, "x-empresa": fx.empresaSlug } }
      )
    );
    expect(ok.status).toBe(200);
    const okBody = await ok.json();
    expect(okBody.servicio.id).toBe(fx.servicioId);

    const missing = await agentsGet(
      new NextRequest(
        "http://localhost/api/agents?resource=servicio&id=00000000-0000-4000-8000-000000000099",
        { headers: { "x-api-key": apiKey, "x-empresa": fx.empresaSlug } }
      )
    );
    expect(missing.status).toBe(404);
  });

  it("listServiciosForAgents y getServicioForAgents respetan tenancy", async () => {
    const list = await listServiciosForAgents(fx.empresaId);
    expect(list.some((s) => s.id === fx.servicioId)).toBe(true);

    const detail = await getServicioForAgents({
      empresaId: fx.empresaId,
      id: fx.servicioId,
    });
    expect(detail?.nombre).toBeTruthy();

    const foreign = await getServicioForAgents({
      empresaId: "00000000-0000-4000-8000-000000000099",
      id: fx.servicioId,
    });
    expect(foreign).toBeNull();
  });
});
