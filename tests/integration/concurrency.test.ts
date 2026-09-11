import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTurno,
  crearTurnoPendiente,
  confirmTurno,
  rescheduleTurno,
} from "@/lib/modules/appointments/service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  slotAt,
  type TestFixture,
} from "../helpers/fixture";

describe("QA-3 · Carreras concurrentes", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await createTestFixture(`race-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  it("dos create simultáneos en mismo slot — uno gana, otro CapacidadConflicto", async () => {
    const inicio = slotAt(fx.slotInicio, 420);
    const base = {
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahiaId,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
      confirmar: true,
    };

    const results = await Promise.allSettled([
      createTurno(base),
      createTurno(base),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const fail = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    expect(fail[0].reason.code).toBe("CapacidadConflicto");

    const active = await prisma.ocupacionBahia.count({
      where: { bahiaId: fx.bahiaId, activo: true, inicio },
    });
    expect(active).toBe(1);
  });

  it("dos confirm simultáneos — uno confirma, otro VersionConflicto", async () => {
    const inicio = slotAt(fx.slotInicio, 510);
    const turno = await crearTurnoPendiente({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia2Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
    });

    const results = await Promise.allSettled([
      confirmTurno({
        turnoId: turno.id,
        empresaId: fx.empresaId,
        version: turno.version,
      }),
      confirmTurno({
        turnoId: turno.id,
        empresaId: fx.empresaId,
        version: turno.version,
      }),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const fail = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    expect(fail[0].reason.code).toBe("VersionConflicto");
  });

  it("reschedule concurrente — uno gana swap, otro VersionConflicto o CapacidadConflicto", async () => {
    const originalStart = slotAt(fx.slotInicio, 420);
    const targetStart = slotAt(fx.slotInicio, 480);

    const turno = await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia3Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio: originalStart,
      confirmar: true,
    });

    const attempt = () =>
      rescheduleTurno({
        turnoId: turno.id,
        empresaId: fx.empresaId,
        inicio: targetStart,
        version: turno.version,
      });

    const results = await Promise.allSettled([attempt(), attempt()]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const fail = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(ok.length + fail.length).toBe(2);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    if (fail.length > 0) {
      expect(["VersionConflicto", "CapacidadConflicto"]).toContain(fail[0].reason.code);
    }
  });
});
