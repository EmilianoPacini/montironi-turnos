"use client";

import Link from "next/link";
import { format, addMinutes, setHours, setMinutes, startOfDay } from "date-fns";
import { EstadoTurno, OrigenTurno, TipoOcupacion } from "@prisma/client";
import { EstadoChip } from "@/components/turnos/EstadoChip";
import { ORIGEN_LABELS, TURNO_STATE_COLORS } from "@/lib/modules/appointments/constants";

const HOUR_START = 8;
const HOUR_END = 18;
const SLOT_MIN = 30;
const ROW_HEIGHT = 48;

interface Bahia {
  id: string;
  nombre: string;
}

interface Turno {
  id: string;
  bahiaId: string;
  inicio: Date | string;
  fin: Date | string;
  estado: EstadoTurno;
  origen: OrigenTurno;
  cliente: { nombre: string; apellido?: string | null };
  vehiculo: { patente: string };
  detalles: { nombreSnapshot: string }[];
  creador?: { nombre: string } | null;
  agenteIa?: { nombre: string } | null;
}

interface Bloqueo {
  id: string;
  bahiaId: string;
  inicio: Date | string;
  fin: Date | string;
  motivo?: string | null;
  tipo: TipoOcupacion;
}

function toDate(d: Date | string) {
  return typeof d === "string" ? new Date(d) : d;
}

function minutesFromStart(d: Date) {
  return d.getHours() * 60 + d.getMinutes() - HOUR_START * 60;
}

function topPx(d: Date) {
  return (minutesFromStart(d) / SLOT_MIN) * ROW_HEIGHT;
}

function heightPx(inicio: Date, fin: Date) {
  return ((fin.getTime() - inicio.getTime()) / (SLOT_MIN * 60_000)) * ROW_HEIGHT;
}

export function AgendaGrid({
  date,
  bahias,
  turnos,
  bloqueos,
  isClosed,
}: {
  date: Date;
  bahias: Bahia[];
  turnos: Turno[];
  bloqueos: Bloqueo[];
  isClosed: boolean;
}) {
  const hours = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) {
    hours.push(h);
  }

  const totalRows = ((HOUR_END - HOUR_START) * 60) / SLOT_MIN;

  if (isClosed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <p className="font-medium text-amber-900">Taller cerrado este día</p>
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
                  setMinutes(setHours(startOfDay(date), HOUR_START), 0),
                  i * SLOT_MIN
                );
                const hasTurno = bahiaTurnos.some((t) => {
                  const ini = toDate(t.inicio);
                  const fin = toDate(t.fin);
                  return ini <= slotStart && fin > slotStart;
                });
                const hasBlock = bahiaBloqueos.some((b) => {
                  const ini = toDate(b.inicio);
                  const fin = toDate(b.fin);
                  return ini <= slotStart && fin > slotStart;
                });

                if (hasTurno || hasBlock) return null;

                return (
                  <Link
                    key={i}
                    href={`/turnos/nuevo?bahiaId=${bahia.id}&inicio=${slotStart.toISOString()}`}
                    className="absolute inset-x-1 flex items-center justify-center rounded border border-dashed border-transparent text-xs text-slate-400 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
                    style={{
                      top: i * ROW_HEIGHT,
                      height: ROW_HEIGHT,
                    }}
                  >
                    + Agendar
                  </Link>
                );
              })}

              {bahiaBloqueos.map((bloqueo) => {
                const ini = toDate(bloqueo.inicio);
                const fin = toDate(bloqueo.fin);
                return (
                  <div
                    key={bloqueo.id}
                    className="absolute inset-x-1 rounded border border-slate-400 bg-slate-200 px-2 py-1 text-xs text-slate-700"
                    style={{
                      top: topPx(ini),
                      height: Math.max(heightPx(ini, fin), 24),
                    }}
                  >
                    <span className="font-semibold">Bloqueado</span>
                    {bloqueo.motivo ? ` · ${bloqueo.motivo}` : ""}
                  </div>
                );
              })}

              {bahiaTurnos.map((turno) => {
                const ini = toDate(turno.inicio);
                const fin = toDate(turno.fin);
                const colors = TURNO_STATE_COLORS[turno.estado];
                const actor =
                  turno.origen === "panel"
                    ? turno.creador?.nombre ?? "Panel"
                    : turno.agenteIa?.nombre ?? ORIGEN_LABELS[turno.origen];

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
                      {ORIGEN_LABELS[turno.origen]} · {actor}
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
