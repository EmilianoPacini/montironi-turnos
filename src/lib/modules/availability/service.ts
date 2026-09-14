import {
  addMinutes,
  format,
  setHours,
  setMinutes,
  startOfDay,
  isBefore,
  isAfter,
} from "date-fns";
import { es } from "date-fns/locale";
import { DiaSemana, EstadoCambioHorario, TipoExcepcion } from "@prisma/client";
import prisma from "@/lib/db";
import { DomainError } from "@/lib/modules/appointments/errors";
import {
  SYSTEM_HORIZON_DAYS,
  dateOnlyUtc,
  ymdFromDateOnly,
} from "@/lib/time/business-tz";
import {
  type DiaHorarioSnapshot,
  type FranjaJson,
  canonicalWeeklySnapshot,
  franjasFromLegacy,
  normalizeFranjas,
} from "@/lib/modules/catalog/franjas";

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
  return config?.margenMinutos ?? 15;
}

export async function getAgendaConfig(tallerId: string) {
  const config = await prisma.configuracionTurnos.findUnique({
    where: { tallerId },
  });
  return {
    margenMinutos: config?.margenMinutos ?? 15,
    intervaloInicioMinutos: config?.intervaloInicioMinutos ?? 15,
    anticipacionMinimaHoras: config?.anticipacionMinimaHoras ?? 0,
    anticipacionMaximaDias: config?.anticipacionMaximaDias ?? SYSTEM_HORIZON_DAYS,
    permiteCancelacion: config?.permiteCancelacion ?? true,
    horasLimiteCancelacion: config?.horasLimiteCancelacion ?? 24,
  };
}

export async function calcularDuracionTotal(params: {
  empresaId: string;
  tallerId: string;
  servicioIds: string[];
}): Promise<{
  duracionMin: number;
  duracionServiciosMin: number;
  margenMinutos: number;
  servicios: Awaited<ReturnType<typeof loadServicios>>;
}> {
  const servicios = await loadServicios(params.empresaId, params.servicioIds);
  const duracionServiciosMin = servicios.reduce((acc, s) => acc + s.duracionMin, 0);
  const margenMinutos = await getMargenMin(params.tallerId);
  return {
    duracionMin: duracionServiciosMin + margenMinutos,
    duracionServiciosMin,
    margenMinutos,
    servicios,
  };
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

export interface VentanaDisponible {
  inicio: string;
  fin: string;
}

export function franjasToSlots(date: Date, franjas: FranjaJson[]): TimeSlot[] {
  return franjas.map((f) => ({
    inicio: parseTimeOnDate(date, f.horaInicio),
    fin: parseTimeOnDate(date, f.horaFin),
  }));
}

export function slotFitsSchedule(schedule: TimeSlot[], inicio: Date, fin: Date): boolean {
  return schedule.some((w) => !isBefore(inicio, w.inicio) && !isAfter(fin, w.fin));
}

export async function loadPatronesAsSnapshot(tallerId: string): Promise<DiaHorarioSnapshot[]> {
  const patrones = await prisma.patronHorario.findMany({
    where: { tallerId },
    include: { franjas: true },
  });
  return canonicalWeeklySnapshot(
    patrones.map((p) => ({
      dia: p.dia,
      activo: p.activo,
      franjas: p.franjas.map((f) => ({ horaInicio: f.horaInicio, horaFin: f.horaFin })),
    }))
  );
}

export async function getConfirmedSnapshotForDate(
  tallerId: string,
  date: Date
): Promise<DiaHorarioSnapshot[] | null> {
  const fecha = dateOnlyUtc(date);
  const cambio = await prisma.cambioHorario.findFirst({
    where: {
      tallerId,
      estado: EstadoCambioHorario.confirmado,
      aplicaDesde: { lte: fecha },
    },
    orderBy: { aplicaDesde: "desc" },
  });
  if (!cambio) return null;
  return canonicalWeeklySnapshot(cambio.franjas as DiaHorarioSnapshot[]);
}

function franjasFromExcepcion(excepcion: {
  tipo: TipoExcepcion;
  franjas: unknown;
  horaInicio: string | null;
  horaFin: string | null;
}): FranjaJson[] {
  if (excepcion.tipo === TipoExcepcion.cerrado) return [];
  if (excepcion.franjas != null) {
    return normalizeFranjas(excepcion.franjas);
  }
  return franjasFromLegacy(excepcion.horaInicio, excepcion.horaFin);
}

export async function getTallerScheduleForDate(
  tallerId: string,
  date: Date,
  proposedSnapshot?: DiaHorarioSnapshot[] | null
): Promise<TimeSlot[]> {
  const excepcion = await prisma.excepcionHorario.findUnique({
    where: {
      tallerId_fecha: {
        tallerId,
        fecha: dateOnlyUtc(date),
      },
    },
  });

  if (excepcion?.tipo === TipoExcepcion.cerrado) {
    return [];
  }

  if (excepcion?.tipo === TipoExcepcion.horario_especial) {
    return franjasToSlots(date, franjasFromExcepcion(excepcion));
  }

  if (proposedSnapshot) {
    const dia = DIA_MAP[date.getDay()];
    const day = proposedSnapshot.find((d) => d.dia === dia);
    if (!day?.activo) return [];
    return franjasToSlots(date, day.franjas);
  }

  const snapshot = await getConfirmedSnapshotForDate(tallerId, date);
  if (snapshot) {
    const dia = DIA_MAP[date.getDay()];
    const day = snapshot.find((d) => d.dia === dia);
    if (!day?.activo) return [];
    return franjasToSlots(date, day.franjas);
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

/** Alias público del resolver de horario. */
export const resolverHorario = getTallerScheduleForDate;

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

export async function assertWithinSchedule(
  tallerId: string,
  inicio: Date,
  fin: Date
): Promise<void> {
  const schedule = await getTallerScheduleForDate(tallerId, inicio);
  if (schedule.length === 0) {
    throw new DomainError("Taller cerrado en esa fecha", "FueraDeHorario");
  }

  if (!slotFitsSchedule(schedule, inicio, fin)) {
    throw new DomainError("Horario fuera del calendario del taller", "FueraDeHorario");
  }
}

export async function assertAnticipacion(
  tallerId: string,
  inicio: Date,
  now: Date = new Date()
): Promise<void> {
  const config = await getAgendaConfig(tallerId);
  if (config.anticipacionMinimaHoras > 0) {
    const earliest = addMinutes(now, config.anticipacionMinimaHoras * 60);
    if (inicio < earliest) {
      throw new DomainError("El turno es demasiado pronto", "FueraDeHorario");
    }
  }
  const latest = addMinutes(now, config.anticipacionMaximaDias * 24 * 60);
  if (inicio > latest) {
    throw new DomainError("El turno supera la anticipación máxima", "FueraDeHorario");
  }
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

export function aggregateVentanas(availability: BahiaAvailability[]): VentanaDisponible[] {
  const byStart = new Map<number, TimeSlot>();
  for (const bahia of availability) {
    for (const slot of bahia.slots) {
      if (!byStart.has(slot.inicio.getTime())) {
        byStart.set(slot.inicio.getTime(), slot);
      }
    }
  }
  return [...byStart.values()]
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    .map((s) => ({
      inicio: format(s.inicio, "HH:mm"),
      fin: format(s.fin, "HH:mm"),
    }));
}

export async function getAvailabilityForDate(params: {
  empresaId: string;
  tallerId: string;
  date: Date;
  servicioIds: string[];
  bahiaId?: string;
  now?: Date;
}): Promise<BahiaAvailability[]> {
  const now = params.now ?? new Date();
  const { duracionMin } = await calcularDuracionTotal({
    empresaId: params.empresaId,
    tallerId: params.tallerId,
    servicioIds: params.servicioIds,
  });
  const config = await getAgendaConfig(params.tallerId);

  const schedule = await getTallerScheduleForDate(params.tallerId, params.date);
  if (schedule.length === 0) return [];

  const compatibleBahias = await getCompatibleBahias(params.tallerId, params.servicioIds);
  const bahias = params.bahiaId
    ? compatibleBahias.filter((b) => b.id === params.bahiaId)
    : compatibleBahias;

  const earliest = addMinutes(now, config.anticipacionMinimaHoras * 60);
  const latest = addMinutes(now, config.anticipacionMaximaDias * 24 * 60);

  const results: BahiaAvailability[] = [];

  for (const bahia of bahias) {
    const occupied = await getOcupacionesForBahia(bahia.id, params.date);
    const freeWindows = subtractOccupiedFromWindows(schedule, occupied);
    const slots = slotsFromFreeWindows(
      freeWindows,
      duracionMin,
      config.intervaloInicioMinutos
    ).filter((s) => s.inicio >= earliest && s.inicio <= latest);

    results.push({
      bahiaId: bahia.id,
      bahiaNombre: bahia.nombre,
      slots,
    });
  }

  return results;
}

/** Alias público del cálculo de disponibilidad. */
export const calcularDisponibilidad = getAvailabilityForDate;

export type ProximoSlot = {
  inicio: string;
  finServicio: string;
  ocupadaHasta: string;
  tallerId: string;
  tallerNombre: string;
  localidad: string | null;
};

export async function proximosSlots(params: {
  empresaId: string;
  servicioId: string;
  tallerId?: string;
  desde?: Date;
  limite?: number;
  now?: Date;
}): Promise<ProximoSlot[]> {
  const now = params.now ?? new Date();
  const desde = params.desde ?? now;
  const limite = Math.min(20, Math.max(1, params.limite ?? 5));

  const talleres = await prisma.taller.findMany({
    where: {
      empresaId: params.empresaId,
      activo: true,
      configuracion: { is: {} },
      ...(params.tallerId ? { id: params.tallerId } : {}),
      bahias: { some: { activa: true } },
    },
    include: { configuracion: true },
    orderBy: [{ nombre: "asc" }, { id: "asc" }],
  });

  const collected: Array<ProximoSlot & { sortInicio: number; tallerNombre: string }> = [];

  for (const taller of talleres) {
    const compatible = await getCompatibleBahias(taller.id, [params.servicioId]);
    if (compatible.length === 0) continue;

    const config = await getAgendaConfig(taller.id);
    const horizonDays = Math.min(config.anticipacionMaximaDias, SYSTEM_HORIZON_DAYS);
    const { duracionServiciosMin, duracionMin } = await calcularDuracionTotal({
      empresaId: params.empresaId,
      tallerId: taller.id,
      servicioIds: [params.servicioId],
    });

    for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset += 1) {
      const date = addMinutes(startOfDay(desde), dayOffset * 24 * 60);
      const availability = await getAvailabilityForDate({
        empresaId: params.empresaId,
        tallerId: taller.id,
        date,
        servicioIds: [params.servicioId],
        now,
      });
      const seen = new Set<number>();
      for (const bahia of availability) {
        for (const slot of bahia.slots) {
          const key = slot.inicio.getTime();
          if (seen.has(key)) continue;
          seen.add(key);
          collected.push({
            inicio: slot.inicio.toISOString(),
            finServicio: addMinutes(slot.inicio, duracionServiciosMin).toISOString(),
            ocupadaHasta: addMinutes(slot.inicio, duracionMin).toISOString(),
            tallerId: taller.id,
            tallerNombre: taller.nombre,
            localidad: taller.localidad,
            sortInicio: key,
          });
        }
      }
      if (collected.length >= limite * 4) break;
    }
  }

  collected.sort((a, b) => {
    if (a.sortInicio !== b.sortInicio) return a.sortInicio - b.sortInicio;
    const name = a.tallerNombre.localeCompare(b.tallerNombre, "es");
    if (name !== 0) return name;
    return a.tallerId.localeCompare(b.tallerId);
  });

  return collected.slice(0, limite).map(({ sortInicio: _s, ...rest }) => rest);
}

export async function horarioResumenForTaller(tallerId: string) {
  const snapshot =
    (await getConfirmedSnapshotForDate(tallerId, new Date())) ??
    (await loadPatronesAsSnapshot(tallerId));
  return snapshot
    .filter((d) => d.activo && d.franjas.length > 0)
    .map((d) => ({
      dia: d.dia,
      franjas: d.franjas.map((f) => ({ abre: f.horaInicio, cierra: f.horaFin })),
    }));
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
      include: { bahia: true, creadoPor: true },
    }),
    getTallerScheduleForDate(params.tallerId, params.date),
  ]);

  return { bahias, turnos, bloqueos, schedule, isClosed: schedule.length === 0 };
}

export { ymdFromDateOnly };
