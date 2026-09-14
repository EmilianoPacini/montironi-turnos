"use client";

import { useActionState, useEffect, useState } from "react";
import {
  blockBahiaAction,
  type BloquearFormState,
  type BloquearFormValues,
} from "@/lib/modules/appointments/actions";
import { FormError } from "@/components/ui/FormError";
import { DateTimeClockField } from "@/components/ui/DateTimeClockField";
import { useFormFieldErrors } from "@/components/ui/use-form-field-errors";

type BahiaOption = { id: string; nombre: string };

export function BloquearForm({
  bahias,
  defaultBahiaId,
  defaultInicio,
  defaultFin,
}: {
  bahias: BahiaOption[];
  defaultBahiaId: string;
  defaultInicio: string;
  defaultFin: string;
}) {
  const [state, formAction, pending] = useActionState(
    blockBahiaAction,
    undefined as BloquearFormState | undefined
  );
  const [fields, setFields] = useState<BloquearFormValues>({
    bahiaId: defaultBahiaId || bahias[0]?.id || "",
    inicio: defaultInicio,
    fin: defaultFin,
    motivo: "",
  });
  const { fieldClass, FieldErrorMessage } = useFormFieldErrors(state);

  useEffect(() => {
    if (state?.values) {
      setFields(state.values);
    }
  }, [state?.formKey]);

  return (
    <form action={formAction} className="mt-6 max-w-md space-y-4">
      <FormError message={state?.error} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Bahía</span>
        <select
          name="bahiaId"
          required
          data-field="bahiaId"
          value={fields.bahiaId}
          onChange={(e) => setFields((prev) => ({ ...prev, bahiaId: e.target.value }))}
          className={fieldClass("bahiaId", "w-full rounded-lg border px-3 py-2")}
        >
          {bahias.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Inicio</span>
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
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Fin</span>
        <DateTimeClockField
          name="fin"
          required
          data-field="fin"
          value={fields.fin}
          onChange={(fin) => setFields((prev) => ({ ...prev, fin }))}
          className={fieldClass("fin", "rounded-lg")}
        />
        <FieldErrorMessage field="fin" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Motivo</span>
        <input
          name="motivo"
          required
          data-field="motivo"
          value={fields.motivo}
          onChange={(e) => setFields((prev) => ({ ...prev, motivo: e.target.value }))}
          className={fieldClass("motivo", "w-full rounded-lg border px-3 py-2")}
        />
        <FieldErrorMessage field="motivo" />
      </label>
      <button type="submit" disabled={pending} className="btn-primary-lg">
        {pending ? "Bloqueando..." : "Bloquear"}
      </button>
    </form>
  );
}
