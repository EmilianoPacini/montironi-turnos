import { VehiculoFields } from "@/components/clientes/VehiculoFields";
import type { Vehiculo } from "@prisma/client";

type VehiculoFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  clienteId: string;
  vehiculo?: Pick<
    Vehiculo,
    | "patente"
    | "marca"
    | "modelo"
    | "anio"
    | "color"
    | "tipoVehiculo"
    | "condicion"
    | "kilometrajeActual"
  >;
  submitLabel?: string;
  cancelHref?: string;
};

export function VehiculoForm({
  action,
  clienteId,
  vehiculo,
  submitLabel = "Guardar vehículo",
  cancelHref,
}: VehiculoFormProps) {
  return (
    <form action={action} className="panel-card max-w-xl space-y-4 p-6">
      <input type="hidden" name="clienteId" value={clienteId} />
      <VehiculoFields
        defaultValues={
          vehiculo
            ? {
                patente: vehiculo.patente,
                marca: vehiculo.marca ?? "",
                modelo: vehiculo.modelo ?? "",
                tipoVehiculo: vehiculo.tipoVehiculo,
                condicion: vehiculo.condicion,
                kilometrajeActual: vehiculo.kilometrajeActual,
              }
            : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Año</span>
          <input
            name="anio"
            type="number"
            min={1900}
            max={2100}
            defaultValue={vehiculo?.anio ?? undefined}
            className="input-field"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Color</span>
          <input
            name="color"
            defaultValue={vehiculo?.color ?? ""}
            className="input-field"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3 pt-2">
        <button type="submit" className="btn-primary-lg">
          {submitLabel}
        </button>
        {cancelHref ? (
          <a
            href={cancelHref}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Cancelar
          </a>
        ) : null}
      </div>
    </form>
  );
}
