import { getAuthSession } from "@/lib/auth/session";
import { listServicios, listTiposServicio } from "@/lib/modules/catalog/service";
import { saveServicioAction, saveIntervaloAction } from "@/lib/modules/appointments/actions";
import { AdminOnlyBanner } from "@/components/layout/AdminOnlyBanner";

export default async function ServiciosPage() {
  const session = await getAuthSession();

  const [servicios, tipos] = await Promise.all([
    listServicios(session.empresaId),
    listTiposServicio(session.empresaId),
  ]);

  return (
    <div className="p-6 lg:p-8">
      <AdminOnlyBanner />
      <h1 className="text-2xl font-bold text-slate-900">Catálogo de servicios</h1>

      <div className="mt-6 overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Servicio</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Duración</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Modo</th>
            </tr>
          </thead>
          <tbody>
            {servicios.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3 font-medium">{s.nombre}</td>
                <td className="px-4 py-3">{s.tipoServicio.nombre}</td>
                <td className="px-4 py-3">{s.duracionMin} min</td>
                <td className="px-4 py-3">${Number(s.precio).toLocaleString("es-AR")}</td>
                <td className="px-4 py-3 capitalize">{s.modoPrecio.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        action={saveServicioAction}
        className="mt-8 max-w-lg space-y-4 rounded-xl border bg-slate-50 p-5"
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
        className="mt-8 max-w-lg space-y-4 rounded-xl border bg-slate-50 p-5"
      >
        <h2 className="font-semibold">Intervalo km por servicio</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Servicio</span>
          <select name="servicioId" required className="w-full rounded-lg border px-3 py-2">
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tipo vehículo</span>
            <select name="tipoVehiculo" className="w-full rounded-lg border px-3 py-2">
              <option value="auto">Auto</option>
              <option value="camioneta">Camioneta</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Condición</span>
            <select name="condicion" className="w-full rounded-lg border px-3 py-2">
              <option value="nuevo">Nuevo</option>
              <option value="normal">Normal</option>
              <option value="viejo">Viejo</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Intervalo (km)</span>
          <input name="intervaloKm" type="number" required min={1} defaultValue={10000} className="w-full rounded-lg border px-3 py-2" />
        </label>
        <button type="submit" className="btn-primary-lg">
          Guardar intervalo
        </button>
      </form>
    </div>
  );
}
