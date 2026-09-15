"use client";

import { useActionState, useEffect, useState } from "react";
import {
  saveClienteAction,
  type ClienteFormState,
  type ClienteFormValues,
} from "@/lib/modules/appointments/actions";
import { ClienteCoreFields } from "@/components/clientes/ClienteCoreFields";
import { FormError } from "@/components/ui/FormError";
import { useFormFieldErrors } from "@/components/ui/use-form-field-errors";

type ClienteFormCliente = {
  id: string;
  nombre: string;
  apellido?: string | null;
  email?: string | null;
  telefono?: string | null;
  documento?: string | null;
  notas?: string | null;
};

function initialClienteFields(cliente?: ClienteFormCliente): ClienteFormValues {
  return {
    nombre: cliente?.nombre ?? "",
    apellido: cliente?.apellido ?? "",
    telefono: cliente?.telefono ?? "",
    documento: cliente?.documento ?? "",
    patente: "",
    email: cliente?.email ?? "",
    notas: cliente?.notas ?? "",
  };
}

export function ClienteForm({
  cliente,
}: {
  cliente?: ClienteFormCliente;
}) {
  const isNew = !cliente;
  const [state, formAction, pending] = useActionState(
    saveClienteAction,
    undefined as ClienteFormState | undefined
  );
  const [fields, setFields] = useState(() => initialClienteFields(cliente));
  const { fieldClass, FieldErrorMessage } = useFormFieldErrors(state);

  useEffect(() => {
    if (state?.values) {
      setFields(state.values);
    }
  }, [state?.formKey]);

  function updateField<K extends keyof ClienteFormValues>(key: K, value: ClienteFormValues[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="mt-6 max-w-lg space-y-4">
      <FormError message={state?.error} />
      {cliente ? <input type="hidden" name="id" value={cliente.id} /> : null}
      <ClienteCoreFields
        values={{
          nombre: fields.nombre,
          apellido: fields.apellido,
          telefono: fields.telefono,
        }}
        onChange={(field, value) => updateField(field, value)}
        fieldErrors={state?.fieldErrors}
        required={isNew}
      />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Documento <span className="text-red-600" aria-hidden="true">*</span>
        </span>
        <input
          name="documento"
          required={isNew}
          data-field="documento"
          aria-invalid={state?.fieldErrors?.documento ? true : undefined}
          aria-describedby={state?.fieldErrors?.documento ? "documento-error" : undefined}
          value={fields.documento}
          onChange={(e) => updateField("documento", e.target.value)}
          className={fieldClass(
            "documento",
            "w-full rounded-lg border px-3 py-2"
          )}
        />
        <FieldErrorMessage field="documento" />
      </label>
      {isNew ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            Patente <span className="text-red-600" aria-hidden="true">*</span>
          </span>
          <input
            name="patente"
            required
            placeholder="Ej. AB123CD"
            data-field="patente"
            aria-invalid={state?.fieldErrors?.patente ? true : undefined}
            aria-describedby={state?.fieldErrors?.patente ? "patente-error" : undefined}
            value={fields.patente}
            onChange={(e) => updateField("patente", e.target.value.toUpperCase())}
            className={fieldClass(
              "patente",
              "w-full rounded-lg border px-3 py-2 uppercase"
            )}
          />
          <FieldErrorMessage field="patente" />
        </label>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input
          name="email"
          type="email"
          value={fields.email}
          onChange={(e) => updateField("email", e.target.value)}
          className={fieldClass("email", "w-full rounded-lg border px-3 py-2")}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Notas</span>
        <textarea
          name="notas"
          value={fields.notas}
          onChange={(e) => updateField("notas", e.target.value)}
          className={fieldClass("notas", "w-full rounded-lg border px-3 py-2")}
        />
      </label>
      <button type="submit" disabled={pending} className="btn-primary-lg">
        {pending ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
