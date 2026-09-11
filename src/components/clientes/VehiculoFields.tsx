export function VehiculoFields({ prefix = "" }: { prefix?: string }) {
  const p = prefix ? `${prefix}_` : "";
  return (
    <>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Patente *</span>
        <input name={`${p}patente`} required className="w-full rounded-lg border px-3 py-2 uppercase" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Marca</span>
          <input name={`${p}marca`} className="w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Modelo</span>
          <input name={`${p}modelo`} className="w-full rounded-lg border px-3 py-2" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Tipo</span>
          <select name={`${p}tipoVehiculo`} defaultValue="auto" className="w-full rounded-lg border px-3 py-2">
            <option value="auto">Auto</option>
            <option value="camioneta">Camioneta</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Condición</span>
          <select name={`${p}condicion`} defaultValue="normal" className="w-full rounded-lg border px-3 py-2">
            <option value="nuevo">Nuevo</option>
            <option value="normal">Normal</option>
            <option value="viejo">Viejo</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Km actual</span>
          <input name={`${p}kilometrajeActual`} type="number" min={0} className="w-full rounded-lg border px-3 py-2" />
        </label>
      </div>
    </>
  );
}
