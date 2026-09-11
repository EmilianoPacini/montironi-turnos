import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { addMinutes } from "date-fns";
import { TipoOcupacion } from "@prisma/client";
import { createTurno, blockBahia } from "@/lib/modules/appointments/service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  slotAt,
  type TestFixture,
} from "../helpers/fixture";

describe("QA-5 · Bloqueos bahía — mismo EXCLUDE GiST", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await createTestFixture(`block-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  it("bloqueo tipo=bloqueo compite con turno via exclusion", async () => {
    const inicio = slotAt(fx.slotInicio, 60);
    await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahiaId,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
      confirmar: true,
    });

    await expect(
      blockBahia({
        empresaId: fx.empresaId,
        bahiaId: fx.bahiaId,
        inicio: addMinutes(inicio, 30),
        fin: addMinutes(inicio, 90),
        motivo: "Superpone turno existente",
      })
    ).rejects.toMatchObject({ code: "CapacidadConflicto" });
  });

  it("dos bloqueos superpuestos — segundo CapacidadConflicto", async () => {
    const blockStart = slotAt(fx.slotInicio, 180);
    await blockBahia({
      empresaId: fx.empresaId,
      bahiaId: fx.bahia2Id,
      inicio: blockStart,
      fin: addMinutes(blockStart, 60),
      motivo: "Primer bloqueo",
    });

    await expect(
      blockBahia({
        empresaId: fx.empresaId,
        bahiaId: fx.bahia2Id,
        inicio: addMinutes(blockStart, 30),
        fin: addMinutes(blockStart, 90),
        motivo: "Segundo bloqueo superpuesto",
      })
    ).rejects.toMatchObject({ code: "CapacidadConflicto" });
  });

  it("bloqueo persiste sin turno_id", async () => {
    const blockStart = slotAt(fx.slotInicio, 300);
    const block = await blockBahia({
      empresaId: fx.empresaId,
      bahiaId: fx.bahia3Id,
      inicio: blockStart,
      fin: addMinutes(blockStart, 45),
      motivo: "Mantenimiento",
    });

    expect(block.tipo).toBe(TipoOcupacion.bloqueo);
    expect(block.turnoId).toBeNull();
    expect(block.motivo).toBe("Mantenimiento");
  });

  it("motivo vacío es BloqueoInvalido", async () => {
    const blockStart = slotAt(fx.slotInicio, 390);
    await expect(
      blockBahia({
        empresaId: fx.empresaId,
        bahiaId: fx.bahia3Id,
        inicio: blockStart,
        fin: addMinutes(blockStart, 30),
        motivo: "  ",
      })
    ).rejects.toMatchObject({ code: "BloqueoInvalido" });
  });
});
