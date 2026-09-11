import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { listTalleres, getConfiguracion } from "@/lib/modules/catalog/service";
import { saveConfigAction } from "@/lib/modules/appointments/actions";
import { RolUsuario } from "@prisma/client";

export default async function ConfigPage() {
  const session = await getAuthSession();
  
  if (session.rol !== RolUsuario.ADMIN) redirect("/agenda");

  const [talleres, config] = await Promise.all([
    listTalleres(session.empresaId),
    getConfiguracion(session.empresaId),
  ]);

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold">Configuración</h1>

      <section className="mt-6 max-w-lg rounded-xl border bg-white p-5">
        <h2 className="mb-4 font-semibold">Reglas de turnos</h2>
        <form action={saveConfigAction} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Margen entre turnos (minutos)</span>
            <input
              name="margenMin"
              type="number"
              defaultValue={config?.margenMin ?? 15}
              className="w-full rounded-lg border px-3 py-2"
            />
          </label>
          <button type="submit" className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white">
            Guardar
          </button>
        </form>
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
                  <li key={b.id} className="rounded bg-slate-50 px-2 py-1">{b.nombre}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">Horario: Lun–Vie 08:00–12:00 y 13:00–18:00</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
