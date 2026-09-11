import { NextRequest } from "next/server";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as agentsPost } from "@/app/api/agents/route";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";

describe("POST /api/agents · upsert_cliente", () => {
  let fx: TestFixture;
  const apiKey = process.env.AGENT_API_KEY ?? "montironi-agent-api-key-dev";

  beforeAll(async () => {
    fx = await createTestFixture(`agents-cliente-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  it("teléfono inválido (351555) → 422 ValidacionCliente, no 500", async () => {
    const request = new NextRequest("http://localhost/api/agents", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "x-empresa": fx.empresaSlug,
      },
      body: JSON.stringify({
        action: "upsert_cliente",
        nombre: "QA",
        apellido: "InvalidPhone",
        telefono: "351555",
      }),
    });

    const response = await agentsPost(request);
    const body = (await response.json()) as { error: string; code?: string };

    expect(response.status).toBe(422);
    expect(body.code).toBe("ValidacionCliente");
    expect(body.error).toMatch(/E\.164/i);
    expect(body.error).not.toBe("Error interno");
  });
});
