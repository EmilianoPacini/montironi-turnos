import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { listTalleres, serviciosForTaller } from "@/lib/modules/catalog/service";
import { listClientes } from "@/lib/modules/customers/service";
import { getAvailabilityForDate } from "@/lib/modules/availability/service";
import { createTurnoAction } from "@/lib/modules/appointments/actions";
import { format, parseISO, startOfDay } from "date-fns";

export default async function NuevoTurnoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();

  const params = await searchParams;
  const talleres = await listTalleres(session.empresaId);
  const tallerId =
    (typeof params.tallerId === "string" ? params.tallerId : undefined) ??
    talleres[0]?.id;

  if (!tallerId) {
    return <div className="p-8">No hay talleres configurados.</div>;
  }

  const clientes = await listClientes(session.empresaId);
  const servicios = await serviciosForTaller(tallerId, session.empresaId);
  const bahiaId = typeof params.bahiaId === "string" ? params.bahiaId : undefined;
  const inicioParam = typeof params.inicio === "string" ? params.inicio : undefined;
  const date = inicioParam ? startOfDay(parseISO(inicioParam)) : startOfDay(new Date());

  const bahias = talleres.find((t) => t.id === tallerId)?.bahias ?? [];

  return (
    <div className="p-6 lg:p-8">
      <Link href="/agenda" className="text-sm text-slate-600 hover:text-slate-900">
        ← Volver a agenda
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Nuevo turno</h1>

      <form action={createTurnoAction} className="mt-6 max-w-2xl space-y-4">
        <input type="hidden" name="tallerId" value={tallerId} />

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Cliente</span>
          <select name="clienteId" required className="w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="">Seleccionar...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.apellido ?? ""} · {c.telefono ?? "sin tel"}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Vehículo</span>
          <select name="vehiculoId" required className="w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="">Seleccionar cliente primero</option>
            {clientes.flatMap((c) =>
              c.vehiculos.map((cv) => (
                <option key={cv.vehiculoId} value={cv.vehiculoId}>
                  {c.nombre}: {cv.vehiculo.patente}
                </option>
              ))
            )}
          </select>
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Servicios</legend>
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            {servicios.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="servicioIds" value={s.id} />
                {s.nombre} ({s.duracionMin} min)
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Bahía</span>
          <select
            name="bahiaId"
            required
            defaultValue={bahiaId}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {bahias.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Fecha y hora de inicio</span>
          <input
            type="datetime-local"
            name="inicio"
            required
            defaultValue={
              inicioParam
                ? format(parseISO(inicioParam), "yyyy-MM-dd'T'HH:mm")
                : format(new Date(), "yyyy-MM-dd'T'09:00")
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Notas</span>
          <textarea
            name="notas"
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="confirmar" value="true" />
          Confirmar inmediatamente
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Crear turno
          </button>
        </div>
      </form>

      <AvailabilityPreview
        empresaId={session.empresaId}
        tallerId={tallerId}
        date={date}
        servicioIds={servicios.slice(0, 1).map((s) => s.id)}
      />
    </div>
  );
}

async function AvailabilityPreview({
  empresaId,
  tallerId,
  date,
  servicioIds,
}: {
  empresaId: string;
  tallerId: string;
  date: Date;
  servicioIds: string[];
}) {
  if (servicioIds.length === 0) return null;

  const availability = await getAvailabilityForDate({
    empresaId,
    tallerId,
    date,
    servicioIds,
  });

  return (
    <div className="mt-8 max-w-2xl rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">
        Disponibilidad hoy (primer servicio)
      </h2>
      <div className="space-y-2 text-sm">
        {availability.map((b) => (
          <div key={b.bahiaId}>
            <p className="font-medium">{b.bahiaNombre}</p>
            <p className="text-slate-600">
              {b.slots.length > 0
                ? b.slots
                    .slice(0, 6)
                    .map((s) => format(s.inicio, "HH:mm"))
                    .join(", ")
                : "Sin slots libres"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
