import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EstadoTurno } from "@prisma/client";
import { addMinutes } from "date-fns";
import {
  VALID_TRANSITIONS,
  canTransition,
} from "@/lib/modules/appointments/constants";
import {
  createTurno,
  expirePendingTurnos,
  transitionTurnoState,
} from "@/lib/modules/appointments/service";
import {
  createTestFixture,
  destroyTestFixture,
  prisma,
  type TestFixture,
} from "../helpers/fixture";

describe("QA-6 · FSM turno — solo auto pendiente→vencido", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await createTestFixture(`fsm-${Date.now()}`);
  });

  afterAll(async () => {
    await destroyTestFixture(fx.empresaId);
    await prisma.$disconnect();
  });

  it("vencido no es transicion manual desde ningun estado activo", () => {
    for (const from of Object.keys(VALID_TRANSITIONS) as EstadoTurno[]) {
      expect(canTransition(from, EstadoTurno.vencido)).toBe(false);
    }
  });

  it("expirePendingTurnos aplica solo pendiente→vencido", async () => {
    const pastPending = addMinutes(new Date(), -120);
    const pastConfirmed = addMinutes(new Date(), -60);

    const pendiente = await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahiaId,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio: pastPending,
    });

    const confirmado = await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia2Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio: pastConfirmed,
      confirmar: true,
    });

    await expirePendingTurnos(fx.empresaId);

    const p = await prisma.turno.findUnique({ where: { id: pendiente.id } });
    const c = await prisma.turno.findUnique({ where: { id: confirmado.id } });

    expect(p?.estado).toBe(EstadoTurno.vencido);
    expect(c?.estado).toBe(EstadoTurno.confirmado);
  });

  it("no hay auto-ausente — confirmado pasado sigue confirmado", async () => {
    const past = addMinutes(new Date(), -30);
    const turno = await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahia3Id,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio: past,
      confirmar: true,
    });

    await expirePendingTurnos(fx.empresaId);

    const after = await prisma.turno.findUnique({ where: { id: turno.id } });
    expect(after?.estado).toBe(EstadoTurno.confirmado);
  });

  it("ausente solo via transicion manual", async () => {
    const inicio = addMinutes(fx.slotInicio, 330);
    const turno = await createTurno({
      empresaId: fx.empresaId,
      tallerId: fx.tallerId,
      bahiaId: fx.bahiaId,
      clienteId: fx.clienteId,
      vehiculoId: fx.vehiculoId,
      servicioIds: [fx.servicioId],
      inicio,
      confirmar: true,
    });

    await transitionTurnoState({
      turnoId: turno.id,
      empresaId: fx.empresaId,
      nuevoEstado: EstadoTurno.ausente,
      version: turno.version,
    });

    const updated = await prisma.turno.findUnique({ where: { id: turno.id } });
    expect(updated?.estado).toBe(EstadoTurno.ausente);
  });
});
