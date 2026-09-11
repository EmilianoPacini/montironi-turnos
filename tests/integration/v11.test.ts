import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EstadoTurno } from "@prisma/client";
import { addMinutes } from "date-fns";
import {
  crearTurnoPendiente,
  cancelTurno,
  transitionTurnoState,
  assertNotPastInicio,
  PAST_SLOT_MESSAGE,
} from "@/lib/modules/appointments/service";
import { DomainError } from "@/lib/modules/appointments/errors";
import { registrarMovimiento } from "@/lib/modules/audit/movimiento.service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  slotAt,
  type TestFixture,
} from "../helpers/fixture";

describe("V1.1 · integration", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await createTestFixture(`v11-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  it("crear turno en horario pasado vía API guard → HorarioVencido", () => {
    const past = new Date(Date.now() - 30_000);
    expect(() => assertNotPastInicio(past)).toThrow(DomainError);
  });

  it("cancelar libera ocupación + registra movimiento", async () => {
    const inicio = slotAt(fx.slotInicio, 60);
    const turno = await crearTurnoPendiente({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia2Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
    });

    await cancelTurno({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      version: turno.version,
    });

    const active = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true },
    });
    expect(active).toBeNull();

    const mov = await prisma.movimiento.findFirst({
      where: { entidadId: turno.id, accion: "cancelar" },
    });
    expect(mov).toBeTruthy();
  });

  it("finalizado libera ocupación", async () => {
    const inicio = slotAt(fx.slotInicio, 150);
    let turno = await crearTurnoPendiente({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia3Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
      kilometraje: 50000,
    });

    turno = await transitionTurnoState({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      nuevoEstado: EstadoTurno.confirmado,
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

    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: fx.vehiculoId } });
    expect(vehiculo?.kilometrajeActual).toBe(50000);

    const active = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true },
    });
    expect(active).toBeNull();
  });

  it("registrarMovimiento persiste audit", async () => {
    const m = await registrarMovimiento({
      empresaId: fx.empresaId,
      entidad: "test",
      entidadId: fx.clienteId,
      accion: "test_accion",
      detalle: { ok: true },
    });
    expect(m.id).toBeTruthy();
  });
});
