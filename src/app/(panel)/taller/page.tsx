import { getAuthSession } from "@/lib/auth/session";
import { listTalleresAdmin, defaultHorarioSemanal } from "@/lib/modules/catalog/taller.service";
import { AdminOnlyBanner } from "@/components/layout/AdminOnlyBanner";
import { FormError } from "@/components/ui/FormError";
import { CrearTallerForm } from "@/components/taller/CrearTallerForm";
import { displayDireccion } from "@/lib/modules/catalog/direccion";
import Link from "next/link";

export default async function TallerListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const talleres = await listTalleresAdmin(session.empresaId);

  return (
    <div className="panel-page flex min-h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="panel-title">Talleres</h1>
          <p className="panel-subtitle">
            Lo que configures acá es lo que el bot usa para ofrecer sucursal u horario.
          </p>
        </div>
        <AdminOnlyBanner compact />
      </div>
      {error ? (
        <div className="mt-4">
          <FormError message={error} />
        </div>
      ) : null}

      <div className="mt-6 grid flex-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,34rem)]">
        <section className="min-w-0">
          {talleres.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">
              Todavía no hay talleres. Completá el formulario de la derecha para crear el primero.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
              {talleres.map((t) => (
                <Link
                  key={t.id}
                  href={`/taller/${t.id}`}
                  className="rounded-xl border bg-white p-5 transition hover:border-blue-300"
                >
                  <h2 className="font-semibold text-slate-900">{t.nombre}</h2>
                  <p className="text-sm text-slate-600">{displayDireccion(t) ?? "Sin dirección"}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {t.activo ? "Activo" : "Inactivo"} · {t.bahias.length} bahía(s)
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <CrearTallerForm horarioAlta={defaultHorarioSemanal()} />
      </div>
    </div>
  );
}
