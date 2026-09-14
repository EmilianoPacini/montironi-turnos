import { getAuthSession } from "@/lib/auth/session";
import { listServiciosConIntervalos, listTiposServicio } from "@/lib/modules/catalog/service";
import { saveServicioAction, saveIntervaloAction } from "@/lib/modules/appointments/actions";
import { AdminOnlyBanner } from "@/components/layout/AdminOnlyBanner";
import { FormError } from "@/components/ui/FormError";
import { ServiciosCatalogTable } from "@/components/servicios/ServiciosCatalogTable";
import { IntervaloKmFields } from "@/components/servicios/IntervaloKmFields";
import { IntervaloSubmitButton } from "@/components/servicios/IntervaloSubmitButton";
import { mapServicioCatalogForClient } from "@/lib/serialize-for-client";

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const detalle =
    typeof params.detalle === "string" && params.detalle.length > 0
      ? params.detalle
      : undefined;

  const [servicios, tipos] = await Promise.all([
    listServiciosConIntervalos(session.empresaId),
    listTiposServicio(session.empresaId),
  ]);

  const catalogo = servicios.map(mapServicioCatalogForClient);

  return (
    <div className="p-6 lg:p-8">
      <AdminOnlyBanner />
      <h1 className="text-2xl font-bold text-slate-900">Catálogo de servicios</h1>
      {error ? (
        <div className="mt-4">
          <FormError message={error} />
        </div>
      ) : null}

      <div className="mt-6">
        <ServiciosCatalogTable servicios={catalogo} openServicioId={detalle} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
        <form
          action={saveServicioAction}
          className="space-y-4 rounded-xl border bg-slate-50 p-5"
        >
          <h2 className="font-semibold">Agregar servicio</h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tipo</span>
            <select name="tipoServicioId" required className="w-full rounded-lg border px-3 py-2">
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nombre</span>
            <input name="nombre" required className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Descripción</span>
            <input name="descripcion" className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Duración (min)</span>
            <input
              name="duracionMin"
              type="number"
              required
              defaultValue={60}
              className="w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Modo de precio</span>
            <select name="modoPrecio" defaultValue="fijo" className="w-full rounded-lg border px-3 py-2">
              <option value="fijo">Precio fijo</option>
              <option value="desde">Desde</option>
              <option value="a_presupuestar">A presupuestar</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Precio</span>
            <input
              name="precio"
              type="number"
              required
              defaultValue={100000}
              className="w-full rounded-lg border px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="btn-primary-lg"
          >
            Crear servicio
          </button>
        </form>

        <form
          action={saveIntervaloAction}
          className="space-y-4 rounded-xl border bg-slate-50 p-5"
        >
          <h2 className="font-semibold">Intervalo km por servicio</h2>
          <p className="text-sm text-slate-600">
            Define cada cuántos km corresponde el próximo service, según tipo y condición del vehículo.
            Si la combinación ya existe, se actualiza en la base.
          </p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Servicio</span>
            <select name="servicioId" required className="w-full rounded-lg border px-3 py-2">
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </label>
          <IntervaloKmFields />
          <IntervaloSubmitButton>Guardar intervalo</IntervaloSubmitButton>
        </form>
      </div>
    </div>
  );
}
