import Link from "next/link";
import { redirect } from "next/navigation";
import { parseISO, startOfDay, addHours } from "date-fns";
import { getAuthSession } from "@/lib/auth/session";
import { listTalleres } from "@/lib/modules/catalog/service";
import { blockBahiaAction } from "@/lib/modules/appointments/actions";
import { FormError } from "@/components/ui/FormError";

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
  const error = typeof params.error === "string" ? params.error : undefined;

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

      <FormError message={error} />

      <form action={blockBahiaAction} className="mt-6 max-w-md space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Bahía</span>
          <select name="bahiaId" required className="w-full rounded-lg border px-3 py-2">
            {bahias.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Inicio</span>
          <input
            type="datetime-local"
            name="inicio"
            required
            defaultValue={inicioDefault}
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Fin</span>
          <input
            type="datetime-local"
            name="fin"
            required
            defaultValue={finDefault}
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Motivo</span>
          <input name="motivo" required className="w-full rounded-lg border px-3 py-2" />
        </label>
        <button type="submit" className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white">
          Bloquear
        </button>
      </form>
    </div>
  );
}
