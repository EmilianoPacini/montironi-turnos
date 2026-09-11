"use client";

import { useActionState } from "react";
import { VehiculoFields } from "@/components/clientes/VehiculoFields";
import { FormError } from "@/components/ui/FormError";
import {
  saveVehiculoAction,
  type VehiculoFormState,
} from "@/lib/modules/appointments/actions";
import type { CondicionVehiculo, TipoVehiculo, Vehiculo } from "@prisma/client";

type VehiculoFormProps = {
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
  clienteId,
  vehiculo,
  submitLabel = "Guardar vehículo",
  cancelHref,
}: VehiculoFormProps) {
  const [state, formAction, pending] = useActionState(
    saveVehiculoAction,
    undefined as VehiculoFormState | undefined
  );
  const values = state?.values;
  const formKey = state?.formKey ?? "initial";

  const fieldValues = {
    patente: values?.patente ?? vehiculo?.patente ?? "",
    marca: values?.marca ?? vehiculo?.marca ?? "",
    modelo: values?.modelo ?? vehiculo?.modelo ?? "",
    tipoVehiculo: (values?.tipoVehiculo ?? vehiculo?.tipoVehiculo ?? "auto") as TipoVehiculo,
    condicion: (values?.condicion ?? vehiculo?.condicion ?? "normal") as CondicionVehiculo,
    kilometrajeActual:
      values?.kilometrajeActual ??
      (vehiculo?.kilometrajeActual != null ? String(vehiculo.kilometrajeActual) : ""),
    anio: values?.anio ?? (vehiculo?.anio != null ? String(vehiculo.anio) : ""),
    color: values?.color ?? vehiculo?.color ?? "",
  };

  return (
    <form
      key={formKey}
      action={formAction}
      className="panel-card max-w-xl space-y-4 p-6"
    >
      <FormError message={state?.error} />
      <input type="hidden" name="clienteId" value={clienteId} />
      <VehiculoFields
        defaultValues={{
          patente: fieldValues.patente,
          marca: fieldValues.marca,
          modelo: fieldValues.modelo,
          tipoVehiculo: fieldValues.tipoVehiculo,
          condicion: fieldValues.condicion,
          kilometrajeActual: fieldValues.kilometrajeActual
            ? Number(fieldValues.kilometrajeActual)
            : undefined,
        }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Año</span>
          <input
            name="anio"
            type="number"
            min={1900}
            max={2100}
            defaultValue={fieldValues.anio || undefined}
            className="input-field"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Color</span>
          <input
            name="color"
            defaultValue={fieldValues.color}
            className="input-field"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3 pt-2">
        <button type="submit" disabled={pending} className="btn-primary-lg">
          {pending ? "Guardando..." : submitLabel}
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
