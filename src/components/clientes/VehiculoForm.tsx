"use client";

import { useActionState, useEffect, useState } from "react";
import { VehiculoFields } from "@/components/clientes/VehiculoFields";
import { FormError } from "@/components/ui/FormError";
import { useFormFieldErrors } from "@/components/ui/use-form-field-errors";
import {
  saveVehiculoAction,
  type VehiculoFormState,
  type VehiculoFormValues,
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

function initialVehiculoFields(vehiculo?: VehiculoFormProps["vehiculo"]): VehiculoFormValues {
  return {
    patente: vehiculo?.patente ?? "",
    marca: vehiculo?.marca ?? "",
    modelo: vehiculo?.modelo ?? "",
    tipoVehiculo: vehiculo?.tipoVehiculo ?? "auto",
    condicion: vehiculo?.condicion ?? "normal",
    kilometrajeActual:
      vehiculo?.kilometrajeActual != null ? String(vehiculo.kilometrajeActual) : "",
    anio: vehiculo?.anio != null ? String(vehiculo.anio) : "",
    color: vehiculo?.color ?? "",
  };
}

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
  const [fields, setFields] = useState(() => initialVehiculoFields(vehiculo));
  const { fieldClass, FieldErrorMessage } = useFormFieldErrors(state);

  useEffect(() => {
    if (state?.values) {
      setFields(state.values);
    }
  }, [state?.formKey]);

  function updateField<K extends keyof VehiculoFormValues>(
    key: K,
    value: VehiculoFormValues[K]
  ) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="panel-card max-w-xl space-y-4 p-6">
      <FormError message={state?.error} />
      <input type="hidden" name="clienteId" value={clienteId} />
      <VehiculoFields
        values={{
          patente: fields.patente,
          marca: fields.marca,
          modelo: fields.modelo,
          tipoVehiculo: fields.tipoVehiculo,
          condicion: fields.condicion,
          kilometrajeActual: fields.kilometrajeActual,
        }}
        onChange={(field, value) => {
          if (field === "tipoVehiculo") {
            updateField("tipoVehiculo", value as TipoVehiculo);
            return;
          }
          if (field === "condicion") {
            updateField("condicion", value as CondicionVehiculo);
            return;
          }
          updateField(field, value);
        }}
        fieldErrors={state?.fieldErrors}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Año</span>
          <input
            name="anio"
            type="number"
            min={1900}
            max={2100}
            data-field="anio"
            value={fields.anio}
            onChange={(e) => updateField("anio", e.target.value)}
            className={fieldClass("anio", "input-field")}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Color</span>
          <input
            name="color"
            data-field="color"
            value={fields.color}
            onChange={(e) => updateField("color", e.target.value)}
            className={fieldClass("color", "input-field")}
          />
        </label>
      </div>
      <FieldErrorMessage field="anio" />
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
