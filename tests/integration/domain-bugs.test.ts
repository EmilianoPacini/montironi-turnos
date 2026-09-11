import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EstadoTurno, TipoOcupacion } from "@prisma/client";
import { addMinutes } from "date-fns";
import {
  crearTurnoPendiente,
  confirmTurno,
  cancelTurno,
  transitionTurnoState,
} from "@/lib/modules/appointments/service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  slotAt,
  type TestFixture,
} from "../helpers/fixture";

describe("QA P0 · Bugs dominio ALTA", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await createTestFixture(`bugs-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  it("Bug 1 — confirmar pendiente con inicio pasado → vencido, no confirmado", async () => {
    const past = addMinutes(new Date(), -90);
    const turno = await crearTurnoPendiente({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahiaId,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio: past,
    });

    await expect(
      confirmTurno({
        turnoId: turno.id,
        empresaId: fx.empresaId,
        version: turno.version,
      })
    ).rejects.toMatchObject({ code: "TransicionInvalida" });

    const updated = await prisma.turno.findUnique({ where: { id: turno.id } });
    expect(updated?.estado).toBe(EstadoTurno.vencido);
    expect(updated?.estado).not.toBe(EstadoTurno.confirmado);

    const active = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true },
    });
    expect(active).toBeNull();
  });

  it("Bug 2 — cancelar desde en_servicio → cancelado + libera ocupación", async () => {
    const inicio = slotAt(fx.slotInicio, 420);
    let turno = await crearTurnoPendiente({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia2Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
    });

    turno = await confirmTurno({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      version: turno.version,
    });

    turno = await transitionTurnoState({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      nuevoEstado: EstadoTurno.recibido,
      version: turno.version,
    });

    turno = await transitionTurnoState({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      nuevoEstado: EstadoTurno.en_servicio,
      version: turno.version,
    });

    const occBefore = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true, tipo: TipoOcupacion.turno },
    });
    expect(occBefore).toBeTruthy();

    await cancelTurno({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      version: turno.version,
      motivo: "Cancelación excepcional en servicio",
    });

    const updated = await prisma.turno.findUnique({ where: { id: turno.id } });
    expect(updated?.estado).toBe(EstadoTurno.cancelado);

    const active = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true },
    });
    expect(active).toBeNull();
  });

  it("Bug 3 — finalizado libera ocupacion_bahia", async () => {
    const inicio = slotAt(fx.slotInicio, 510);
    let turno = await crearTurnoPendiente({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia3Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
    });

    turno = await confirmTurno({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      version: turno.version,
    });

    turno = await transitionTurnoState({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      nuevoEstado: EstadoTurno.recibido,
      version: turno.version,
    });

    turno = await transitionTurnoState({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      nuevoEstado: EstadoTurno.en_servicio,
      version: turno.version,
    });

    await transitionTurnoState({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      nuevoEstado: EstadoTurno.finalizado,
      version: turno.version,
    });

    const updated = await prisma.turno.findUnique({ where: { id: turno.id } });
    expect(updated?.estado).toBe(EstadoTurno.finalizado);

    const active = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true },
    });
    expect(active).toBeNull();
  });
});
