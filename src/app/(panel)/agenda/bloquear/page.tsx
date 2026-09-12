import Link from "next/link";
import { parseISO, startOfDay, addHours } from "date-fns";
import { getAuthSession } from "@/lib/auth/session";
import { listTalleres } from "@/lib/modules/catalog/service";
import { BloquearForm } from "@/components/agenda/BloquearForm";

export default async function BloquearPage({
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
  const dateStr =
    typeof params.fecha === "string" ? params.fecha : new Date().toISOString().slice(0, 10);
  const date = startOfDay(parseISO(dateStr));
  const bahias = talleres.find((t) => t.id === tallerId)?.bahias ?? [];
  const defaultBahiaId =
    typeof params.bahiaId === "string" ? params.bahiaId : bahias[0]?.id ?? "";

  const inicioDefault = addHours(date, 12).toISOString().slice(0, 16);
  const finDefault = addHours(date, 13).toISOString().slice(0, 16);

  return (
    <div className="p-6 lg:p-8">
      <Link href="/agenda" className="text-sm text-slate-600 hover:text-slate-900">
        ← Volver a agenda
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Bloquear bahía</h1>
      <p className="mt-1 text-sm text-slate-600">
        Crea una ocupación tipo bloqueo (sin turno ficticio). Los solapamientos activos se
        rechazan.
      </p>

      <BloquearForm
        bahias={bahias}
        defaultBahiaId={defaultBahiaId}
        defaultInicio={inicioDefault}
        defaultFin={finDefault}
      />
    </div>
  );
}
