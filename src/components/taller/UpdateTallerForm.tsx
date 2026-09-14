"use client";

import { updateTallerAction } from "@/lib/modules/catalog/taller.actions";
import { TallerDatosFields } from "@/components/taller/TallerDatosFields";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";

export function UpdateTallerForm({
  tallerId,
  ...fields
}: {
  tallerId: string;
  nombre: string;
  activo: boolean;
  calle?: string | null;
  numero?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  codigoPostal?: string | null;
  direccionLegacy?: string | null;
  margenMinutos?: number;
  intervaloInicioMinutos?: number;
  anticipacionMinimaHoras?: number;
  anticipacionMaximaDias?: number;
  permiteCancelacion?: boolean;
  horasLimiteCancelacion?: number;
}) {
  return (
    <form
      action={updateTallerAction}
      className="space-y-4 rounded-xl border bg-white p-5"
    >
      <input type="hidden" name="tallerId" value={tallerId} />
      <TallerDatosFields {...fields} activo={fields.activo} />
      <FormSubmitButton pendingLabel="Guardando…">Guardar datos y reglas</FormSubmitButton>
    </form>
  );
}
