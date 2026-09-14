import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  calcularProximoServicioKm,
  listIntervalosKm,
  upsertIntervaloKm,
} from "@/lib/modules/catalog/intervalo.service";
import { listServiciosConIntervalos } from "@/lib/modules/catalog/service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";

describe("Intervalos km por servicio", () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await createTestFixture(`intervalo-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fixture.empresaId);
    await prisma.$disconnect();
  });

  it("crea el intervalo con empresaId y sirve para calcular el próximo service", async () => {
    const created = await upsertIntervaloKm({
      servicioId: fixture.servicioId,
      empresaId: fixture.empresaId,
      tipoVehiculo: "auto",
      condicion: "nuevo",
      intervaloKm: 10000,
    });

    expect(created.empresaId).toBe(fixture.empresaId);
    expect(created.intervaloKm).toBe(10000);

    const proximo = await calcularProximoServicioKm({
      servicioId: fixture.servicioId,
      tipoVehiculo: "auto",
      condicion: "nuevo",
      kilometrajeActual: 50000,
    });
    expect(proximo).toBe(60000);
  });

  it("actualiza el mismo intervalo sin duplicar la fila", async () => {
    await upsertIntervaloKm({
      servicioId: fixture.servicioId,
      empresaId: fixture.empresaId,
      tipoVehiculo: "auto",
      condicion: "nuevo",
      intervaloKm: 12000,
    });

    const rows = await prisma.servicioIntervaloKm.findMany({
      where: {
        servicioId: fixture.servicioId,
        tipoVehiculo: "auto",
        condicion: "nuevo",
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].intervaloKm).toBe(12000);
    expect(rows[0].empresaId).toBe(fixture.empresaId);
  });

  it("lista solo intervalos del tenant", async () => {
    const listed = await listIntervalosKm(fixture.empresaId);
    expect(listed.some((row) => row.servicioId === fixture.servicioId)).toBe(true);
    expect(listed.every((row) => row.servicio.nombre.length > 0)).toBe(true);
  });

  it("el catálogo de panel incluye los intervalos del servicio", async () => {
    const catalogo = await listServiciosConIntervalos(fixture.empresaId);
    const servicio = catalogo.find((row) => row.id === fixture.servicioId);
    expect(servicio).toBeDefined();
    expect(servicio?.intervalosKm.some((row) => row.intervaloKm === 12000)).toBe(true);
  });
});
