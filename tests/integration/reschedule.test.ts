import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { addMinutes } from "date-fns";
import {
  createTurno,
  blockBahia,
  rescheduleTurno,
} from "@/lib/modules/appointments/service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  slotAt,
  type TestFixture,
} from "../helpers/fixture";

describe("QA-4 · Reprogramación atómica", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await createTestFixture(`sched-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  it("swap exitoso desactiva ocupacion anterior e inserta nueva", async () => {
    const originalStart = slotAt(fx.slotInicio, 120);
    const newStart = slotAt(fx.slotInicio, 240);

    const turno = await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahiaId,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio: originalStart,
      confirmar: true,
    });

    const updated = await rescheduleTurno({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      inicio: newStart,
      version: turno.version,
    });

    expect(updated.inicio.getTime()).toBe(newStart.getTime());

    const inactive = await prisma.ocupacionBahia.findMany({
      where: { turnoId: turno.id, activo: false },
    });
    const active = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true },
    });

    expect(inactive.length).toBeGreaterThanOrEqual(1);
    expect(active?.inicio.getTime()).toBe(newStart.getTime());
  });

  it("conflicto mantiene ocupacion y horario anteriores", async () => {
    const originalStart = slotAt(fx.slotInicio, 360);
    const turno = await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia2Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio: originalStart,
      confirmar: true,
    });

    const conflictStart = slotAt(fx.slotInicio, 450);
    await blockBahia({
      empresaId: fx.empresaId,
      bahiaId: fx.bahia2Id,
      inicio: conflictStart,
      fin: addMinutes(conflictStart, 75),
      motivo: "Bloqueo conflicto reprogramación",
    });

    await expect(
      rescheduleTurno({
        turnoId: turno.id,
        empresaId: fx.empresaId,
        inicio: conflictStart,
        version: turno.version,
      })
    ).rejects.toMatchObject({ code: "CapacidadConflicto" });

    const unchanged = await prisma.turno.findUnique({ where: { id: turno.id } });
    expect(unchanged?.inicio.getTime()).toBe(originalStart.getTime());
    expect(unchanged?.version).toBe(turno.version);

    const activeOcc = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true },
    });
    expect(activeOcc?.inicio.getTime()).toBe(originalStart.getTime());
  });
});
