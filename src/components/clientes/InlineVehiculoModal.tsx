"use client";

import { useEffect, useState } from "react";
import { CondicionVehiculo, TipoVehiculo } from "@prisma/client";
import { createVehiculoInlineAction } from "@/lib/modules/appointments/actions";
import { VehiculoFields } from "@/components/clientes/VehiculoFields";
import { FormError } from "@/components/ui/FormError";
import { useFormFieldErrors } from "@/components/ui/use-form-field-errors";

const EMPTY = {
  patente: "",
  marca: "",
  modelo: "",
  tipoVehiculo: "auto" as TipoVehiculo,
  condicion: "normal" as CondicionVehiculo,
  kilometrajeActual: "",
};

export function InlineVehiculoModal({
  open,
  clienteId,
  onClose,
  onCreated,
}: {
  open: boolean;
  clienteId: string;
  onClose: () => void;
  onCreated: (vehiculo: { id: string; patente: string; marca?: string | null }) => void;
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

  useFormFieldErrors({ formKey: focusKey, focusField, fieldErrors });

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("clienteId", clienteId);
    const result = await createVehiculoInlineAction(fd);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      setFocusField(result.focusField);
      setFocusKey(Date.now());
      return;
    }
    onCreated(result.vehiculo);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          ×
        </button>
        <h3 className="pr-8 text-lg font-semibold text-slate-900">Nuevo vehículo</h3>
        <p className="text-sm text-slate-600">Mismos campos que en la ficha del cliente.</p>
        <FormError message={error} />
        <VehiculoFields
          values={fields}
          onChange={(field, value) => {
            if (field === "tipoVehiculo") {
              setFields((prev) => ({ ...prev, tipoVehiculo: value as TipoVehiculo }));
              return;
            }
            if (field === "condicion") {
              setFields((prev) => ({ ...prev, condicion: value as CondicionVehiculo }));
              return;
            }
            setFields((prev) => ({ ...prev, [field]: value }));
          }}
          fieldErrors={fieldErrors}
        />
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
