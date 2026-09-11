import Link from "next/link";
import { getAuthSession } from "@/lib/auth/session";
import { listTalleres, serviciosForTaller } from "@/lib/modules/catalog/service";
import { listClientes } from "@/lib/modules/customers/service";
import { getAvailabilityForDate, getCompatibleBahias } from "@/lib/modules/availability/service";
import { NuevoTurnoForm } from "@/components/turnos/NuevoTurnoForm";
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
  const error = typeof params.error === "string" ? params.error : undefined;
  const date = inicioParam ? startOfDay(parseISO(inicioParam)) : startOfDay(new Date());

  const compatibleBahias = await getCompatibleBahias(
    tallerId,
    servicios.map((s) => s.id)
  );

  return (
    <div className="p-6 lg:p-8">
      <Link href="/agenda" className="text-sm text-slate-600 hover:text-slate-900">
        ← Volver a agenda
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Nuevo turno</h1>

      <NuevoTurnoForm
        tallerId={tallerId}
        clientes={clientes}
        servicios={servicios}
        compatibleBahias={compatibleBahias}
        defaultBahiaId={bahiaId}
        defaultInicio={inicioParam}
        error={error}
      />

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
