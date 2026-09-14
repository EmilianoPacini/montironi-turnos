import { CondicionVehiculo, TipoVehiculo } from "@prisma/client";
import {
  CONDICION_VEHICULO_LABELS,
  TIPO_VEHICULO_LABELS,
} from "@/lib/modules/customers/vehiculo-labels";

export function IntervaloKmFields({
  defaultTipoVehiculo = TipoVehiculo.auto,
  defaultCondicion = CondicionVehiculo.nuevo,
  defaultIntervaloKm = 10000,
  layout = "stack",
}: {
  defaultTipoVehiculo?: TipoVehiculo;
  defaultCondicion?: CondicionVehiculo;
  defaultIntervaloKm?: number;
  layout?: "stack" | "inline";
}) {
  const tipoSelect = (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">Tipo vehículo</span>
      <select
        name="tipoVehiculo"
        defaultValue={defaultTipoVehiculo}
        className="w-full rounded-lg border px-3 py-2"
      >
        {(Object.keys(TIPO_VEHICULO_LABELS) as TipoVehiculo[]).map((value) => (
          <option key={value} value={value}>
            {TIPO_VEHICULO_LABELS[value]}
          </option>
        ))}
      </select>
    </label>
  );

  const condicionSelect = (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">Condición</span>
      <select
        name="condicion"
        defaultValue={defaultCondicion}
        className="w-full rounded-lg border px-3 py-2"
      >
        {(Object.keys(CONDICION_VEHICULO_LABELS) as CondicionVehiculo[]).map((value) => (
          <option key={value} value={value}>
            {CONDICION_VEHICULO_LABELS[value]}
          </option>
        ))}
      </select>
    </label>
  );

  const kmInput = (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">Intervalo (km)</span>
      <input
        name="intervaloKm"
        type="number"
        required
        min={1}
        defaultValue={defaultIntervaloKm}
        className="w-full rounded-lg border px-3 py-2"
      />
    </label>
  );

  if (layout === "inline") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {tipoSelect}
        {condicionSelect}
        {kmInput}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {tipoSelect}
        {condicionSelect}
      </div>
      {kmInput}
    </>
  );
}
