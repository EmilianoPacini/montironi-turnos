import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getAuthSession } from "@/lib/auth/session";
import { getTurnoById } from "@/lib/modules/appointments/service";
import { listTalleres } from "@/lib/modules/catalog/service";
import { getAvailabilityForDate } from "@/lib/modules/availability/service";
import { isActiveEstado } from "@/lib/modules/appointments/constants";
import { AvailabilitySlotsPanel } from "@/components/turnos/AvailabilitySlotsPanel";
import { ReprogramarForm } from "@/components/turnos/ReprogramarForm";

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
        {format(turno.finalizaEn, "HH:mm")} · {turno.bahia.nombre}
      </p>
      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Si hay conflicto, se mantiene el horario anterior.
      </p>

      <ReprogramarForm
        turnoId={turno.id}
        version={turno.version}
        defaultBahiaId={turno.bahiaId}
        defaultInicio={format(turno.inicio, "yyyy-MM-dd'T'HH:mm")}
        bahias={bahias}
      />

      <AvailabilitySlotsPanel
        availability={availability}
        title="Slots disponibles"
        variant="compact"
        emptySlotsLabel="Sin disponibilidad"
      />
    </div>
  );
}
