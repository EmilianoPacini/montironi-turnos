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
import { TurnoCard } from "@/components/turnos/TurnoCard";
import { CANAL_LABELS } from "@/lib/modules/appointments/constants";
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

  const queryBase = new URLSearchParams();
  queryBase.set("taller", tallerId);
  queryBase.set("fecha", dateStr);
  if (estadoFilter) queryBase.set("estado", estadoFilter);
  if (canalFilter) queryBase.set("canal", canalFilter);
  if (pendientes) queryBase.set("pendientes", "1");

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agenda diaria</h1>
          <p className="text-sm capitalize text-slate-600">
            {format(date, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/turnos/nuevo?tallerId=${tallerId}`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={`/agenda?${queryBase.toString()}&vista=grid`}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            vista === "grid" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          Grilla
        </Link>
        <Link
          href={`/agenda?${queryBase.toString()}&vista=lista`}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            vista === "lista" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          Lista
        </Link>
        <Link
          href={`/agenda?${queryBase.toString()}&pendientes=1`}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            pendientes ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-900"
          }`}
        >
          Pendientes
        </Link>
      </div>

      <AgendaFilters queryBase={queryBase.toString()} estado={estadoFilter} canal={canalFilter} />

      {vista === "lista" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {turnos.length === 0 ? (
            <p className="col-span-full text-center text-slate-500">Sin turnos para mostrar</p>
          ) : (
            turnos.map((t) => <TurnoCard key={t.id} turno={t} />)
          )}
        </div>
      ) : (
        <AgendaGrid
          date={date}
          bahias={agenda.bahias}
          turnos={turnos}
          bloqueos={agenda.bloqueos}
          isClosed={agenda.isClosed}
        />
      )}
    </div>
  );
}

function AgendaFilters({
  queryBase,
  estado,
  canal,
}: {
  queryBase: string;
  estado?: EstadoTurno;
  canal?: CanalTurno;
}) {
  const estados: { value: EstadoTurno; label: string }[] = [
    { value: EstadoTurno.pendiente, label: "Pendiente" },
    { value: EstadoTurno.confirmado, label: "Confirmado" },
    { value: EstadoTurno.recibido, label: "Recibido" },
    { value: EstadoTurno.en_servicio, label: "En servicio" },
    { value: EstadoTurno.finalizado, label: "Finalizado" },
  ];

  const canales: CanalTurno[] = [
    CanalTurno.interno,
    CanalTurno.whatsapp,
    CanalTurno.telefono,
    CanalTurno.agente_ia,
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link
        href={`/agenda?${queryBase.replace(/&?estado=[^&]*/g, "")}`}
        className={`rounded-full px-3 py-1 text-xs font-medium ${
          !estado ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
        }`}
      >
        Todos
      </Link>
      {estados.map((e) => (
        <Link
          key={e.value}
          href={`/agenda?${queryBase}&estado=${e.value}`}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            estado === e.value
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          {e.label}
        </Link>
      ))}
      {canales.map((c) => (
        <Link
          key={c}
          href={`/agenda?${queryBase}&canal=${c}`}
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
  );
}
