import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EstadoTurno, TipoOcupacion } from "@prisma/client";
import { addMinutes } from "date-fns";
import { getAvailabilityForDate } from "@/lib/modules/availability/service";
import {
  crearTurnoPendiente,
  confirmTurno,
  cancelTurno,
  expirePendingTurnos,
} from "@/lib/modules/appointments/service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  slotAt,
  type TestFixture,
} from "../helpers/fixture";

describe("QA-1/2 · Ocupación como hold de capacidad", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await createTestFixture(`occ-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  it("consultar disponibilidad no escribe ocupacion_bahia", async () => {
    const before = await prisma.ocupacionBahia.count({
      where: { bahia: { tallerId: fx.tallerId } },
    });

    await getAvailabilityForDate({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      date: fx.slotInicio,
      servicioIds: [fx.servicioId],
    });

    const after = await prisma.ocupacionBahia.count({
      where: { bahia: { tallerId: fx.tallerId } },
    });

    expect(after).toBe(before);
  });

  it("crear pendiente inserta ocupacion activa tipo turno", async () => {
    const inicio = slotAt(fx.slotInicio, 60);
    const turno = await crearTurnoPendiente({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahiaId,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
    });

    const occ = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true, tipo: TipoOcupacion.turno },
    });

    expect(turno.estado).toBe(EstadoTurno.pendiente);
    expect(occ?.inicio.getTime()).toBe(inicio.getTime());
  });

  it("confirmar mantiene ocupacion activa tras revalidar", async () => {
    const inicio = slotAt(fx.slotInicio, 150);
    const turno = await crearTurnoPendiente({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia2Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
    });

    const beforeCount = await prisma.ocupacionBahia.count({
      where: { turnoId: turno.id, activo: true, tipo: TipoOcupacion.turno },
    });
    expect(beforeCount).toBe(1);

    await confirmTurno({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      version: turno.version,
    });

    const afterCount = await prisma.ocupacionBahia.count({
      where: { turnoId: turno.id, activo: true, tipo: TipoOcupacion.turno },
    });
    expect(afterCount).toBe(1);

    const occ = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true, tipo: TipoOcupacion.turno },
    });
    expect(occ).toBeTruthy();
  });

  it("cancelar libera ocupacion (activo=false)", async () => {
    const inicio = slotAt(fx.slotInicio, 240);
    const turno = await crearTurnoPendiente({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia3Id,
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
  });

  it("vencido automatico libera ocupacion", async () => {
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

    await expirePendingTurnos(fx.empresaId);

    const updated = await prisma.turno.findUnique({ where: { id: turno.id } });
    expect(updated?.estado).toBe(EstadoTurno.vencido);

    const active = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true },
    });
    expect(active).toBeNull();
  });
});
