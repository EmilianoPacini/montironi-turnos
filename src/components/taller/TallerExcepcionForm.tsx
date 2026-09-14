"use client";

import { useState } from "react";
import { upsertExcepcionAction } from "@/lib/modules/catalog/taller.actions";
import { FranjasTimeEditor } from "@/components/taller/FranjasTimeEditor";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";

export function TallerExcepcionForm({ tallerId }: { tallerId: string }) {
  const [tipo, setTipo] = useState<"cerrado" | "horario_especial">("cerrado");

  return (
    <form
      action={upsertExcepcionAction}
      className="space-y-3 rounded-xl border bg-white p-5"
    >
      <h2 className="font-semibold">Excepción de un día</h2>
      <input type="hidden" name="tallerId" value={tallerId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Fecha</span>
          <input name="fecha" type="date" required className="input-field" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Tipo</span>
          <select
            name="tipo"
            className="input-field"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "cerrado" | "horario_especial")}
          >
            <option value="cerrado">Cerrado</option>
            <option value="horario_especial">Horario especial</option>
          </select>
        </label>
      </div>
      {tipo === "horario_especial" ? (
        <div className="block text-sm">
          <span className="mb-2 block font-medium">Horario de ese día</span>
          <FranjasTimeEditor
            defaultFranjas={[{ horaInicio: "08:00", horaFin: "12:00" }]}
          />
        </div>
      ) : (
        <p className="text-sm text-slate-500">El taller permanece cerrado esa fecha.</p>
      )}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Motivo</span>
        <input name="motivo" className="input-field" />
      </label>
      <FormSubmitButton pendingLabel="Guardando…">Guardar excepción</FormSubmitButton>
    </form>
  );
}
