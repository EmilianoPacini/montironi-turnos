"use client";

import { saveBahiaAction } from "@/lib/modules/appointments/actions";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";

export function BahiaCreateForm({
  tallerId,
  tallerNombre,
}: {
  tallerId: string;
  tallerNombre: string;
}) {
  return (
    <form
      action={saveBahiaAction}
      className="mt-8 max-w-lg space-y-3 rounded-xl border border-slate-200 bg-sky-50/50 p-5 shadow-sm"
    >
      <h2 className="font-semibold text-slate-900">Agregar bahía</h2>
      <p className="text-xs text-slate-600">
        Se crea en <strong>{tallerNombre}</strong> y hereda los servicios de la empresa. Sin este
        vínculo no aparece en la agenda ni en el bot.
      </p>
      <input type="hidden" name="tallerId" value={tallerId} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Nombre</span>
        <input name="nombre" required className="input-field" placeholder="Bahía 1" />
      </label>
      <FormSubmitButton pendingLabel="Creando…">Crear bahía</FormSubmitButton>
    </form>
  );
}
