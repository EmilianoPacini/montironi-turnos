import {
  addMinutes,
  format,
  parse,
  setHours,
  setMinutes,
  startOfDay,
  isBefore,
  isAfter,
} from "date-fns";
import { es } from "date-fns/locale";
import prisma from "@/lib/db";
import { DiaSemana, TipoExcepcion } from "@prisma/client";

const DIA_MAP: Record<number, DiaSemana> = {
  0: DiaSemana.domingo,
  1: DiaSemana.lunes,
  2: DiaSemana.martes,
  3: DiaSemana.miercoles,
  4: DiaSemana.jueves,
  5: DiaSemana.viernes,
  6: DiaSemana.sabado,
};

export function parseTimeOnDate(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  return setMinutes(setHours(startOfDay(date), h), m);
}

export function formatTimeRange(inicio: Date, fin: Date): string {
  return `${format(inicio, "HH:mm")} – ${format(fin, "HH:mm")}`;
}

export function formatDateLong(date: Date): string {
  return format(date, "EEEE d 'de' MMMM yyyy", { locale: es });
}

export async function getMargenMin(tallerId: string): Promise<number> {
  const config = await prisma.configuracionTurnos.findUnique({
    where: { tallerId },
  });
  return config?.margenMin ?? 15;
}

export async function calcularDuracionTotal(params: {
  empresaId: string;
  tallerId: string;
  servicioIds: string[];
}): Promise<{ duracionMin: number; servicios: Awaited<ReturnType<typeof loadServicios>> }> {
  const servicios = await loadServicios(params.empresaId, params.servicioIds);
  const sum = servicios.reduce((acc, s) => acc + s.duracionMin, 0);
  const margen = await getMargenMin(params.tallerId);
  return { duracionMin: sum + margen, servicios };
}

async function loadServicios(empresaId: string, servicioIds: string[]) {
  return prisma.servicio.findMany({
    where: { id: { in: servicioIds }, empresaId, activo: true },
  });
}

export interface TimeSlot {
  inicio: Date;
  fin: Date;
}

export interface BahiaAvailability {
  bahiaId: string;
  bahiaNombre: string;
  slots: TimeSlot[];
}

export async function getCompatibleBahias(tallerId: string, servicioIds: string[]) {
  const bahias = await prisma.bahia.findMany({
    where: { tallerId, activa: true },
    orderBy: { orden: "asc" },
  });

  if (servicioIds.length === 0) return bahias;

  const compatible = [];
  for (const bahia of bahias) {
    const allowed = await prisma.bahiaServicio.count({
      where: {
        bahiaId: bahia.id,
        servicioId: { in: servicioIds },
        activo: true,
      },
    });
    if (allowed >= servicioIds.length) compatible.push(bahia);
  }
  return compatible;
}

export async function getTallerScheduleForDate(
  tallerId: string,
  date: Date
): Promise<TimeSlot[]> {
  const excepcion = await prisma.excepcionHorario.findUnique({
    where: {
      tallerId_fecha: {
        tallerId,
        fecha: startOfDay(date),
      },
    },
  });

  if (excepcion?.tipo === TipoExcepcion.cerrado) {
    return [];
  }

  if (excepcion?.tipo === TipoExcepcion.horario_especial && excepcion.horaInicio && excepcion.horaFin) {
    return [
      {
        inicio: parseTimeOnDate(date, excepcion.horaInicio),
        fin: parseTimeOnDate(date, excepcion.horaFin),
      },
    ];
  }

  const dia = DIA_MAP[date.getDay()];
  const patron = await prisma.patronHorario.findUnique({
    where: { tallerId_dia: { tallerId, dia } },
    include: { franjas: true },
  });

  if (!patron || !patron.activo) return [];

  return patron.franjas.map((f) => ({
    inicio: parseTimeOnDate(date, f.horaInicio),
    fin: parseTimeOnDate(date, f.horaFin),
  }));
}

export async function getOcupacionesForBahia(
  bahiaId: string,
  date: Date
): Promise<TimeSlot[]> {
  const dayStart = startOfDay(date);
  const dayEnd = addMinutes(dayStart, 24 * 60);

  const ocupaciones = await prisma.ocupacionBahia.findMany({
    where: {
      bahiaId,
      activo: true,
      inicio: { lt: dayEnd },
      fin: { gt: dayStart },
    },
    orderBy: { inicio: "asc" },
  });

  return ocupaciones.map((o) => ({ inicio: o.inicio, fin: o.fin }));
}

function subtractOccupiedFromWindows(
  windows: TimeSlot[],
  occupied: TimeSlot[]
): TimeSlot[] {
  let free = [...windows];

  for (const occ of occupied) {
    const next: TimeSlot[] = [];
    for (const win of free) {
      if (!isBefore(occ.fin, win.inicio) && !isAfter(occ.inicio, win.fin)) {
        if (isBefore(win.inicio, occ.inicio)) {
          next.push({ inicio: win.inicio, fin: occ.inicio });
        }
        if (isBefore(occ.fin, win.fin)) {
          next.push({ inicio: occ.fin, fin: win.fin });
        }
      } else {
        next.push(win);
      }
    }
    free = next;
  }

  return free.filter((s) => s.fin > s.inicio);
}

export function slotsFromFreeWindows(
  freeWindows: TimeSlot[],
  durationMin: number,
  stepMin = 15
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  for (const window of freeWindows) {
    let cursor = window.inicio;
    while (addMinutes(cursor, durationMin) <= window.fin) {
      slots.push({
        inicio: cursor,
        fin: addMinutes(cursor, durationMin),
      });
      cursor = addMinutes(cursor, stepMin);
    }
  }

  return slots;
}

export async function checkSlotAvailable(
  bahiaId: string,
  inicio: Date,
  fin: Date,
  excludeTurnoId?: string
): Promise<boolean> {
  const conflict = await prisma.ocupacionBahia.findFirst({
    where: {
      bahiaId,
      activo: true,
      inicio: { lt: fin },
      fin: { gt: inicio },
      ...(excludeTurnoId
        ? { OR: [{ turnoId: null }, { turnoId: { not: excludeTurnoId } }] }
        : {}),
    },
  });
  return !conflict;
}

export async function getAvailabilityForDate(params: {
  empresaId: string;
  tallerId: string;
  date: Date;
  servicioIds: string[];
  bahiaId?: string;
}): Promise<BahiaAvailability[]> {
  const { duracionMin } = await calcularDuracionTotal({
    empresaId: params.empresaId,
    tallerId: params.tallerId,
    servicioIds: params.servicioIds,
  });

  const schedule = await getTallerScheduleForDate(params.tallerId, params.date);
  if (schedule.length === 0) return [];

  const compatibleBahias = await getCompatibleBahias(params.tallerId, params.servicioIds);
  const bahias = params.bahiaId
    ? compatibleBahias.filter((b) => b.id === params.bahiaId)
    : compatibleBahias;

  const results: BahiaAvailability[] = [];

  for (const bahia of bahias) {
    const occupied = await getOcupacionesForBahia(bahia.id, params.date);
    const freeWindows = subtractOccupiedFromWindows(schedule, occupied);
    const slots = slotsFromFreeWindows(freeWindows, duracionMin);

    results.push({
      bahiaId: bahia.id,
      bahiaNombre: bahia.nombre,
      slots,
    });
  }

  return results;
}

export async function getAgendaForDate(params: {
  empresaId: string;
  tallerId: string;
  date: Date;
}) {
  const dayStart = startOfDay(params.date);
  const dayEnd = addMinutes(dayStart, 24 * 60);

  const [bahias, turnos, bloqueos, schedule] = await Promise.all([
    prisma.bahia.findMany({
      where: { tallerId: params.tallerId, activa: true },
      orderBy: { orden: "asc" },
    }),
    prisma.turno.findMany({
      where: {
        empresaId: params.empresaId,
        tallerId: params.tallerId,
        inicio: { gte: dayStart, lt: dayEnd },
      },
      include: {
        cliente: true,
        vehiculo: true,
        bahia: true,
        detalles: true,
        creador: true,
        agenteIa: true,
      },
      orderBy: { inicio: "asc" },
    }),
    prisma.ocupacionBahia.findMany({
      where: {
        tipo: "bloqueo",
        activo: true,
        bahia: { tallerId: params.tallerId },
        inicio: { lt: dayEnd },
        fin: { gt: dayStart },
      },
      include: { bahia: true },
    }),
    getTallerScheduleForDate(params.tallerId, params.date),
  ]);

  return { bahias, turnos, bloqueos, schedule, isClosed: schedule.length === 0 };
}
