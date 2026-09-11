import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { getAuthSession } from "@/lib/auth/session";
import { getTurnoById } from "@/lib/modules/appointments/service";
import { listTalleres } from "@/lib/modules/catalog/service";
import { getAvailabilityForDate } from "@/lib/modules/availability/service";
import { rescheduleTurnoAction } from "@/lib/modules/appointments/actions";
import { isActiveEstado } from "@/lib/modules/appointments/constants";

export default async function ReprogramarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();

  const { id } = await params;
  const turno = await getTurnoById(id, session.empresaId);
  if (!turno || !isActiveEstado(turno.estado)) notFound();

  const talleres = await listTalleres(session.empresaId);
  const bahias = talleres.find((t) => t.id === turno.tallerId)?.bahias ?? [];
  const servicioIds = turno.detalles.map((d) => d.servicioId);

  const availability = await getAvailabilityForDate({
    empresaId: session.empresaId,
    tallerId: turno.tallerId,
    date: turno.inicio,
    servicioIds,
  });

  return (
    <div className="p-6 lg:p-8">
      <Link href={`/turnos/${turno.id}`} className="text-sm text-slate-600 hover:text-slate-900">
        ← Volver al turno
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Reprogramar turno</h1>
      <p className="mt-1 text-sm text-slate-600">
        Horario actual: {format(turno.inicio, "dd/MM/yyyy HH:mm")} –{" "}
        {format(turno.fin, "HH:mm")} · {turno.bahia.nombre}
      </p>
      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Si hay conflicto, se mantiene el horario anterior.
      </p>

      <form action={rescheduleTurnoAction} className="mt-6 max-w-xl space-y-4">
        <input type="hidden" name="turnoId" value={turno.id} />
        <input type="hidden" name="version" value={turno.version} />

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Bahía</span>
          <select name="bahiaId" defaultValue={turno.bahiaId} className="w-full rounded-lg border px-3 py-2">
            {bahias.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nuevo inicio</span>
          <input
            type="datetime-local"
            name="inicio"
            required
            defaultValue={format(turno.inicio, "yyyy-MM-dd'T'HH:mm")}
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Reprogramar
        </button>
      </form>

      <div className="mt-8 max-w-xl">
        <h2 className="mb-3 font-semibold">Slots disponibles</h2>
        {availability.map((b) => (
          <div key={b.bahiaId} className="mb-3 rounded-lg border bg-white p-3">
            <p className="font-medium">{b.bahiaNombre}</p>
            <p className="text-sm text-slate-600">
              {b.slots.map((s) => format(s.inicio, "HH:mm")).join(" · ") || "Sin disponibilidad"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
