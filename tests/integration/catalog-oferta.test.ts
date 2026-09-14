import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createServicio,
  serviciosForTaller,
} from "@/lib/modules/catalog/service";
import { createBahia } from "@/lib/modules/catalog/bahia.service";
import { getCompatibleBahias } from "@/lib/modules/availability/service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";

describe("Catálogo · oferta en taller y bahía", () => {
  let fixture: TestFixture;

  beforeAll(async () => {
    fixture = await createTestFixture(`oferta-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fixture.empresaId);
    await prisma.$disconnect();
  });

  it("createServicio queda disponible al crear un turno en el taller", async () => {
    const servicio = await createServicio({
      empresaId: fixture.empresaId,
      tipoServicioId: fixture.tipoServicioId,
      nombre: "Servicio recién creado",
      duracionMin: 45,
      precio: 2000,
    });

    const paraTurno = await serviciosForTaller(fixture.tallerId, fixture.empresaId);
    expect(paraTurno.some((row) => row.id === servicio.id)).toBe(true);

    const bahias = await getCompatibleBahias(fixture.tallerId, [servicio.id]);
    expect(bahias.map((bahia) => bahia.id)).toEqual(
      expect.arrayContaining([fixture.bahiaId, fixture.bahia2Id, fixture.bahia3Id])
    );

    const tallerLink = await prisma.tallerServicio.findFirst({
      where: { tallerId: fixture.tallerId, servicioId: servicio.id, activo: true },
    });
    expect(tallerLink).not.toBeNull();
  });

  it("servicios creados sin oferta previa aparecen al consultar el taller", async () => {
    const huerfano = await prisma.servicio.create({
      data: {
        empresaId: fixture.empresaId,
        tipoServicioId: fixture.tipoServicioId,
        nombre: "Huérfano sin taller_servicio",
        duracionMin: 30,
        precio: 500,
      },
    });

    const paraTurno = await serviciosForTaller(fixture.tallerId, fixture.empresaId);
    expect(paraTurno.some((row) => row.id === huerfano.id)).toBe(true);
  });

  it("createBahia hereda los servicios activos de la empresa", async () => {
    const bahia = await createBahia({
      tallerId: fixture.tallerId,
      empresaId: fixture.empresaId,
      nombre: "Bahía nueva",
    });

    const links = await prisma.bahiaServicio.count({
      where: { bahiaId: bahia.id, activo: true },
    });
    const servicios = await prisma.servicio.count({
      where: { empresaId: fixture.empresaId, activo: true },
    });
    expect(links).toBe(servicios);
  });
});
