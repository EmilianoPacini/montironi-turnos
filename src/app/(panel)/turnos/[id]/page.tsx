import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getAuthSession } from "@/lib/auth/session";
import { getTurnoById, expirePendingTurnos } from "@/lib/modules/appointments/service";
import { EstadoChip } from "@/components/turnos/EstadoChip";
import {
  CANAL_LABELS,
  canTransition,
  formatPrecioSnapshot,
} from "@/lib/modules/appointments/constants";
import { TurnoStateDropdown } from "@/components/turnos/TurnoStateDropdown";
import { getProximosKmForTurno } from "@/lib/modules/catalog/intervalo.service";
import { CanalTurno, EstadoTurno } from "@prisma/client";

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

  const proximosKm = await getProximosKmForTurno({
    detalles: turno.detalles,
    vehiculo: turno.vehiculo,
    turnoKilometraje: turno.kilometraje,
  });

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
            {format(turno.inicio, "HH:mm")} – {format(turno.finalizaEn, "HH:mm")}
          </p>
        </div>
        <TurnoStateDropdown
          turnoId={turno.id}
          version={turno.version}
          estado={turno.estado}
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
                <span className="text-slate-500">
                  {" "}
                  ({turno.vehiculo.tipoVehiculo}/{turno.vehiculo.condicion})
                </span>
              </dd>
            </div>
            {turno.kilometraje != null ? (
              <div>
                <dt className="text-slate-500">Km al turno</dt>
                <dd>{turno.kilometraje.toLocaleString("es-AR")} km</dd>
              </div>
            ) : null}
            {turno.vehiculo.kilometrajeActual != null ? (
              <div>
                <dt className="text-slate-500">Km actual vehículo</dt>
                <dd>{turno.vehiculo.kilometrajeActual.toLocaleString("es-AR")} km</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-slate-500">Bahía</dt>
              <dd>{turno.bahia.nombre} · {turno.taller.nombre}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Canal</dt>
              <dd>
                {CANAL_LABELS[turno.canal]}
                {turno.creador && turno.canal === CanalTurno.interno
                  ? ` · ${turno.creador.nombre}`
                  : ""}
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
          {proximosKm.length > 0 ? (
            <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-medium">Próximo servicio por km</p>
              <ul className="mt-1 space-y-1">
                {proximosKm.map((p) => (
                  <li key={p.servicio}>
                    {p.servicio}: {p.proximoKm.toLocaleString("es-AR")} km
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
