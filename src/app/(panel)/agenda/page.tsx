import { redirect } from "next/navigation";
import Link from "next/link";
import { format, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { getAuthSession } from "@/lib/auth/session";
import { listTalleres } from "@/lib/modules/catalog/service";
import { getAgendaForDate } from "@/lib/modules/availability/service";
import { expirePendingTurnos } from "@/lib/modules/appointments/service";
import { AgendaGrid } from "@/components/agenda/AgendaGrid";
import { AgendaToolbar } from "@/components/agenda/AgendaToolbar";
import { CalendarLegend } from "@/components/agenda/CalendarLegend";
import { TurnoListTable } from "@/components/turnos/TurnoListTable";
import { CANAL_LABELS } from "@/lib/modules/appointments/constants";
import { buildAgendaQuery } from "@/lib/agenda-query";
import { mapTurnoForAgendaClient } from "@/lib/serialize-for-client";
import { CanalTurno, EstadoTurno } from "@prisma/client";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();

  const params = await searchParams;
  const talleres = await listTalleres(session.empresaId);
  const tallerId =
    (typeof params.taller === "string" ? params.taller : undefined) ??
    talleres[0]?.id;

  const dateStr =
    typeof params.fecha === "string" ? params.fecha : format(new Date(), "yyyy-MM-dd");
  const date = startOfDay(parseISO(dateStr));

  const estadoFilter =
    typeof params.estado === "string" ? (params.estado as EstadoTurno) : undefined;
  const canalFilter =
    typeof params.canal === "string" ? (params.canal as CanalTurno) : undefined;
  const pendientes = params.pendientes === "1";
  const vista = typeof params.vista === "string" ? params.vista : "grid";

  if (!tallerId) {
    return (
      <div className="p-8">
        <p>No hay talleres configurados.</p>
      </div>
    );
  }

  await expirePendingTurnos(session.empresaId);

  const agenda = await getAgendaForDate({
    empresaId: session.empresaId,
    tallerId,
    date,
  });

  let turnos = agenda.turnos;
  if (estadoFilter) turnos = turnos.filter((t) => t.estado === estadoFilter);
  if (canalFilter) turnos = turnos.filter((t) => t.canal === canalFilter);
  if (pendientes) turnos = turnos.filter((t) => t.estado === EstadoTurno.pendiente);

  const baseQuery = buildAgendaQuery({
    tallerId,
    dateStr,
    estado: estadoFilter,
    canal: canalFilter,
    pendientes,
  });

  return (
    <div className="panel-page">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="panel-title">Agenda diaria</h1>
          <p className="text-sm capitalize text-slate-600">
            {format(date, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/turnos/nuevo?tallerId=${tallerId}`}
            className="btn-primary"
          >
            + Nuevo turno
          </Link>
          <Link
            href={`/agenda/bloquear?tallerId=${tallerId}&fecha=${dateStr}`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Bloquear bahía
          </Link>
        </div>
      </div>

      <AgendaToolbar talleres={talleres} tallerId={tallerId} dateStr={dateStr} />

      <CalendarLegend isClosed={agenda.isClosed} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={`/agenda?${buildAgendaQuery({ tallerId, dateStr, estado: estadoFilter, canal: canalFilter, pendientes, vista: "grid" }).toString()}`}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            vista === "grid" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-blue-50"
          }`}
        >
          Grilla
        </Link>
        <Link
          href={`/agenda?${buildAgendaQuery({ tallerId, dateStr, estado: estadoFilter, canal: canalFilter, pendientes, vista: "lista" }).toString()}`}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            vista === "lista" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-blue-50"
          }`}
        >
          Lista
        </Link>
        <Link
          href={`/agenda?${buildAgendaQuery({ tallerId, dateStr, estado: estadoFilter, canal: canalFilter, pendientes: !pendientes }).toString()}`}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            pendientes ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-900"
          }`}
        >
          Pendientes
        </Link>
      </div>

      <AgendaFilters
        tallerId={tallerId}
        dateStr={dateStr}
        estado={estadoFilter}
        canal={canalFilter}
        pendientes={pendientes}
      />

      {vista === "lista" ? (
        <TurnoListTable turnos={turnos} />
      ) : (
        <AgendaGrid
          date={date}
          tallerId={tallerId}
          bahias={agenda.bahias}
          turnos={turnos.map(mapTurnoForAgendaClient)}
          bloqueos={agenda.bloqueos}
          isClosed={agenda.isClosed}
          schedule={agenda.schedule}
        />
      )}
    </div>
  );
}

function AgendaFilters({
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
  const estados: { value: EstadoTurno; label: string }[] = [
    { value: EstadoTurno.pendiente, label: "Pendiente" },
    { value: EstadoTurno.confirmado, label: "Confirmado" },
    { value: EstadoTurno.recibido, label: "Recibido" },
    { value: EstadoTurno.en_servicio, label: "En servicio" },
    { value: EstadoTurno.finalizado, label: "Finalizado" },
    { value: EstadoTurno.cancelado, label: "Cancelado" },
    { value: EstadoTurno.vencido, label: "Vencido" },
    { value: EstadoTurno.ausente, label: "Ausente" },
  ];

  const canales: CanalTurno[] = [
    CanalTurno.interno,
    CanalTurno.web,
    CanalTurno.whatsapp,
    CanalTurno.telefono,
    CanalTurno.agente_ia,
  ];

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
        {estados.map((e) => (
          <Link
            key={e.value}
            href={`/agenda?${buildAgendaQuery({ tallerId, dateStr, estado: e.value, canal, pendientes }).toString()}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              estado === e.value
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-blue-200"
            }`}
          >
            {e.label}
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
        {canales.map((c) => (
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
