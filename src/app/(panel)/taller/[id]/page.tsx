import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { getTaller } from "@/lib/modules/catalog/service";
import { horarioParaEditor } from "@/lib/modules/catalog/taller.service";
import { AdminOnlyBanner } from "@/components/layout/AdminOnlyBanner";
import { FormError } from "@/components/ui/FormError";
import { UpdateTallerForm } from "@/components/taller/UpdateTallerForm";
import { TallerHorarioForm } from "@/components/taller/TallerHorarioForm";
import { TallerExcepcionForm } from "@/components/taller/TallerExcepcionForm";
import Link from "next/link";

export default async function TallerEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  const { id } = await params;
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;
  const ok = typeof query.ok === "string" ? query.ok : undefined;

  const taller = await getTaller(id, session.empresaId);
  if (!taller) notFound();

  const horario = await horarioParaEditor(taller.id);

  return (
    <div className="panel-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm">
            <Link href="/taller" className="text-blue-700 underline">
              ← Talleres
            </Link>
          </p>
          <h1 className="panel-title mt-2">{taller.nombre}</h1>
          <p className="mt-1 text-sm">
            <Link href={`/bahias?tallerId=${taller.id}`} className="text-blue-700 underline">
              Bahías de este taller
            </Link>
          </p>
        </div>
        <AdminOnlyBanner compact />
      </div>
      {error ? (
        <div className="mt-4">
          <FormError message={error} />
        </div>
      ) : null}
      {ok ? (
        <p className="mt-4 text-sm text-emerald-700">Cambios guardados ({ok}).</p>
      ) : null}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <UpdateTallerForm
          tallerId={taller.id}
          nombre={taller.nombre}
          activo={taller.activo}
          calle={taller.calle}
          numero={taller.numero}
          localidad={taller.localidad}
          provincia={taller.provincia}
          codigoPostal={taller.codigoPostal}
          direccionLegacy={taller.direccion}
          margenMinutos={taller.configuracion?.margenMinutos}
          intervaloInicioMinutos={taller.configuracion?.intervaloInicioMinutos}
          anticipacionMinimaHoras={taller.configuracion?.anticipacionMinimaHoras}
          anticipacionMaximaDias={taller.configuracion?.anticipacionMaximaDias}
          permiteCancelacion={taller.configuracion?.permiteCancelacion}
          horasLimiteCancelacion={taller.configuracion?.horasLimiteCancelacion}
        />

        <section className="rounded-xl border bg-slate-50 p-5">
          <h2 className="mb-3 font-semibold">Días y horarios (diferidos)</h2>
          <TallerHorarioForm tallerId={taller.id} horario={horario} />
        </section>

        <section className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Excepciones cargadas</h2>
          {taller.excepciones.length === 0 ? (
            <p className="text-sm text-slate-500">Ninguna excepción todavía.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {taller.excepciones.map((ex) => (
                <li key={ex.id}>
                  {ex.fecha.toISOString().slice(0, 10)} ·{" "}
                  {ex.tipo === "cerrado" ? "Cerrado" : "Horario especial"}
                  {ex.motivo ? ` · ${ex.motivo}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <TallerExcepcionForm tallerId={taller.id} />
      </div>
    </div>
  );
}
