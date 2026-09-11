import Link from "next/link";
import { EstadoTurno, CanalTurno } from "@prisma/client";
import { buildAgendaQuery } from "@/lib/agenda-query";
import { CANAL_LABELS, TURNO_STATE_COLORS } from "@/lib/modules/appointments/constants";

const FILTERABLE_ESTADOS: EstadoTurno[] = [
  EstadoTurno.pendiente,
  EstadoTurno.confirmado,
  EstadoTurno.recibido,
  EstadoTurno.en_servicio,
  EstadoTurno.finalizado,
  EstadoTurno.cancelado,
  EstadoTurno.vencido,
  EstadoTurno.ausente,
];

const FILTERABLE_CANALES: CanalTurno[] = [
  CanalTurno.interno,
  CanalTurno.web,
  CanalTurno.whatsapp,
  CanalTurno.telefono,
  CanalTurno.agente_ia,
];

export function AgendaFilters({
  tallerId,
  dateStr,
  estado,
  canal,
  pendientes,
}: {
  tallerId: string;
  dateStr: string;
  estado?: EstadoTurno;
  canal?: CanalTurno;
  pendientes: boolean;
}) {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs font-medium text-slate-500">Estado:</span>
        <Link
          href={`/agenda?${buildAgendaQuery({ tallerId, dateStr, canal, pendientes }).toString()}`}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !estado ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-blue-200"
          }`}
        >
          Todos
        </Link>
        {FILTERABLE_ESTADOS.map((value) => (
          <Link
            key={value}
            href={`/agenda?${buildAgendaQuery({ tallerId, dateStr, estado: value, canal, pendientes }).toString()}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              estado === value
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-blue-200"
            }`}
          >
            {TURNO_STATE_COLORS[value].label}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs font-medium text-slate-500">Origen:</span>
        <Link
          href={`/agenda?${buildAgendaQuery({ tallerId, dateStr, estado, pendientes }).toString()}`}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !canal ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          Todos
        </Link>
        {FILTERABLE_CANALES.map((c) => (
          <Link
            key={c}
            href={`/agenda?${buildAgendaQuery({
              tallerId,
              dateStr,
              estado,
              canal: canal === c ? undefined : c,
              pendientes,
            }).toString()}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              canal === c
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {CANAL_LABELS[c]}
          </Link>
        ))}
      </div>
    </div>
  );
}
