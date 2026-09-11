import { CondicionVehiculo, TipoVehiculo } from "@prisma/client";

type VehiculoFieldValues = {
  patente?: string;
  marca?: string;
  modelo?: string;
  tipoVehiculo?: TipoVehiculo;
  condicion?: CondicionVehiculo;
  kilometrajeActual?: number | null;
};

export function VehiculoFields({
  prefix = "",
  defaultValues,
}: {
  prefix?: string;
  defaultValues?: VehiculoFieldValues;
}) {
  const p = prefix ? `${prefix}_` : "";

  return (
    <>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Patente *</span>
        <input
          name={`${p}patente`}
          required
          defaultValue={defaultValues?.patente ?? ""}
          className="input-field uppercase"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Marca</span>
          <input
            name={`${p}marca`}
            defaultValue={defaultValues?.marca ?? ""}
            className="input-field"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Modelo</span>
          <input
            name={`${p}modelo`}
            defaultValue={defaultValues?.modelo ?? ""}
            className="input-field"
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Tipo</span>
          <select
            name={`${p}tipoVehiculo`}
            defaultValue={defaultValues?.tipoVehiculo ?? "auto"}
            className="input-field"
          >
            <option value="auto">Auto</option>
            <option value="camioneta">Camioneta</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Condición</span>
          <select
            name={`${p}condicion`}
            defaultValue={defaultValues?.condicion ?? "normal"}
            className="input-field"
          >
            <option value="nuevo">Nuevo</option>
            <option value="normal">Normal</option>
            <option value="viejo">Viejo</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Km actual</span>
          <input
            name={`${p}kilometrajeActual`}
            type="number"
            min={0}
            defaultValue={defaultValues?.kilometrajeActual ?? undefined}
            className="input-field"
          />
        </label>
      </div>
    </>
  );
}
