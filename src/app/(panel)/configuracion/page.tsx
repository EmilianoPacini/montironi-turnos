import { getAuthSession } from "@/lib/auth/session";
import { listTalleres } from "@/lib/modules/catalog/service";
import { saveConfigAction } from "@/lib/modules/appointments/actions";
import { AdminOnlyBanner } from "@/components/layout/AdminOnlyBanner";

export default async function ConfigPage() {
  const session = await getAuthSession();

  const talleres = await listTalleres(session.empresaId);

  return (
    <div className="p-6 lg:p-8">
      <AdminOnlyBanner />
      <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>

      <section className="mt-6 space-y-4">
        <h2 className="font-semibold">Margen entre turnos (por taller)</h2>
        {talleres.map((t) => (
          <form
            key={t.id}
            action={saveConfigAction}
            className="max-w-lg rounded-xl border bg-white p-5"
          >
            <input type="hidden" name="tallerId" value={t.id} />
            <h3 className="mb-3 font-medium">{t.nombre}</h3>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Margen (minutos)</span>
              <input
                name="margenMinutos"
                type="number"
                defaultValue={t.configuracion?.margenMinutos ?? 15}
                className="w-full rounded-lg border px-3 py-2"
              />
            </label>
            <button
              type="submit"
              className="btn-primary-lg mt-3"
            >
              Guardar
            </button>
          </form>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="mb-4 font-semibold">Talleres y bahías</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {talleres.map((t) => (
            <div key={t.id} className="rounded-xl border bg-white p-5">
              <h3 className="font-semibold">{t.nombre}</h3>
              <p className="text-sm text-slate-600">{t.direccion}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {t.bahias.map((b) => (
                  <li key={b.id} className="rounded bg-slate-50 px-2 py-1">
                    {b.nombre}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                Horario: Lun–Vie 08:00–12:00 y 13:00–18:00 · Margen{" "}
                {t.configuracion?.margenMinutos ?? 15} min
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
