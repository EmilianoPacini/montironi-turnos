import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

describe("B3 · QA extra IDOR (casos 4 y 7)", () => {
  let empresaA: TestFixture;
  let empresaB: TestFixture;

  beforeAll(async () => {
    const suffix = `qa-${Date.now()}`;
    empresaA = await createTestFixture(`qa-a-${suffix}`);
    empresaB = await createTestFixture(`qa-b-${suffix}`);
  });

  afterAll(async () => {
    await destroyTestFixture(empresaA.empresaId);
    await destroyTestFixture(empresaB.empresaId);
    await prisma.$disconnect();
  });

  it("createTurno — empresa B + taller B + cliente/vehículo A → rechazo sin insert", async () => {
    const inicio = slotAt(empresaB.slotInicio, 90);

    await expect(
      createTurno({
        empresaId: empresaB.empresaId,
        tallerId: empresaB.tallerId,
        bahiaId: empresaB.bahiaId,
        clienteId: empresaA.clienteId,
        vehiculoId: empresaA.vehiculoId,
        servicioIds: [empresaB.servicioId],
        inicio,
      })
    ).rejects.toMatchObject({ code: "RecursoNoEncontrado" });

    expect(await prisma.turno.count({ where: { empresaId: empresaB.empresaId } })).toBe(0);
    expect(await prisma.turno.count({ where: { empresaId: empresaA.empresaId } })).toBe(0);
  });

  it("happy path mismo tenant — upsert/update config/create servicio/create turno OK", async () => {
    const updated = await upsertCliente({
      empresaId: empresaB.empresaId,
      id: empresaB.clienteId,
      nombre: "TenantB",
      apellido: "Ok",
      telefono: "+5491133333333",
    });
    expect(updated.nombre).toBe("TenantB");

    const cfg = await updateConfiguracionTaller({
      tallerId: empresaB.tallerId,
      empresaId: empresaB.empresaId,
      margenMinutos: 20,
    });
    expect(cfg.margenMinutos).toBe(20);

    const servicio = await createServicio({
      empresaId: empresaB.empresaId,
      tipoServicioId: empresaB.tipoServicioId,
      nombre: "Servicio same-tenant",
      duracionMin: 30,
      precio: 500,
    });
    expect(servicio.empresaId).toBe(empresaB.empresaId);

    const turno = await createTurno({
      empresaId: empresaB.empresaId,
      tallerId: empresaB.tallerId,
      bahiaId: empresaB.bahiaId,
      clienteId: empresaB.clienteId,
      vehiculoId: empresaB.vehiculoId,
      servicioIds: [empresaB.servicioId],
      inicio: slotAt(empresaB.slotInicio, 120),
    });
    expect(turno.empresaId).toBe(empresaB.empresaId);
  });
});
