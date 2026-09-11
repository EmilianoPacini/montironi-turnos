import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, DiaSemana, EstadoTurno, TipoOcupacion } from "@prisma/client";
import {
  checkSlotAvailable,
  getAvailabilityForDate,
} from "@/lib/modules/availability/service";
import {
  createTurno,
  crearTurnoPendiente,
  blockBahia,
  cancelTurno,
  confirmTurno,
  expirePendingTurnos,
  resolveBahiaAssignment,
  rescheduleTurno,
  DomainError,
} from "@/lib/modules/appointments/service";
import { addMinutes, setHours, setMinutes, startOfDay } from "date-fns";

const prisma = new PrismaClient();

describe("Disponibilidad y exclusión ocupacion_bahia", () => {
  let empresaId: string;
  let tallerId: string;
  let bahiaId: string;
  let bahia2Id: string;
  let bahia3Id: string;
  let clienteId: string;
  let vehiculoId: string;
  let servicioId: string;
  let slotInicio: Date;

  beforeAll(async () => {
    const empresa = await prisma.empresa.create({
      data: { nombre: "Test Co", slug: `test-${Date.now()}` },
    });
    empresaId = empresa.id;

    const taller = await prisma.taller.create({
      data: { empresaId, nombre: "Test Taller" },
    });
    tallerId = taller.id;

    await prisma.configuracionTurnos.create({
      data: { tallerId, margenMinutos: 15 },
    });

    const bahia = await prisma.bahia.create({
      data: { tallerId, nombre: "B1", orden: 1 },
    });
    bahiaId = bahia.id;

    const bahia2 = await prisma.bahia.create({
      data: { tallerId, nombre: "B2", orden: 2 },
    });
    bahia2Id = bahia2.id;

    const bahia3 = await prisma.bahia.create({
      data: { tallerId, nombre: "B3", orden: 3 },
    });
    bahia3Id = bahia3.id;

    for (const dia of Object.values(DiaSemana)) {
      const patron = await prisma.patronHorario.create({
        data: { tallerId, dia },
      });
      await prisma.franjaHoraria.create({
        data: { patronHorarioId: patron.id, horaInicio: "08:00", horaFin: "20:00" },
      });
    }

    const tipo = await prisma.tipoServicio.create({
      data: { empresaId, nombre: "Test" },
    });
    const servicio = await prisma.servicio.create({
      data: {
        empresaId,
        tipoServicioId: tipo.id,
        nombre: "Servicio test",
        duracionMin: 60,
        precio: 1000,
        modoPrecio: "fijo",
      },
    });
    servicioId = servicio.id;

    await prisma.tallerServicio.create({ data: { tallerId, servicioId } });
    for (const bId of [bahiaId, bahia2Id, bahia3Id]) {
      await prisma.bahiaServicio.create({ data: { bahiaId: bId, servicioId } });
    }

    const cliente = await prisma.cliente.create({
      data: { empresaId, nombre: "Test Cliente" },
    });
    clienteId = cliente.id;

    const vehiculo = await prisma.vehiculo.create({
      data: { empresaId, patente: "TST123" },
    });
    vehiculoId = vehiculo.id;

    const today = new Date();
    const day = today.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : (8 - day) % 7 || 7;
    const monday = addMinutes(startOfDay(today), daysUntilMonday * 24 * 60);
    slotInicio = setMinutes(setHours(monday, 10), 0);
  });

  afterAll(async () => {
    await prisma.ocupacionBahia.deleteMany({
      where: { bahia: { taller: { empresaId } } },
    });
    await prisma.turno.deleteMany({ where: { empresaId } });
    await prisma.empresa.delete({ where: { id: empresaId } });
    await prisma.$disconnect();
  });

  it("detecta slot libre antes de reservar", async () => {
    const fin = addMinutes(slotInicio, 75);
    const available = await checkSlotAvailable(bahiaId, slotInicio, fin);
    expect(available).toBe(true);
  });

  it("impide doble reserva en la misma bahía", async () => {
    await createTurno({
      empresaId,
      tallerId,
      bahiaId,
      clienteId,
      vehiculoId,
      servicioIds: [servicioId],
      inicio: slotInicio,
      confirmar: true,
    });

    const overlapStart = addMinutes(slotInicio, 30);
    await expect(
      createTurno({
        empresaId,
        tallerId,
        bahiaId,
        clienteId,
        vehiculoId,
        servicioIds: [servicioId],
        inicio: overlapStart,
        confirmar: true,
      })
    ).rejects.toMatchObject({ code: "CapacidadConflicto" });
  });

  it("CrearTurnoPendiente inserta ocupacion_bahia activa tipo turno", async () => {
    const inicio = addMinutes(slotInicio, 90);
    const turno = await crearTurnoPendiente({
      empresaId,
      tallerId,
      bahiaId: bahia2Id,
      clienteId,
      vehiculoId,
      servicioIds: [servicioId],
      inicio,
    });

    expect(turno.estado).toBe(EstadoTurno.pendiente);

    const occ = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true, tipo: TipoOcupacion.turno },
    });
    expect(occ).toBeTruthy();
    expect(occ?.inicio.getTime()).toBe(inicio.getTime());
  });

  it("auto-asigna bahía cuando hay exactamente una compatible disponible", async () => {
    const slot = addMinutes(slotInicio, 180);
    const fin = addMinutes(slot, 75);

    await blockBahia({
      empresaId,
      bahiaId,
      inicio: slot,
      fin,
      motivo: "Bloqueo test B1",
    });
    await blockBahia({
      empresaId,
      bahiaId: bahia2Id,
      inicio: slot,
      fin,
      motivo: "Bloqueo test B2",
    });

    const result = await resolveBahiaAssignment({
      tallerId,
      servicioIds: [servicioId],
      inicio: slot,
      fin,
    });
    expect(result.autoAssigned).toBe(true);
    expect(result.bahiaId).toBe(bahia3Id);
  });

  it("exige selección explícita con varias bahías disponibles", async () => {
    const slot = addMinutes(slotInicio, 300);
    const fin = addMinutes(slot, 75);
    await expect(
      resolveBahiaAssignment({
        tallerId,
        servicioIds: [servicioId],
        inicio: slot,
        fin,
      })
    ).rejects.toMatchObject({ code: "BahiaIncompatible" });
  });

  it("vence pendientes y libera ocupación", async () => {
    const past = addMinutes(new Date(), -120);
    const turno = await createTurno({
      empresaId,
      tallerId,
      bahiaId: bahia2Id,
      clienteId,
      vehiculoId,
      servicioIds: [servicioId],
      inicio: past,
    });

    expect(turno.estado).toBe(EstadoTurno.pendiente);

    const count = await expirePendingTurnos(empresaId);
    expect(count).toBeGreaterThanOrEqual(1);

    const updated = await prisma.turno.findUnique({ where: { id: turno.id } });
    expect(updated?.estado).toBe(EstadoTurno.vencido);

    const occ = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true },
    });
    expect(occ).toBeNull();
  });

  it("cancelar libera ocupación activa", async () => {
    const inicio = addMinutes(slotInicio, 180);
    const turno = await createTurno({
      empresaId,
      tallerId,
      bahiaId: bahia3Id,
      clienteId,
      vehiculoId,
      servicioIds: [servicioId],
      inicio,
      confirmar: true,
    });

    await cancelTurno({ turnoId: turno.id, empresaId, version: turno.version });

    const occ = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true },
    });
    expect(occ).toBeNull();
  });

  it("confirmar mantiene ocupación activa", async () => {
    const inicio = addMinutes(slotInicio, 270);
    const turno = await createTurno({
      empresaId,
      tallerId,
      bahiaId: bahia3Id,
      clienteId,
      vehiculoId,
      servicioIds: [servicioId],
      inicio,
    });

    await confirmTurno({ turnoId: turno.id, empresaId, version: turno.version });

    const occ = await prisma.ocupacionBahia.findFirst({
      where: { turnoId: turno.id, activo: true, tipo: TipoOcupacion.turno },
    });
    expect(occ).toBeTruthy();
  });

  it("no aplica ausente automáticamente — solo manual", async () => {
    const past = addMinutes(new Date(), -60);
    const turno = await createTurno({
      empresaId,
      tallerId,
      bahiaId: bahia2Id,
      clienteId,
      vehiculoId,
      servicioIds: [servicioId],
      inicio: past,
      confirmar: true,
    });

    await expirePendingTurnos(empresaId);

    const afterExpire = await prisma.turno.findUnique({ where: { id: turno.id } });
    expect(afterExpire?.estado).toBe(EstadoTurno.confirmado);

    const { transitionTurnoState } = await import("@/lib/modules/appointments/service");
    await transitionTurnoState({
      turnoId: turno.id,
      empresaId,
      nuevoEstado: EstadoTurno.ausente,
      version: turno.version,
    });

    const manual = await prisma.turno.findUnique({ where: { id: turno.id } });
    expect(manual?.estado).toBe(EstadoTurno.ausente);
  });

  it("impide bloqueo superpuesto", async () => {
    const blockStart = addMinutes(slotInicio, 420);
    await blockBahia({
      empresaId,
      bahiaId,
      inicio: blockStart,
      fin: addMinutes(blockStart, 60),
      motivo: "Bloqueo inicial",
    });

    await expect(
      blockBahia({
        empresaId,
        bahiaId,
        inicio: addMinutes(blockStart, 30),
        fin: addMinutes(blockStart, 90),
        motivo: "Bloqueo superpuesto",
      })
    ).rejects.toMatchObject({ code: "CapacidadConflicto" });
  });

  it("exige motivo en bloqueos de bahía", async () => {
    const blockStart = addMinutes(slotInicio, 480);
    await expect(
      blockBahia({
        empresaId,
        bahiaId,
        inicio: blockStart,
        fin: addMinutes(blockStart, 60),
        motivo: "   ",
      })
    ).rejects.toMatchObject({ code: "BloqueoInvalido" });
  });

  it("calcula disponibilidad excluyendo ocupaciones", async () => {
    const availability = await getAvailabilityForDate({
      empresaId,
      tallerId,
      date: slotInicio,
      servicioIds: [servicioId],
      bahiaId,
    });

    expect(availability.length).toBe(1);
    const hasConflictSlot = availability[0].slots.some(
      (s) => s.inicio.getTime() === slotInicio.getTime()
    );
    expect(hasConflictSlot).toBe(false);
  });

  it("reprogramación con conflicto mantiene ocupación anterior", async () => {
    const originalStart = addMinutes(slotInicio, 420);
    const turno = await createTurno({
      empresaId,
      tallerId,
      bahiaId: bahia3Id,
      clienteId,
      vehiculoId,
      servicioIds: [servicioId],
      inicio: originalStart,
      confirmar: true,
    });

    const conflictStart = addMinutes(slotInicio, 510);
    await blockBahia({
      empresaId,
      bahiaId: bahia3Id,
      inicio: conflictStart,
      fin: addMinutes(conflictStart, 75),
      motivo: "Bloqueo para reprogramación",
    });

    await expect(
      rescheduleTurno({
        turnoId: turno.id,
        empresaId,
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
