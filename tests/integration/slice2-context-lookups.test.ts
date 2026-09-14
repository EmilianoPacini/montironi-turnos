import { NextRequest } from "next/server";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET as agentsContextGet } from "@/app/api/agents/context/route";
import { POST as agentsPost } from "@/app/api/agents/route";
import { getClienteContext } from "@/lib/modules/customers/service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";

describe("SOLID slice2 · context lookups + upserts", () => {
  let fx: TestFixture;
  let other: TestFixture;
  const apiKey = "slice2-agent-key";

  beforeAll(async () => {
    process.env.AGENT_API_KEY = apiKey;
    const s = `s2-${Date.now()}`;
    fx = await createTestFixture(`s2a-${s}`);
    other = await createTestFixture(`s2b-${s}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await destroyTestFixture(other.empresaId);
    await prisma.$disconnect();
  });

  async function context(query: string) {
    return agentsContextGet(
      new NextRequest(`http://localhost/api/agents/context?${query}`, {
        headers: { "x-api-key": apiKey, "x-empresa": fx.empresaSlug },
      })
    );
  }

  it("GET context por cliente_id", async () => {
    const res = await context(`cliente_id=${fx.clienteId}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cliente.id).toBe(fx.clienteId);
    expect(json.buyer_profile === null || json.buyer_profile === undefined || typeof json.buyer_profile === "object").toBe(true);
    expect(Array.isArray(json.historial_services) || json.historial_services === null).toBe(true);
  });

  it("GET context por telefono E.164", async () => {
    const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: fx.clienteId } });
    const res = await context(`telefono=${encodeURIComponent(cliente.telefono)}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cliente.id).toBe(fx.clienteId);
  });

  it("GET context por wa_id (digits / JID)", async () => {
    const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: fx.clienteId } });
    const digits = cliente.telefono.replace(/\D/g, "");
    const res = await context(`wa_id=${digits}`);
    expect(res.status).toBe(200);
    expect((await res.json()).cliente.id).toBe(fx.clienteId);

    const jid = await context(`wa_id=${encodeURIComponent(`${digits}@s.whatsapp.net`)}`);
    expect(jid.status).toBe(200);
    expect((await jid.json()).cliente.id).toBe(fx.clienteId);
  });

  it("tenancy: context empresa B no ve cliente A", async () => {
    const raw = await getClienteContext({ empresaId: other.empresaId, id: fx.clienteId });
    expect(raw).toBeNull();

    const res = await agentsContextGet(
      new NextRequest(`http://localhost/api/agents/context?cliente_id=${fx.clienteId}`, {
        headers: { "x-api-key": apiKey, "x-empresa": other.empresaSlug },
      })
    );
    expect(res.status).toBe(404);
  });

  it("upsert_vehiculo mismo tenant OK", async () => {
    const res = await agentsPost(
      new NextRequest("http://localhost/api/agents", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "x-empresa": fx.empresaSlug,
        },
        body: JSON.stringify({
          action: "upsert_vehiculo",
          patente: `S2${Date.now().toString().slice(-4)}`,
          clienteId: fx.clienteId,
          marca: "Ford",
        }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.vehiculo.empresaId).toBe(fx.empresaId);
  });
});
