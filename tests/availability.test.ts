import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, DiaSemana, EstadoTurno } from "@prisma/client";
import {
  checkSlotAvailable,
  getAvailabilityForDate,
} from "@/lib/modules/availability/service";
import {
  createTurno,
  blockBahia,
  expirePendingTurnos,
  resolveBahiaAssignment,
  AppointmentError,
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

    const patron = await prisma.patronHorario.create({
      data: { tallerId, dia: DiaSemana.lunes },
    });
    await prisma.franjaHoraria.create({
      data: { patronHorarioId: patron.id, horaInicio: "08:00", horaFin: "18:00" },
    });

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
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppointmentError &&
        (err.code === "CONFLICT" || err.code === "SLOT_UNAVAILABLE")
      );
    });
  });

  it("auto-asigna bahía cuando hay exactamente una compatible disponible", async () => {
    const slot = addMinutes(slotInicio, 180);
    const fin = addMinutes(slot, 75);

    await blockBahia({
      empresaId,
      bahiaId,
      inicio: slot,
      fin,
    });
    await blockBahia({
      empresaId,
      bahiaId: bahia2Id,
      inicio: slot,
      fin,
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
    ).rejects.toMatchObject({ code: "BAY_REQUIRED" });
  });

  it("vence pendientes automáticamente al pasar hora de inicio", async () => {
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
    });

    await expect(
      blockBahia({
        empresaId,
        bahiaId,
        inicio: addMinutes(blockStart, 30),
        fin: addMinutes(blockStart, 90),
      })
    ).rejects.toBeInstanceOf(AppointmentError);
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
});
