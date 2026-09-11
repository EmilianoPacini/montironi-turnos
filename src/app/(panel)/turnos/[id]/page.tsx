import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getAuthSession } from "@/lib/auth/session";
import { getTurnoById, expirePendingTurnos } from "@/lib/modules/appointments/service";
import { EstadoChip } from "@/components/turnos/EstadoChip";
import {
  VALID_TRANSITIONS,
  ORIGEN_LABELS,
  canTransition,
  formatPrecioSnapshot,
} from "@/lib/modules/appointments/constants";
import { TurnoActions } from "@/components/turnos/TurnoActions";
import { EstadoTurno } from "@prisma/client";

export default async function TurnoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();

  const { id } = await params;
  await expirePendingTurnos(session.empresaId);
  const turno = await getTurnoById(id, session.empresaId);
  if (!turno) notFound();

  const transiciones = VALID_TRANSITIONS[turno.estado].filter(
    (t) => t !== EstadoTurno.cancelado
  );

  return (
    <div className="p-6 lg:p-8">
      <Link href="/agenda" className="text-sm text-slate-600 hover:text-slate-900">
        ← Volver a agenda
      </Link>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Detalle del turno</h1>
            <EstadoChip estado={turno.estado} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {format(turno.inicio, "EEEE d MMMM yyyy", { locale: es })} ·{" "}
            {format(turno.inicio, "HH:mm")} – {format(turno.fin, "HH:mm")}
          </p>
        </div>
        <TurnoActions
          turnoId={turno.id}
          version={turno.version}
          estado={turno.estado}
          transiciones={transiciones}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Cliente y vehículo</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Cliente</dt>
              <dd className="font-medium">
                {turno.cliente.nombre} {turno.cliente.apellido ?? ""}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Teléfono</dt>
              <dd>{turno.cliente.telefono ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Vehículo</dt>
              <dd>
                {turno.vehiculo.patente} · {turno.vehiculo.marca} {turno.vehiculo.modelo}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Bahía</dt>
              <dd>{turno.bahia.nombre} · {turno.taller.nombre}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Origen</dt>
              <dd>
                {ORIGEN_LABELS[turno.origen]}
                {turno.creador ? ` · ${turno.creador.nombre}` : ""}
                {turno.agenteIa ? ` · ${turno.agenteIa.nombre}` : ""}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Servicios</h2>
          <ul className="space-y-2">
            {turno.detalles.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span>{d.nombreSnapshot}</span>
                <span className="text-slate-600">
                  {d.duracionMin} min ·{" "}
                  {formatPrecioSnapshot(Number(d.precioSnapshot), d.modoPrecioSnapshot)}
                </span>
              </li>
            ))}
          </ul>
          {turno.notas ? (
            <p className="mt-4 text-sm text-slate-600">
              <span className="font-medium">Notas:</span> {turno.notas}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Historial</h2>
          <ol className="space-y-3">
            {turno.eventos.map((ev) => (
              <li key={ev.id} className="flex gap-3 text-sm">
                <span className="w-36 shrink-0 text-slate-500">
                  {format(ev.createdAt, "dd/MM HH:mm")}
                </span>
                <span>
                  {ev.estadoPrev ? `${ev.estadoPrev} → ` : ""}
                  <strong>{ev.estadoNuevo}</strong>
                  {ev.detalle ? ` · ${ev.detalle}` : ""}
                  {ev.usuario ? ` (${ev.usuario.nombre})` : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {canTransition(turno.estado, EstadoTurno.confirmado) ||
      ["pendiente", "confirmado", "recibido"].includes(turno.estado) ? (
        <div className="mt-6">
          <Link
            href={`/turnos/${turno.id}/reprogramar`}
            className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            Reprogramar turno →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
