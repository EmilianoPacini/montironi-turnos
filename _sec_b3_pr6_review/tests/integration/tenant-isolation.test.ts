import { NextRequest } from "next/server";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as agentsPost } from "@/app/api/agents/route";
import { upsertCliente } from "@/lib/modules/customers/service";
import { createTurno } from "@/lib/modules/appointments/service";
import {
  createServicio,
  updateConfiguracionTaller,
} from "@/lib/modules/catalog/service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  slotAt,
  type TestFixture,
} from "../helpers/fixture";

describe("B3 · Aislamiento multi-tenant (IDOR)", () => {
  let empresaA: TestFixture;
  let empresaB: TestFixture;
  const apiKey = process.env.AGENT_API_KEY ?? "montironi-agent-api-key-dev";

  beforeAll(async () => {
    const suffix = Date.now().toString();
    empresaA = await createTestFixture(`tenant-a-${suffix}`);
    empresaB = await createTestFixture(`tenant-b-${suffix}`);
  });

  afterAll(async () => {
    await destroyTestFixture(empresaA.empresaId);
    await destroyTestFixture(empresaB.empresaId);
    await prisma.$disconnect();
  });

  it("upsertCliente — empresa B no puede actualizar cliente de A", async () => {
    const original = await prisma.cliente.findUniqueOrThrow({
      where: { id: empresaA.clienteId },
    });

    await expect(
      upsertCliente({
        empresaId: empresaB.empresaId,
        id: empresaA.clienteId,
        nombre: "Hackeado",
        apellido: "CrossTenant",
        telefono: "+5491111111111",
      })
    ).rejects.toMatchObject({ code: "RecursoNoEncontrado" });

    const unchanged = await prisma.cliente.findUniqueOrThrow({
      where: { id: empresaA.clienteId },
    });
    expect(unchanged.nombre).toBe(original.nombre);
    expect(unchanged.apellido).toBe(original.apellido);
  });

  it("POST /api/agents upsert_cliente — empresa B no puede actualizar cliente de A", async () => {
    const original = await prisma.cliente.findUniqueOrThrow({
      where: { id: empresaA.clienteId },
    });

    const request = new NextRequest("http://localhost/api/agents", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "x-empresa": empresaB.empresaSlug,
      },
      body: JSON.stringify({
        action: "upsert_cliente",
        id: empresaA.clienteId,
        nombre: "Hackeado API",
        apellido: "CrossTenant",
        telefono: "+5491122222222",
      }),
    });

    const response = await agentsPost(request);
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe("RecursoNoEncontrado");

    const unchanged = await prisma.cliente.findUniqueOrThrow({
      where: { id: empresaA.clienteId },
    });
    expect(unchanged.nombre).toBe(original.nombre);
  });

  it("createTurno — empresa B no puede referenciar taller/cliente/vehículo de A", async () => {
    const inicio = slotAt(empresaB.slotInicio, 60);

    await expect(
      createTurno({
        empresaId: empresaB.empresaId,
        tallerId: empresaA.tallerId,
        bahiaId: empresaA.bahiaId,
        clienteId: empresaA.clienteId,
        vehiculoId: empresaA.vehiculoId,
        servicioIds: [empresaB.servicioId],
        inicio,
      })
    ).rejects.toMatchObject({ code: "RecursoNoEncontrado" });

    const turnosA = await prisma.turno.count({
      where: { empresaId: empresaA.empresaId },
    });
    const turnosB = await prisma.turno.count({
      where: { empresaId: empresaB.empresaId },
    });
    expect(turnosA).toBe(0);
    expect(turnosB).toBe(0);
  });

  it("updateConfiguracionTaller — empresa B no puede modificar taller de A", async () => {
    const configBefore = await prisma.configuracionTurnos.findUniqueOrThrow({
      where: { tallerId: empresaA.tallerId },
    });

    await expect(
      updateConfiguracionTaller({
        tallerId: empresaA.tallerId,
        empresaId: empresaB.empresaId,
        margenMinutos: 99,
      })
    ).rejects.toMatchObject({ code: "RecursoNoEncontrado" });

    const configAfter = await prisma.configuracionTurnos.findUniqueOrThrow({
      where: { tallerId: empresaA.tallerId },
    });
    expect(configAfter.margenMinutos).toBe(configBefore.margenMinutos);
  });

  it("createServicio — empresa B no puede usar tipoServicio de A", async () => {
    await expect(
      createServicio({
        empresaId: empresaB.empresaId,
        tipoServicioId: empresaA.tipoServicioId,
        nombre: "Servicio cross-tenant",
        duracionMin: 30,
        precio: 500,
      })
    ).rejects.toMatchObject({ code: "RecursoNoEncontrado" });

    const crossRef = await prisma.servicio.findFirst({
      where: {
        empresaId: empresaB.empresaId,
        tipoServicioId: empresaA.tipoServicioId,
      },
    });
    expect(crossRef).toBeNull();
  });
});
