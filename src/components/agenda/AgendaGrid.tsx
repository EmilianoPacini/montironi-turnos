"use client";

import Link from "next/link";
import { format, addMinutes, setHours, setMinutes, startOfDay } from "date-fns";
import { CanalTurno, EstadoTurno, TipoOcupacion } from "@prisma/client";
import { EstadoChip } from "@/components/turnos/EstadoChip";
import { BlockTile } from "@/components/agenda/BlockTile";
import { CANAL_LABELS, TURNO_STATE_COLORS } from "@/lib/modules/appointments/constants";

const SLOT_MIN = 30;
const ROW_HEIGHT = 48;
const DEFAULT_HOUR_START = 8;
const DEFAULT_HOUR_END = 18;

interface Bahia {
  id: string;
  nombre: string;
}

interface Turno {
  id: string;
  bahiaId: string;
  inicio: Date | string;
  finalizaEn: Date | string;
  estado: EstadoTurno;
  canal: CanalTurno;
  cliente: { nombre: string; apellido?: string | null };
  vehiculo: { patente: string };
  detalles: { nombreSnapshot: string }[];
  creador?: { nombre: string } | null;
}

interface Bloqueo {
  id: string;
  bahiaId: string;
  inicio: Date | string;
  fin: Date | string;
  motivo?: string | null;
  tipo: TipoOcupacion;
}

interface ScheduleWindow {
  inicio: Date | string;
  fin: Date | string;
}

function toDate(d: Date | string) {
  return typeof d === "string" ? new Date(d) : d;
}

function scheduleBounds(schedule: ScheduleWindow[]) {
  if (schedule.length === 0) {
    return { hourStart: DEFAULT_HOUR_START, hourEnd: DEFAULT_HOUR_END };
  }
  const starts = schedule.map((w) => toDate(w.inicio).getHours());
  const ends = schedule.map((w) => {
    const f = toDate(w.fin);
    return f.getMinutes() > 0 ? f.getHours() + 1 : f.getHours();
  });
  return {
    hourStart: Math.max(0, Math.min(...starts)),
    hourEnd: Math.min(23, Math.max(...ends)),
  };
}

function isWithinSchedule(slotStart: Date, schedule: ScheduleWindow[]) {
  if (schedule.length === 0) return false;
  return schedule.some((w) => {
    const ini = toDate(w.inicio);
    const fin = toDate(w.fin);
    return slotStart >= ini && slotStart < fin;
  });
}

export function AgendaGrid({
  date,
  tallerId,
  bahias,
  turnos,
  bloqueos,
  isClosed,
  schedule,
}: {
  date: Date;
  tallerId: string;
  bahias: Bahia[];
  turnos: Turno[];
  bloqueos: Bloqueo[];
  isClosed: boolean;
  schedule: ScheduleWindow[];
}) {
  const { hourStart, hourEnd } = scheduleBounds(schedule);
  const hours = [];
  for (let h = hourStart; h <= hourEnd; h++) {
    hours.push(h);
  }

  const totalRows = ((hourEnd - hourStart) * 60) / SLOT_MIN;

  function minutesFromStart(d: Date) {
    return d.getHours() * 60 + d.getMinutes() - hourStart * 60;
  }

  function topPx(d: Date) {
    return (minutesFromStart(d) / SLOT_MIN) * ROW_HEIGHT;
  }

  function heightPx(inicio: Date, fin: Date) {
    return ((fin.getTime() - inicio.getTime()) / (SLOT_MIN * 60_000)) * ROW_HEIGHT;
  }

  if (isClosed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <p className="font-medium text-amber-900">Taller cerrado este día</p>
        <p className="mt-1 text-sm text-amber-800">Estado calendario: Cerrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div
        className="grid min-w-[900px]"
        style={{ gridTemplateColumns: `80px repeat(${bahias.length}, 1fr)` }}
      >
        <div className="border-b border-r border-slate-200 bg-slate-50 p-2" />
        {bahias.map((b) => (
          <div
            key={b.id}
            className="border-b border-r border-slate-200 bg-slate-50 p-2 text-center text-sm font-semibold text-slate-800"
          >
            {b.nombre}
          </div>
        ))}

        <div className="relative border-r border-slate-200">
          {hours.map((h) => (
            <div
              key={h}
              className="border-b border-slate-100 px-2 text-xs text-slate-500"
              style={{ height: ROW_HEIGHT * 2 }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {bahias.map((bahia) => {
          const bahiaTurnos = turnos.filter((t) => t.bahiaId === bahia.id);
          const bahiaBloqueos = bloqueos.filter((b) => b.bahiaId === bahia.id);

          return (
            <div
              key={bahia.id}
              className="relative border-r border-slate-200"
              style={{ height: totalRows * ROW_HEIGHT }}
            >
              {Array.from({ length: totalRows }).map((_, i) => {
                const slotStart = addMinutes(
                  setMinutes(setHours(startOfDay(date), hourStart), 0),
                  i * SLOT_MIN
                );
                const hasTurno = bahiaTurnos.some((t) => {
                  const ini = toDate(t.inicio);
                  const fin = toDate(t.finalizaEn);
                  return ini <= slotStart && fin > slotStart;
                });
                const hasBlock = bahiaBloqueos.some((b) => {
                  const ini = toDate(b.inicio);
                  const fin = toDate(b.fin);
                  return ini <= slotStart && fin > slotStart;
                });
                const inSchedule = isWithinSchedule(slotStart, schedule);

                if (hasTurno || hasBlock || !inSchedule) return null;

                return (
                  <Link
                    key={i}
                    href={`/turnos/nuevo?bahiaId=${bahia.id}&inicio=${slotStart.toISOString()}&tallerId=${tallerId}`}
                    className="absolute inset-x-1 flex flex-col items-center justify-center rounded border border-dashed border-emerald-200 bg-emerald-50/60 text-[10px] text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50"
                    style={{
                      top: i * ROW_HEIGHT,
                      height: ROW_HEIGHT,
                    }}
                  >
                    <span className="font-medium">Disponible</span>
                    <span className="text-emerald-600/80">+ Agendar</span>
                  </Link>
                );
              })}

              {bahiaBloqueos.map((bloqueo) => {
                const ini = toDate(bloqueo.inicio);
                const fin = toDate(bloqueo.fin);
                return (
                  <BlockTile
                    key={bloqueo.id}
                    blockId={bloqueo.id}
                    top={topPx(ini)}
                    height={heightPx(ini, fin)}
                    motivo={bloqueo.motivo}
                  />
                );
              })}

              {bahiaTurnos.map((turno) => {
                const ini = toDate(turno.inicio);
                const fin = toDate(turno.finalizaEn);
                const colors = TURNO_STATE_COLORS[turno.estado];
                const actor =
                  turno.canal === CanalTurno.interno
                    ? turno.creador?.nombre ?? "Panel"
                    : CANAL_LABELS[turno.canal];

                return (
                  <Link
                    key={turno.id}
                    href={`/turnos/${turno.id}`}
                    className="absolute inset-x-1 overflow-hidden rounded border px-2 py-1 text-xs shadow-sm transition hover:shadow"
                    style={{
                      top: topPx(ini),
                      height: Math.max(heightPx(ini, fin), 40),
                      borderColor: colors.text,
                      backgroundColor: colors.bg,
                      color: colors.text,
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold">
                        {format(ini, "HH:mm")}–{format(fin, "HH:mm")}
                      </span>
                      <EstadoChip estado={turno.estado} />
                    </div>
                    <p className="truncate font-medium">
                      {turno.detalles.map((d) => d.nombreSnapshot).join(", ")}
                    </p>
                    <p className="truncate opacity-90">
                      {turno.cliente.nombre} · {turno.vehiculo.patente}
                    </p>
                    <p className="truncate opacity-75">
                      {CANAL_LABELS[turno.canal]} · {actor}
                    </p>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
