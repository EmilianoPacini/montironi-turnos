"use client";

import { useEffect, useState } from "react";
import { createClienteInlineAction } from "@/lib/modules/appointments/actions";
import { ClienteCoreFields } from "@/components/clientes/ClienteCoreFields";
import { FormError } from "@/components/ui/FormError";
import { useFormFieldErrors } from "@/components/ui/use-form-field-errors";

const EMPTY = { nombre: "", apellido: "", telefono: "" };

export function InlineClienteModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (cliente: {
    id: string;
    nombre: string;
    apellido: string;
    telefono: string;
    vehiculos: { vehiculoId: string; vehiculo: { patente: string; marca?: string | null } }[];
  }) => void;
}) {
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [focusField, setFocusField] = useState<string | undefined>();
  const [focusKey, setFocusKey] = useState<number | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFields(EMPTY);
    setError(undefined);
    setFieldErrors({});
    setFocusField(undefined);
  }, [open]);

  useFormFieldErrors({
    formKey: focusKey,
    focusField,
    fieldErrors,
  });

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const result = await createClienteInlineAction(fd);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      setFocusField(result.focusField);
      setFocusKey(Date.now());
      return;
    }
    onCreated(result.cliente);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-lg"
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          ×
        </button>
        <h3 className="font-semibold pr-8">Nuevo cliente</h3>
        <FormError message={error} />
        <ClienteCoreFields
          values={fields}
          onChange={(field, value) => setFields((prev) => ({ ...prev, [field]: value }))}
          fieldErrors={fieldErrors}
          className="w-full rounded border px-3 py-2"
        />
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
