"use client";

import { createTallerAction } from "@/lib/modules/catalog/taller.actions";
import { TallerDatosFields } from "@/components/taller/TallerDatosFields";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import type { DiaHorarioSnapshot } from "@/lib/modules/catalog/franjas";

export function CrearTallerForm({ horarioAlta }: { horarioAlta: DiaHorarioSnapshot[] }) {
  return (
    <form
      action={createTallerAction}
      className="space-y-4 rounded-xl border bg-white p-5 shadow-sm"
    >
      <h2 className="font-semibold">Agregar taller</h2>
      <TallerDatosFields includeHorarioAlta horarioAlta={horarioAlta} />
      <FormSubmitButton pendingLabel="Creando…" className="btn-primary-lg">
        Crear taller
      </FormSubmitButton>
    </form>
  );
}
