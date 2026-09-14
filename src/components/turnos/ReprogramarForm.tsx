"use client";

import { useActionState, useEffect, useState } from "react";
import {
  rescheduleTurnoAction,
  type ReprogramarFormState,
  type ReprogramarFormValues,
} from "@/lib/modules/appointments/actions";
import { FormError } from "@/components/ui/FormError";
import { DateTimeClockField } from "@/components/ui/DateTimeClockField";
import { useFormFieldErrors } from "@/components/ui/use-form-field-errors";

type BahiaOption = { id: string; nombre: string };

export function ReprogramarForm({
  turnoId,
  version,
  defaultBahiaId,
  defaultInicio,
  bahias,
}: {
  turnoId: string;
  version: number;
  defaultBahiaId: string;
  defaultInicio: string;
  bahias: BahiaOption[];
}) {
  const [state, formAction, pending] = useActionState(
    rescheduleTurnoAction,
    undefined as ReprogramarFormState | undefined
  );
  const [fields, setFields] = useState<ReprogramarFormValues>({
    bahiaId: defaultBahiaId,
    inicio: defaultInicio,
  });
  const { fieldClass, FieldErrorMessage } = useFormFieldErrors(state);

  useEffect(() => {
    if (state?.values) {
      setFields(state.values);
    }
  }, [state?.formKey]);

  return (
    <form action={formAction} className="mt-6 max-w-xl space-y-4">
      <FormError message={state?.error} />
      <input type="hidden" name="turnoId" value={turnoId} />
      <input type="hidden" name="version" value={version} />

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Bahía</span>
        <select
          name="bahiaId"
          data-field="bahiaId"
          value={fields.bahiaId}
          onChange={(e) => setFields((prev) => ({ ...prev, bahiaId: e.target.value }))}
          className={fieldClass("bahiaId", "w-full rounded-lg border px-3 py-2")}
        >
          <option value="">
            Automático — asignar si hay exactamente una bahía compatible libre
          </option>
          {bahias.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
        <FieldErrorMessage field="bahiaId" />
        <p className="mt-1 text-xs text-slate-500">
          Selección manual siempre permitida. Automático solo cuando hay una bahía libre.
        </p>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Nuevo inicio</span>
        <DateTimeClockField
          name="inicio"
          required
          data-field="inicio"
          value={fields.inicio}
          onChange={(inicio) => setFields((prev) => ({ ...prev, inicio }))}
          className={fieldClass("inicio", "rounded-lg")}
        />
        <FieldErrorMessage field="inicio" />
      </label>

      <button type="submit" disabled={pending} className="btn-primary-lg">
        {pending ? "Reprogramando..." : "Reprogramar"}
      </button>
    </form>
  );
}
