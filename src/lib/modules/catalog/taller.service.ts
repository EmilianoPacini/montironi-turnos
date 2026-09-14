import { createHash } from "crypto";
import {
  DiaSemana,
  EstadoCambioHorario,
  EstadoTurno,
  Prisma,
  TipoExcepcion,
} from "@prisma/client";
import prisma from "@/lib/db";
import { DomainError } from "@/lib/modules/appointments/errors";
import { isTerminalEstado } from "@/lib/modules/appointments/constants";
import {
  offerEmpresaServiciosInBahia,
} from "@/lib/modules/catalog/oferta";
import {
  concatenateDireccion,
  type DireccionEstructurada,
} from "@/lib/modules/catalog/direccion";
import {
  canonicalWeeklySnapshot,
  franjasFromLegacy,
  normalizeFranjas,
  type DiaHorarioSnapshot,
  type FranjaJson,
} from "@/lib/modules/catalog/franjas";
import {
  getAgendaConfig,
  getTallerScheduleForDate,
  loadPatronesAsSnapshot,
  slotFitsSchedule,
} from "@/lib/modules/availability/service";
import { addDaysUtcDateOnly, dateOnlyUtc, parseYmdToDateOnly, ymdFromDateOnly } from "@/lib/time/business-tz";

export type TallerAgendaRules = {
  margenMinutos?: number;
  intervaloInicioMinutos?: number;
  anticipacionMinimaHoras?: number;
  anticipacionMaximaDias?: number;
  permiteCancelacion?: boolean;
  horasLimiteCancelacion?: number;
};

export async function horarioParaEditor(tallerId: string): Promise<DiaHorarioSnapshot[]> {
  const latest = await prisma.cambioHorario.findFirst({
    where: { tallerId, estado: EstadoCambioHorario.confirmado },
    orderBy: { aplicaDesde: "desc" },
  });
  if (latest) {
    return canonicalWeeklySnapshot(latest.franjas as DiaHorarioSnapshot[]);
  }
  return loadPatronesAsSnapshot(tallerId);
}

export async function listTalleresAdmin(empresaId: string) {
  return prisma.taller.findMany({
    where: { empresaId },
    include: {
      bahias: { orderBy: { orden: "asc" } },
      configuracion: true,
      patronesHorario: { include: { franjas: true } },
    },
    orderBy: { nombre: "asc" },
  });
}

async function assertTallerTenant(tallerId: string, empresaId: string) {
  const taller = await prisma.taller.findFirst({
    where: { id: tallerId, empresaId },
  });
  if (!taller) throw new DomainError("Taller no encontrado", "RecursoNoEncontrado");
  return taller;
}

export async function createTaller(params: {
  empresaId: string;
  nombre: string;
  activo?: boolean;
  direccion?: DireccionEstructurada;
  reglas?: TallerAgendaRules;
  horario?: DiaHorarioSnapshot[];
  bahias?: { nombre: string }[];
  usuarioId?: string;
}) {
  const direccion = concatenateDireccion(params.direccion ?? {});
  const horario = canonicalWeeklySnapshot(params.horario ?? defaultHorarioSemanal());
  const reglas = params.reglas ?? {};

  return prisma.$transaction(async (tx) => {
    const taller = await tx.taller.create({
      data: {
        empresaId: params.empresaId,
        nombre: params.nombre.trim(),
        activo: params.activo ?? true,
        direccion,
        calle: params.direccion?.calle?.trim() || null,
        numero: params.direccion?.numero?.trim() || null,
        localidad: params.direccion?.localidad?.trim() || null,
        provincia: params.direccion?.provincia?.trim() || null,
        codigoPostal: params.direccion?.codigoPostal?.trim() || null,
      },
    });

    await tx.configuracionTurnos.create({
      data: {
        tallerId: taller.id,
        margenMinutos: reglas.margenMinutos ?? 15,
        intervaloInicioMinutos: reglas.intervaloInicioMinutos ?? 15,
        anticipacionMinimaHoras: reglas.anticipacionMinimaHoras ?? 0,
        anticipacionMaximaDias: reglas.anticipacionMaximaDias ?? 90,
        permiteCancelacion: reglas.permiteCancelacion ?? true,
        horasLimiteCancelacion: reglas.horasLimiteCancelacion ?? 24,
      },
    });

    for (const dia of horario) {
      const patron = await tx.patronHorario.create({
        data: {
          tallerId: taller.id,
          dia: dia.dia,
          activo: dia.activo,
        },
      });
      if (dia.activo && dia.franjas.length > 0) {
        await tx.franjaHoraria.createMany({
          data: dia.franjas.map((f) => ({
            patronHorarioId: patron.id,
            horaInicio: f.horaInicio,
            horaFin: f.horaFin,
          })),
        });
      }
    }

    const servicios = await tx.servicio.findMany({
      where: { empresaId: params.empresaId, activo: true },
      select: { id: true },
    });
    if (servicios.length > 0) {
      await tx.tallerServicio.createMany({
        data: servicios.map((s) => ({ tallerId: taller.id, servicioId: s.id })),
        skipDuplicates: true,
      });
    }

    for (const [index, bahiaInput] of (params.bahias ?? []).entries()) {
      const nombre = bahiaInput.nombre.trim();
      if (!nombre) continue;
      const bahia = await tx.bahia.create({
        data: {
          tallerId: taller.id,
          nombre,
          orden: index + 1,
        },
      });
      await offerEmpresaServiciosInBahia(tx, params.empresaId, bahia.id);
    }

    return taller;
  });
}

export async function updateTaller(params: {
  tallerId: string;
  empresaId: string;
  nombre?: string;
  activo?: boolean;
  direccion?: DireccionEstructurada;
  reglas?: TallerAgendaRules;
}) {
  await assertTallerTenant(params.tallerId, params.empresaId);

  const data: Prisma.TallerUpdateInput = {};
  if (params.nombre !== undefined) data.nombre = params.nombre.trim();
  if (params.activo !== undefined) data.activo = params.activo;
  if (params.direccion) {
    data.calle = params.direccion.calle?.trim() || null;
    data.numero = params.direccion.numero?.trim() || null;
    data.localidad = params.direccion.localidad?.trim() || null;
    data.provincia = params.direccion.provincia?.trim() || null;
    data.codigoPostal = params.direccion.codigoPostal?.trim() || null;
    data.direccion = concatenateDireccion(params.direccion);
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.taller.update({ where: { id: params.tallerId }, data });
    }
    if (params.reglas) {
      await tx.configuracionTurnos.upsert({
        where: { tallerId: params.tallerId },
        create: {
          tallerId: params.tallerId,
          margenMinutos: params.reglas.margenMinutos ?? 15,
          intervaloInicioMinutos: params.reglas.intervaloInicioMinutos ?? 15,
          anticipacionMinimaHoras: params.reglas.anticipacionMinimaHoras ?? 0,
          anticipacionMaximaDias: params.reglas.anticipacionMaximaDias ?? 90,
          permiteCancelacion: params.reglas.permiteCancelacion ?? true,
          horasLimiteCancelacion: params.reglas.horasLimiteCancelacion ?? 24,
        },
        update: {
          ...(params.reglas.margenMinutos !== undefined
            ? { margenMinutos: params.reglas.margenMinutos }
            : {}),
          ...(params.reglas.intervaloInicioMinutos !== undefined
            ? { intervaloInicioMinutos: params.reglas.intervaloInicioMinutos }
            : {}),
          ...(params.reglas.anticipacionMinimaHoras !== undefined
            ? { anticipacionMinimaHoras: params.reglas.anticipacionMinimaHoras }
            : {}),
          ...(params.reglas.anticipacionMaximaDias !== undefined
            ? { anticipacionMaximaDias: params.reglas.anticipacionMaximaDias }
            : {}),
          ...(params.reglas.permiteCancelacion !== undefined
            ? { permiteCancelacion: params.reglas.permiteCancelacion }
            : {}),
          ...(params.reglas.horasLimiteCancelacion !== undefined
            ? { horasLimiteCancelacion: params.reglas.horasLimiteCancelacion }
            : {}),
        },
      });
    }
  });
}

export async function upsertExcepcion(params: {
  tallerId: string;
  empresaId: string;
  fecha: Date | string;
  tipo: TipoExcepcion;
  franjas?: FranjaJson[];
  horaInicio?: string | null;
  horaFin?: string | null;
  motivo?: string | null;
}) {
  await assertTallerTenant(params.tallerId, params.empresaId);
  const fecha =
    typeof params.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.fecha)
      ? parseYmdToDateOnly(params.fecha)
      : params.fecha instanceof Date && params.fecha.toISOString().endsWith("T00:00:00.000Z")
        ? parseYmdToDateOnly(params.fecha.toISOString().slice(0, 10))
        : dateOnlyUtc(params.fecha instanceof Date ? params.fecha : new Date(params.fecha));

  let franjas: FranjaJson[] | undefined;
  if (params.tipo === TipoExcepcion.cerrado) {
    franjas = [];
  } else if (params.franjas) {
    franjas = normalizeFranjas(params.franjas);
    if (franjas.length === 0) {
      throw new DomainError("horario_especial requiere al menos una franja", "FueraDeHorario");
    }
  } else {
    franjas = franjasFromLegacy(params.horaInicio, params.horaFin);
    if (franjas.length === 0) {
      throw new DomainError("horario_especial requiere al menos una franja", "FueraDeHorario");
    }
  }

  const row = await prisma.excepcionHorario.upsert({
    where: {
      tallerId_fecha: { tallerId: params.tallerId, fecha },
    },
    create: {
      tallerId: params.tallerId,
      fecha,
      tipo: params.tipo,
      franjas: params.tipo === TipoExcepcion.cerrado ? Prisma.JsonNull : franjas,
      horaInicio: franjas[0]?.horaInicio ?? null,
      horaFin: franjas[0]?.horaFin ?? null,
      motivo: params.motivo,
    },
    update: {
      tipo: params.tipo,
      franjas: params.tipo === TipoExcepcion.cerrado ? Prisma.JsonNull : franjas,
      horaInicio: franjas[0]?.horaInicio ?? null,
      horaFin: franjas[0]?.horaFin ?? null,
      motivo: params.motivo,
    },
  });

  return row;
}

export type TurnoConflictoHorario = {
  id: string;
  inicio: string;
  finalizaEn: string;
  estado: EstadoTurno;
};

export type PreviewCambioHorario = {
  aplicaDesde: string;
  previewHash: string;
  conflictos: TurnoConflictoHorario[];
};

function canonicalHashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function listConflictosNuevoHorario(params: {
  tallerId: string;
  snapshot: DiaHorarioSnapshot[];
  aplicaDesde?: Date;
}): Promise<TurnoConflictoHorario[]> {
  const snapshot = canonicalWeeklySnapshot(params.snapshot);
  const from = params.aplicaDesde ?? dateOnlyUtc(new Date());

  const turnos = await prisma.turno.findMany({
    where: {
      tallerId: params.tallerId,
      inicio: { gte: from },
      estado: {
        notIn: [
          EstadoTurno.finalizado,
          EstadoTurno.cancelado,
          EstadoTurno.ausente,
          EstadoTurno.vencido,
        ],
      },
    },
    orderBy: { inicio: "asc" },
  });

  const conflictos: TurnoConflictoHorario[] = [];
  for (const turno of turnos) {
    if (isTerminalEstado(turno.estado)) continue;
    const schedule = await getTallerScheduleForDate(params.tallerId, turno.inicio, snapshot);
    if (!slotFitsSchedule(schedule, turno.inicio, turno.finalizaEn)) {
      conflictos.push({
        id: turno.id,
        inicio: turno.inicio.toISOString(),
        finalizaEn: turno.finalizaEn.toISOString(),
        estado: turno.estado,
      });
    }
  }
  return conflictos;
}

export async function previewCambioHorario(params: {
  tallerId: string;
  empresaId: string;
  snapshot: DiaHorarioSnapshot[];
}): Promise<PreviewCambioHorario> {
  await assertTallerTenant(params.tallerId, params.empresaId);
  const snapshot = canonicalWeeklySnapshot(params.snapshot);
  const conflictos = await listConflictosNuevoHorario({
    tallerId: params.tallerId,
    snapshot,
  });

  const today = dateOnlyUtc(new Date());
  let aplicaDesde = today;
  if (conflictos.length > 0) {
    const last = conflictos.reduce((max, c) =>
      c.inicio > max.inicio ? c : max
    );
    aplicaDesde = addDaysUtcDateOnly(new Date(last.inicio), 1);
  }

  const remaining = await listConflictosNuevoHorario({
    tallerId: params.tallerId,
    snapshot,
    aplicaDesde,
  });

  const horarioActual = await loadPatronesAsSnapshot(params.tallerId);
  const config = await getAgendaConfig(params.tallerId);

  const previewHash = canonicalHashPayload({
    tallerId: params.tallerId,
    empresaId: params.empresaId,
    horarioActual,
    horarioNuevo: snapshot,
    aplicaDesde: ymdFromDateOnly(aplicaDesde),
    config,
    conflictos: remaining.map((c) => c.id).sort(),
  });

  return {
    aplicaDesde: ymdFromDateOnly(aplicaDesde),
    previewHash,
    conflictos,
  };
}

export async function confirmarCambioHorario(params: {
  tallerId: string;
  empresaId: string;
  snapshot: DiaHorarioSnapshot[];
  aplicaDesde: string;
  previewHash: string;
  reemplazarFuturo?: boolean;
  usuarioId?: string;
}) {
  await assertTallerTenant(params.tallerId, params.empresaId);
  const snapshot = canonicalWeeklySnapshot(params.snapshot);

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM taller WHERE id = ${params.tallerId}::uuid FOR UPDATE`;

      const preview = await previewCambioHorario({
        tallerId: params.tallerId,
        empresaId: params.empresaId,
        snapshot,
      });

      if (preview.previewHash !== params.previewHash || preview.aplicaDesde !== params.aplicaDesde) {
        throw new DomainError("El preview de horario venció", "VersionConflicto");
      }

      const remaining = await listConflictosNuevoHorario({
        tallerId: params.tallerId,
        snapshot,
        aplicaDesde: parseYmdToDateOnly(params.aplicaDesde),
      });
      if (remaining.length > 0) {
        throw new DomainError(
          "Hay turnos que no caben en el nuevo horario",
          "FueraDeHorario"
        );
      }

      const today = dateOnlyUtc(new Date());
      const futuro = await tx.cambioHorario.findFirst({
        where: {
          tallerId: params.tallerId,
          estado: EstadoCambioHorario.confirmado,
          aplicaDesde: { gt: today },
        },
      });

      if (futuro) {
        if (!params.reemplazarFuturo) {
          throw new DomainError(
            "Ya hay un cambio de horario futuro confirmado",
            "VersionConflicto"
          );
        }
        await tx.cambioHorario.update({
          where: { id: futuro.id },
          data: { estado: EstadoCambioHorario.cancelado },
        });
      }

      return tx.cambioHorario.create({
        data: {
          tallerId: params.tallerId,
          aplicaDesde: parseYmdToDateOnly(params.aplicaDesde),
          franjas: snapshot,
          previewHash: params.previewHash,
          estado: EstadoCambioHorario.confirmado,
          confirmadoEn: new Date(),
          confirmadoPorUsuarioId: params.usuarioId,
        },
      });
    });
  } catch (e) {
    if (e instanceof DomainError) throw e;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new DomainError(
        "Ya hay un cambio de horario confirmado para esa fecha",
        "VersionConflicto"
      );
    }
    throw e;
  }
}

export function defaultHorarioSemanal(): DiaHorarioSnapshot[] {
  const weekdays: DiaSemana[] = [
    DiaSemana.lunes,
    DiaSemana.martes,
    DiaSemana.miercoles,
    DiaSemana.jueves,
    DiaSemana.viernes,
  ];
  const franjas: FranjaJson[] = [
    { horaInicio: "08:00", horaFin: "12:00" },
    { horaInicio: "13:00", horaFin: "18:00" },
  ];
  return canonicalWeeklySnapshot(
    Object.values(DiaSemana).map((dia) => ({
      dia,
      activo: weekdays.includes(dia),
      franjas: weekdays.includes(dia) ? franjas : [],
    }))
  );
}
