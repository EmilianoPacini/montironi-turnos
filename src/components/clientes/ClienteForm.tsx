"use client";

import { useActionState } from "react";
import { saveClienteAction, type ClienteFormState } from "@/lib/modules/appointments/actions";
import { ClienteCoreFields } from "@/components/clientes/ClienteCoreFields";
import { FormError } from "@/components/ui/FormError";

export function ClienteForm({
  cliente,
}: {
  cliente?: {
    id: string;
    nombre: string;
    apellido?: string | null;
    email?: string | null;
    telefono?: string | null;
    documento?: string | null;
    notas?: string | null;
  };
}) {
  const isNew = !cliente;
  const [state, formAction, pending] = useActionState(saveClienteAction, undefined as ClienteFormState | undefined);
  const values = state?.values;
  const formKey = state?.formKey ?? "initial";

  const fieldValues = {
    nombre: values?.nombre ?? cliente?.nombre ?? "",
    apellido: values?.apellido ?? cliente?.apellido ?? "",
    telefono: values?.telefono ?? cliente?.telefono ?? "",
    documento: values?.documento ?? cliente?.documento ?? "",
    patente: values?.patente ?? "",
    email: values?.email ?? cliente?.email ?? "",
    notas: values?.notas ?? cliente?.notas ?? "",
  };

  return (
    <form
      key={formKey}
      action={formAction}
      className="mt-6 max-w-lg space-y-4"
    >
      <FormError message={state?.error} />
      {cliente ? <input type="hidden" name="id" value={cliente.id} /> : null}
      <ClienteCoreFields
        cliente={{
          nombre: fieldValues.nombre,
          apellido: fieldValues.apellido,
          telefono: fieldValues.telefono,
        }}
        required={isNew}
      />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Documento <span className="text-red-600" aria-hidden="true">*</span>
        </span>
        <input
          name="documento"
          required={isNew}
          defaultValue={fieldValues.documento}
          className="w-full rounded-lg border px-3 py-2"
        />
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
            defaultValue={fieldValues.patente}
            className="w-full rounded-lg border px-3 py-2 uppercase"
          />
        </label>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input
          name="email"
          type="email"
          defaultValue={fieldValues.email}
          className="w-full rounded-lg border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Notas</span>
        <textarea
          name="notas"
          defaultValue={fieldValues.notas}
          className="w-full rounded-lg border px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary-lg"
      >
        {pending ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
