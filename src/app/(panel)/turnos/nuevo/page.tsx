import Link from "next/link";
import { getAuthSession } from "@/lib/auth/session";
import { listTalleres, serviciosForTaller } from "@/lib/modules/catalog/service";
import { listClientes } from "@/lib/modules/customers/service";
import { getAvailabilityForDate, getCompatibleBahias } from "@/lib/modules/availability/service";
import { NuevoTurnoForm } from "@/components/turnos/NuevoTurnoForm";
import { AvailabilitySlotsPanel } from "@/components/turnos/AvailabilitySlotsPanel";
import { mapServicioForClient } from "@/lib/serialize-for-client";
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

  const compatibleBahias = await getCompatibleBahias(
    tallerId,
    servicios.map((s) => s.id)
  );

  const servicioIds = servicios.slice(0, 1).map((s) => s.id);
  const availability =
    servicioIds.length > 0
      ? await getAvailabilityForDate({
          empresaId: session.empresaId,
          tallerId,
          date,
          servicioIds,
        })
      : [];

  return (
    <div className="p-6 lg:p-8">
      <Link href="/agenda" className="text-sm text-slate-600 hover:text-slate-900">
        ← Volver a agenda
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Nuevo turno</h1>

      <NuevoTurnoForm
        tallerId={tallerId}
        clientes={clientes}
        servicios={servicios.map(mapServicioForClient)}
        compatibleBahias={compatibleBahias}
        defaultBahiaId={bahiaId}
        defaultInicio={inicioParam}
      />

      <AvailabilitySlotsPanel
        availability={availability}
        title="Disponibilidad hoy (primer servicio)"
        maxSlotsPerBahia={6}
      />
    </div>
  );
}
